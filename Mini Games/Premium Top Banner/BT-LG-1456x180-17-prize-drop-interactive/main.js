(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-prize-drop",         // CustomEvent namespace
    api: "mgPrizeDrop",                   // window.<api> handle
    campaign: "lumen-l5",
    offer: "−30%",
    winTitle: "Jackpot!",
    loseTitle: "So close!",
    goal: 700,                              // total points across the balls
    maxPlayMs: 45000,                       // hard stop: a session never runs past this
    idleStopMs: 30000                       // stop the attract loop after this long untouched
  };

  const PALETTE = {
    bg: ["#33105e", "#1a0838", "#0e0420"],
    ray: "rgba(255, 190, 255, 0.05)",
    sparkle: "rgba(255, 236, 200, 0.7)",
    watermark: "rgba(255, 220, 255, 0.05)",
    rail: ["#fff2b0", "#d9a520", "#7a5208"],
    chrome: ["#ffffff", "#c3cbe0", "#5e6782"],
    peg: ["#fff4c2", "#f2b632", "#8a5a0a"],
    pegGlow: "255, 236, 150",
    tiers: { 10: "#1f8a96", 50: "#2f5fd0", 100: "#8a3fe0", 500: "#ff9d00" },
    label: "#ffffff",
    pod: ["#ff8ae6", "#d42fb0", "#6e0f5c"],
    lamp: ["#5dff9a", "#ff5a7a"],
    ball: ["#ffffff", "#c9d2e6", "#68728c"],
    coin: ["#fff1a0", "#ffc61a", "#a66b00"],
    guide: "rgba(255, 255, 255, 0.24)",
    text: "#ffffff",
    gold: "#ffd84a"
  };

  const ad = document.getElementById("ad");
  const canvas = document.getElementById("stage");
  const playButton = document.getElementById("playButton");
  const skipButton = document.getElementById("skipButton");
  const ctaButton = document.getElementById("ctaButton");
  const replayButton = document.getElementById("replayButton");
  const closeButton = document.getElementById("closeButton");
  const scoreValue = document.getElementById("scoreValue");
  const goalValue = document.getElementById("goalValue");
  const timeValue = document.getElementById("timeValue");
  const ballsValue = document.getElementById("ballsValue");
  const endTitle = document.getElementById("endTitle");
  const endEyebrow = document.getElementById("endEyebrow");
  const offerValue = document.getElementById("offerValue");

  if (!ad || !canvas || !playButton || !ctaButton) {
    return;
  }

  /* ------------------------------------------------------------------- FORMAT */

  // Every format is authored at its ad.size and served smaller; index.html
  // scales the whole creative by k (the samples' --k). Game code works in
  // served pixels, so a 10px font or a 30px touch target is the same
  // physical size in every format. SAFE is the area not covered by the HUD.
  const FORMATS = {
    popup: { width: 300, height: 250, k: 1, safe: { x: 0, y: 24, w: 300, h: 226 } },
    rail: { width: 100, height: 240, k: 2, safe: { x: 0, y: 34, w: 100, h: 206 } },
    strip: { width: 430, height: (180 * 430) / 1456, k: 1456 / 430, safe: { x: 66, y: 0, w: 364, h: (180 * 430) / 1456 } }
  };

  const FORMAT = FORMATS[ad.dataset.format] ? ad.dataset.format : "popup";
  const WIDTH = FORMATS[FORMAT].width;
  const HEIGHT = FORMATS[FORMAT].height;
  const K = FORMATS[FORMAT].k;
  const SAFE = { ...FORMATS[FORMAT].safe };

  // The sticky-bottom variant keeps its close button clear of play.
  if (closeButton) {
    SAFE.w -= 18;
  }

  // Backing pixels per served pixel: sharp when served small on a retina
  // phone and still crisp when shown at full authored size.
  const ctx = canvas.getContext("2d");
  const DPR = Math.min(Math.max(K * (window.devicePixelRatio || 1), 1), 4);
  canvas.width = Math.round(WIDTH * DPR);
  canvas.height = Math.round(HEIGHT * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  /* -------------------------------------------------------------------- SHELL */

  const Shell = {
    phase: "intro",   // intro | play | end
    score: 0,
    elapsed: 0,
    won: false
  };

  const emit = (name, detail = {}) => {
    ad.dispatchEvent(new CustomEvent(`${CONFIG.eventPrefix}:${name}`, {
      bubbles: true,
      detail: { format: FORMAT, ...detail }
    }));
  };

  const setPhase = (phase) => {
    Shell.phase = phase;
    ad.dataset.phase = phase;
  };

  const setScore = (value) => {
    Shell.score = value;
    if (scoreValue) {
      scoreValue.textContent = String(value);
    }
  };

  const shake = () => {
    if (reduceMotion) {
      return;
    }
    ad.classList.remove("is-shake");
    void ad.offsetWidth;
    ad.classList.add("is-shake");
  };

  /* ---------------------------------------------------------------------- FX */

  const MAX_PARTICLES = 150;
  const particles = [];
  const floaters = [];

  const burst = (x, y, color, count = 12, speed = 90) => {
    if (reduceMotion) {
      count = Math.ceil(count / 3);
    }
    for (let index = 0; index < count && particles.length < MAX_PARTICLES; index += 1) {
      const angle = rand(0, Math.PI * 2);
      const velocity = rand(0.3, 1) * speed;
      particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: rand(0.35, 0.7),
        age: 0,
        size: rand(1.5, 3.5),
        color
      });
    }
  };

  const floatText = (x, y, text, color = PALETTE.text) => {
    floaters.push({ x, y, text, color, age: 0, life: 0.8 });
  };

  const updateFx = (dt) => {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const p = particles[index];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      if (p.age >= p.life) {
        particles.splice(index, 1);
      }
    }
    for (let index = floaters.length - 1; index >= 0; index -= 1) {
      const f = floaters[index];
      f.age += dt;
      f.y -= 26 * dt;
      if (f.age >= f.life) {
        floaters.splice(index, 1);
      }
    }
  };

  const drawFx = () => {
    particles.forEach((p) => {
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${FORMAT === "popup" ? 12 : 9}px Arial, Helvetica, sans-serif`;
    floaters.forEach((f) => {
      ctx.globalAlpha = 1 - f.age / f.life;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;
  };

  /* --------------------------------------------------------------------- GAME */

  // World units are the creative's authored pixels (300x250, 200x480,
  // 1456x180); drawing is scaled by 1/K so the board keeps one physical size.
  // Physics runs in a board frame: x across the board, y along gravity. The
  // popup and rail use it as is; the strip turns it on its side so balls fall
  // to the right while the dropper slides up and down the left edge.
  const WW = WIDTH * K;
  const WH = HEIGHT * K;
  const WSAFE = { x: SAFE.x * K, y: SAFE.y * K, w: SAFE.w * K, h: SAFE.h * K };
  const SIDEWAYS = FORMAT === "strip";

  const TAU = Math.PI * 2;
  const STEP = 1 / 120;                 // fixed physics step
  const MAX_STEPS = 8;
  const GRAVITY = 500;

  // Board geometry per format, in board units. The rail is a narrow, tall
  // five-slot board; the strip a long five-slot board lying on its side.
  const LAYOUT = {
    popup: {
      left: 12, right: 288, rail: 36, pegTop: 66, rows: 8, gapY: 17, pegDx: 276 / 14, slotTop: 204, floor: 244,
      values: [10, 50, 100, 500, 100, 50, 10], goal: 700, label: 11, hint: 10
    },
    rail: {
      left: 10, right: 190, rail: WSAFE.y + 16, pegTop: WSAFE.y + 64, rows: 9, gapY: 26, pegDx: 20, drag: 2.2, slotTop: WSAFE.y + 300, floor: WH - 12,
      values: [10, 100, 500, 100, 10], goal: 700, label: 15, hint: 14
    },
    strip: {
      left: 8, right: 172, rail: 30, pegTop: 72, rows: 17, gapY: 27, pegDx: 20.5, drag: 2.6, bias: 1.7, slotTop: 540, floor: 630,
      values: [10, 100, 500, 100, 10], goal: 700, label: 24, hint: 24
    }
  }[FORMAT];
  CONFIG.goal = LAYOUT.goal;

  const BOARD = { left: LAYOUT.left, right: LAYOUT.right, mid: (LAYOUT.left + LAYOUT.right) / 2, end: LAYOUT.floor + 6 };
  const SPAWN_Y = LAYOUT.rail + 12;
  const PEG = { r: 2.6, rows: LAYOUT.rows, top: LAYOUT.pegTop, gapY: LAYOUT.gapY, dx: LAYOUT.pegDx, restitution: 0.45, jitter: 22 };
  // Sideways air drag (per second) keeps long, narrow boards from scattering
  // every ball across the full width, so the drop column still matters.
  const BALL = { r: 5, maxSpeed: 470, wallBounce: 0.5, floorBounce: 0.3, drag: LAYOUT.drag || 0 };
  const SLOT = { top: LAYOUT.slotTop, floor: LAYOUT.floor, scoreY: LAYOUT.slotTop + 10, values: LAYOUT.values };
  const SLOT_W = (BOARD.right - BOARD.left) / SLOT.values.length;
  const JACKPOT = SLOT.values.indexOf(Math.max(...SLOT.values));
  const DIVIDER_R = 2;
  const BALLS = 5;
  const RELOAD = 0.35;                  // after the previous ball lands; one ball at a time
  const DROPPER = { y: LAYOUT.rail, min: BOARD.left + 12, max: BOARD.right - 12, follow: 16, keySpeed: 170, arrive: 1.5 };
  // Disclosed assist: while a ball is in the peg field it is nudged sideways
  // toward the jackpot column, mildly by default and harder when the goal can
  // no longer be reached with 100s alone. Skill picks the column; the nudge
  // just makes the board kind, so most sessions reach the goal. The strip's
  // long sideways board scatters more, so its nudge is stronger.
  const BIAS = { k: 0.9 * (LAYOUT.bias || 1), max: 32 * (LAYOUT.bias || 1), boost: 1.9 };
  const LANDED = { hold: 1.1, fade: 0.5 };
  const STUCK = { speed: 8, after: 0.5, kick: 70, maxAge: 11 };
  const MAX_COINS = 60;
  const DEMO_EVERY = 0.9;                // pause between demo drops once the last one lands
  const END_DELAY = 0.8;

  // Board <-> world. The strip mirrors the board across its diagonal (board
  // x runs down the band, board y runs right), so text is always drawn in
  // world space, never through this transform.
  const BX = SIDEWAYS ? WSAFE.x + 16 : 0;
  const toWorld = (x, y) => (SIDEWAYS ? [BX + y, x] : [x, y]);
  const toBoard = (x, y) => (SIDEWAYS ? [y, x - BX] : [x, y]);
  const boardSpace = (c) => {
    if (SIDEWAYS) {
      c.transform(0, 1, 1, 0, BX, 0);
    }
  };

  // Effects live in served pixels.
  const fxBurst = (x, y, color, count, speed) => {
    const [wx, wy] = toWorld(x, y);
    burst(wx / K, wy / K, color, count, speed / Math.sqrt(K));
  };
  const fxText = (x, y, text, color) => {
    const [wx, wy] = toWorld(x, y);
    floatText(wx / K, wy / K, text, color);
  };

  // Staggered rows; the outermost pegs keep a ball-wide gap to the walls.
  const PEGS = [];
  for (let row = 0; row < PEG.rows; row += 1) {
    const offset = row % 2 ? 0.5 : 0;
    for (let k = 1; BOARD.left + PEG.dx * (k + offset) < BOARD.right - PEG.dx * 0.9; k += 1) {
      PEGS.push({ x: BOARD.left + PEG.dx * (k + offset), y: PEG.top + row * PEG.gapY, glow: 0 });
    }
  }
  const DIVIDERS = SLOT.values.slice(1).map((_, index) => BOARD.left + SLOT_W * (index + 1));

  // Per-round state; resetGame() restores it.
  const freshState = () => ({
    balls: [],
    coins: [],
    flashes: SLOT.values.map(() => 0),
    acc: 0,
    ballsLeft: BALLS,
    reloadT: 0,
    dropX: BOARD.mid,
    targetX: BOARD.mid,
    pending: false,       // a drop waits for the dropper to arrive
    dragging: false,
    keys: { left: false, right: false },
    podKick: 0,
    demoT: 0,
    endT: 0,
    moved: false          // hides the hint after the first interaction
  });

  const game = { ...freshState(), time: 0 };

  const setBallsHud = () => {
    if (ballsValue) {
      ballsValue.textContent = String(game.ballsLeft);
    }
  };

  const resetGame = () => {
    Object.assign(game, freshState());
    PEGS.forEach((peg) => {
      peg.glow = 0;
    });
    setBallsHud();
  };

  const shade = (gradient, colors) => {
    colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
    return gradient;
  };

  const seeded = (seed) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const roundRect = (c, x, y, w, h, r) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  const font = (size) => `900 ${size}px Arial, Helvetica, sans-serif`;

  // Backdrop, rails, slot pockets, divider pins and the pegs' resting look.
  const bgLayer = (() => {
    const layer = document.createElement("canvas");
    layer.width = Math.round(WIDTH * DPR);
    layer.height = Math.round(HEIGHT * DPR);
    const c = layer.getContext("2d");
    c.setTransform(DPR / K, 0, 0, DPR / K, 0, 0);
    const rnd = seeded(23);
    c.fillStyle = shade(c.createLinearGradient(0, 0, 0, WH), PALETTE.bg);
    c.fillRect(0, 0, WW, WH);
    c.fillStyle = PALETTE.ray;
    for (let index = 0; index < Math.round(WW / 50); index += 1) {
      const x = 20 + index * 52;
      c.beginPath();
      c.moveTo(WW / 2, -20);
      c.lineTo(x - 14, WH);
      c.lineTo(x + 14, WH);
      c.fill();
    }
    c.textAlign = "center";
    c.textBaseline = "middle";
    const [mx, my] = toWorld(BOARD.mid, (PEG.top + SLOT.top) / 2);
    c.fillStyle = PALETTE.watermark;
    c.font = font(SIDEWAYS ? 40 : 30);
    c.fillText("LUMEN L5", mx, my);

    if (SIDEWAYS) {
      // The strip has room past the slots for a little brand panel.
      const x0 = BX + BOARD.end + 22;
      const x1 = WSAFE.x + WSAFE.w - 14;
      if (x1 - x0 > 150) {
        c.fillStyle = "rgba(14, 4, 32, 0.6)";
        roundRect(c, x0, 22, x1 - x0, WH - 44, 18);
        c.fill();
        c.strokeStyle = PALETTE.gold;
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = PALETTE.gold;
        c.font = font(36);
        c.fillText("LUMEN L5", (x0 + x1) / 2, WH / 2 - 20);
        c.fillStyle = PALETTE.label;
        c.font = font(24);
        c.fillText("JACKPOT 500", (x0 + x1) / 2, WH / 2 + 24);
      }
    }

    c.save();
    boardSpace(c);
    c.fillStyle = PALETTE.sparkle;
    for (let index = 0; index < (BOARD.end - PEG.top) / 4; index += 1) {
      c.globalAlpha = 0.2 + rnd() * 0.6;
      c.fillRect(BOARD.left + rnd() * (BOARD.right - BOARD.left), PEG.top - 20 + rnd() * (SLOT.top - PEG.top), 1, 1);
    }
    c.globalAlpha = 1;
    SLOT.values.forEach((value, index) => {
      const x = BOARD.left + index * SLOT_W;
      c.fillStyle = shade(c.createLinearGradient(0, SLOT.top, 0, BOARD.end), [`${PALETTE.tiers[value]}22`, `${PALETTE.tiers[value]}aa`]);
      c.fillRect(x + 2, SLOT.top, SLOT_W - 4, SLOT.floor - SLOT.top);
    });
    c.fillStyle = shade(c.createLinearGradient(0, SLOT.floor, 0, BOARD.end), PALETTE.rail);
    c.fillRect(BOARD.left - 6, SLOT.floor, BOARD.right - BOARD.left + 12, BOARD.end - SLOT.floor);
    [BOARD.left - 6, BOARD.right].forEach((x) => {
      c.fillStyle = shade(c.createLinearGradient(x, 0, x + 6, 0), PALETTE.rail);
      roundRect(c, x, DROPPER.y - 8, 6, BOARD.end - DROPPER.y + 8, 3);
      c.fill();
    });
    c.fillStyle = shade(c.createLinearGradient(0, DROPPER.y - 2, 0, DROPPER.y + 2), PALETTE.chrome);
    roundRect(c, BOARD.left, DROPPER.y - 2, BOARD.right - BOARD.left, 4, 2);
    c.fill();
    DIVIDERS.forEach((x) => {
      c.fillStyle = shade(c.createLinearGradient(x - DIVIDER_R, 0, x + DIVIDER_R, 0), PALETTE.chrome);
      roundRect(c, x - DIVIDER_R, SLOT.top - DIVIDER_R, DIVIDER_R * 2, SLOT.floor - SLOT.top + DIVIDER_R, DIVIDER_R);
      c.fill();
    });
    PEGS.forEach((peg) => {
      c.fillStyle = "rgba(0, 0, 0, 0.35)";
      c.beginPath();
      c.arc(peg.x + 0.8, peg.y + 1.2, PEG.r, 0, TAU);
      c.fill();
      c.fillStyle = shade(c.createRadialGradient(peg.x - 0.8, peg.y - 0.9, 0.3, peg.x, peg.y, PEG.r), PALETTE.peg);
      c.beginPath();
      c.arc(peg.x, peg.y, PEG.r, 0, TAU);
      c.fill();
    });
    c.restore();
    return layer;
  })();

  /* ---- physics */

  const slotAt = (x) => clamp(Math.floor((x - BOARD.left) / SLOT_W), 0, SLOT.values.length - 1);

  const spawnBall = (x, gain) => {
    game.balls.push({ x: x + rand(-0.3, 0.3), y: SPAWN_Y, vx: 0, vy: 30, age: 0, slowT: 0, slot: -1, landedT: 0, gain, trail: [] });
  };

  // Harder nudge once 100s alone can no longer reach the goal (ballsLeft
  // still counts the ball being dropped).
  const biasGain = () => (game.ballsLeft * SLOT.values[JACKPOT - 1] < CONFIG.goal - Shell.score ? BIAS.boost : 1);

  const falling = () => game.balls.some((b) => b.slot < 0);

  const canDrop = () => game.ballsLeft > 0 && game.reloadT <= 0 && game.endT <= 0 && !falling();

  const dropBall = () => {
    if (!canDrop()) {
      return false;
    }
    spawnBall(game.dropX, biasGain());
    game.ballsLeft -= 1;
    game.podKick = 1;
    setBallsHud();
    return true;
  };

  const bounceOff = (b, px, py, reach, restitution, jitter) => {
    const dx = b.x - px;
    const dy = b.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 >= reach * reach) {
      return 0;
    }
    const d = Math.sqrt(d2) || 0.001;
    const nx = d2 ? dx / d : 0;
    const ny = d2 ? dy / d : -1;
    b.x = px + nx * reach;
    b.y = py + ny * reach;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) {
      return 0;
    }
    b.vx -= (1 + restitution) * vn * nx;
    b.vy -= (1 + restitution) * vn * ny;
    if (jitter) {
      // A little randomness so identical drops still scatter.
      const kick = rand(-1, 1) * jitter;
      b.vx -= ny * kick;
      b.vy += nx * kick;
    }
    return -vn;
  };

  const landBall = (b) => {
    b.slot = slotAt(b.x);
    const value = SLOT.values[b.slot];
    const cx = BOARD.left + (b.slot + 0.5) * SLOT_W;
    game.flashes[b.slot] = 1;
    game.reloadT = RELOAD;
    spawnCoins(cx, SLOT.top + 6, value >= 500 ? 22 : value >= 100 ? 10 : 4);
    fxBurst(cx, SLOT.top + 10, PALETTE.tiers[value], value >= 500 ? 18 : 8, 80);
    if (Shell.phase !== "play") {
      return;
    }
    setScore(Shell.score + value);
    fxText(cx, SLOT.top - 8, value >= 500 ? `JACKPOT +${value}` : `+${value}`, value >= 500 ? PALETTE.gold : PALETTE.text);
    if (value >= 500) {
      shake();
    }
  };

  const spawnCoins = (x, y, count) => {
    const n = reduceMotion ? Math.ceil(count / 3) : count;
    for (let index = 0; index < n && game.coins.length < MAX_COINS; index += 1) {
      game.coins.push({ x, y, vx: rand(-70, 70), vy: rand(-170, -80), spin: rand(0, TAU), spinV: rand(8, 16), age: 0, life: rand(0.7, 1.1) });
    }
  };

  const stepBall = (b, h) => {
    b.age += h;
    b.vy += GRAVITY * h;
    if (b.slot < 0 && b.y > PEG.top - 12 && b.y < SLOT.top) {
      b.vx += clamp((BOARD.mid - b.x) * BIAS.k * b.gain, -BIAS.max * b.gain, BIAS.max * b.gain) * h;
    }
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > BALL.maxSpeed) {
      b.vx *= BALL.maxSpeed / speed;
      b.vy *= BALL.maxSpeed / speed;
    }
    if (b.slot < 0) {
      b.vx *= 1 - BALL.drag * h;
    }
    b.x += b.vx * h;
    b.y += b.vy * h;

    if (b.y > PEG.top - 10 && b.y < PEG.top + PEG.rows * PEG.gapY) {
      PEGS.forEach((peg) => {
        if (Math.abs(peg.y - b.y) < 9 && bounceOff(b, peg.x, peg.y, BALL.r + PEG.r, PEG.restitution, PEG.jitter) > 25) {
          peg.glow = 1;
        }
      });
    }
    if (b.y > SLOT.top - BALL.r - DIVIDER_R) {
      DIVIDERS.forEach((x) => {
        bounceOff(b, x, clamp(b.y, SLOT.top, SLOT.floor), BALL.r + DIVIDER_R, 0.4, 0);
      });
    }
    if (b.x < BOARD.left + BALL.r) {
      b.x = BOARD.left + BALL.r;
      b.vx = Math.abs(b.vx) * BALL.wallBounce;
    } else if (b.x > BOARD.right - BALL.r) {
      b.x = BOARD.right - BALL.r;
      b.vx = -Math.abs(b.vx) * BALL.wallBounce;
    }
    if (b.y > SLOT.floor - BALL.r) {
      b.y = SLOT.floor - BALL.r;
      b.vy = -Math.abs(b.vy) * BALL.floorBounce;
      b.vx *= 0.8;
    }
    if (b.slot < 0 && b.y > SLOT.scoreY) {
      landBall(b);
    }
  };

  const stepWorld = (dt) => {
    game.acc = Math.min(game.acc + dt, STEP * MAX_STEPS);
    while (game.acc >= STEP) {
      for (let i = 0; i < game.balls.length; i += 1) {
        stepBall(game.balls[i], STEP);
        for (let j = i + 1; j < game.balls.length; j += 1) {
          const a = game.balls[i];
          const b = game.balls[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < BALL.r * 2) {
            const nx = dx / d;
            const ny = dy / d;
            const push = (BALL.r * 2 - d) / 2;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (vn < 0) {
              const j2 = (-(1 + 0.5) * vn) / 2;
              a.vx -= j2 * nx;
              a.vy -= j2 * ny;
              b.vx += j2 * nx;
              b.vy += j2 * ny;
            }
          }
        }
      }
      game.acc -= STEP;
    }

    game.balls.forEach((b) => {
      b.trail.unshift([b.x, b.y]);
      b.trail.length = Math.min(b.trail.length, 4);
      if (b.slot >= 0) {
        b.landedT += dt;
        return;
      }
      // Watchdog: a ball balanced on a peg gets a shove; a lost one is placed.
      if (Math.hypot(b.vx, b.vy) < STUCK.speed) {
        b.slowT += dt;
        if (b.slowT > STUCK.after) {
          b.vx += rand(0.5, 1) * STUCK.kick * (b.x < BOARD.mid ? 1 : -1);
          b.vy -= 30;
          b.slowT = 0;
        }
      } else {
        b.slowT = 0;
      }
      if (b.age > STUCK.maxAge) {
        b.y = SLOT.scoreY + 1;
        landBall(b);
      }
    });
    game.balls = game.balls.filter((b) => b.landedT < LANDED.hold + LANDED.fade);

    PEGS.forEach((peg) => {
      peg.glow = Math.max(0, peg.glow - dt * 2.2);
    });
    game.flashes = game.flashes.map((flash) => Math.max(0, flash - dt * 1.2));
    game.coins.forEach((coin) => {
      coin.age += dt;
      coin.vy += 380 * dt;
      coin.x += coin.vx * dt;
      coin.y += coin.vy * dt;
      coin.spin += coin.spinV * dt;
    });
    game.coins = game.coins.filter((coin) => coin.age < coin.life);
    game.podKick = Math.max(0, game.podKick - dt * 4);
  };

  const moveDropper = (dt) => {
    game.dropX += (game.targetX - game.dropX) * Math.min(1, dt * DROPPER.follow);
    game.reloadT = Math.max(0, game.reloadT - dt);
  };

  const endSummary = () => `Total ${Shell.score} / ${CONFIG.goal}`;

  // Runs only in the play phase.
  const update = (dt) => {
    game.time += dt;
    const dir = (game.keys.right ? 1 : 0) - (game.keys.left ? 1 : 0);
    if (dir) {
      game.targetX = clamp(game.targetX + dir * DROPPER.keySpeed * dt, DROPPER.min, DROPPER.max);
    }
    moveDropper(dt);
    if (game.pending && Math.abs(game.dropX - game.targetX) < DROPPER.arrive && canDrop()) {
      game.pending = false;
      dropBall();
    }
    stepWorld(dt);
    if (Shell.score >= CONFIG.goal || (game.ballsLeft === 0 && !falling())) {
      game.endT += dt;
      if (game.endT > END_DELAY) {
        endGame(Shell.score >= CONFIG.goal);
      }
    }
  };

  // Attract motion behind the intro and end panels: the dropper sways and
  // drops demo balls in the intro.
  const idle = (dt) => {
    game.time += dt;
    if (Shell.phase === "intro") {
      game.targetX = BOARD.mid + Math.sin(game.time * 0.9) * ((BOARD.right - BOARD.left) / 2 - 30);
      game.demoT = falling() ? 0 : game.demoT + dt;
      if (game.demoT > DEMO_EVERY) {
        game.demoT = 0;
        game.podKick = 1;
        spawnBall(game.dropX, 1);
      }
    }
    moveDropper(dt);
    stepWorld(dt);
  };

  /* ---- drawing */

  const dot = (x, y, r, color) => {
    if (color) {
      ctx.fillStyle = color;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };

  const strokePath = (points, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };

  // Board space: flashes and the faint "under the dropper" highlight.
  const drawSlotGlow = () => {
    const under = slotAt(game.dropX);
    SLOT.values.forEach((value, index) => {
      const x = BOARD.left + index * SLOT_W;
      const flash = game.flashes[index];
      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.45})`;
        ctx.fillRect(x + 2, SLOT.top, SLOT_W - 4, SLOT.floor - SLOT.top);
      } else if (index === under && Shell.phase === "play") {
        ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
        ctx.fillRect(x + 2, SLOT.top, SLOT_W - 4, SLOT.floor - SLOT.top);
      }
    });
  };

  // World space: slot values stay upright in every format.
  const drawSlotLabels = (time) => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    SLOT.values.forEach((value, index) => {
      const cx = BOARD.left + (index + 0.5) * SLOT_W;
      const jackpot = index === JACKPOT;
      const pulse = jackpot && !reduceMotion ? 1 + Math.sin(time * 5) * 0.06 : 1;
      const base = LAYOUT.label + (jackpot ? Math.round(LAYOUT.label * 0.2) : 0);
      const size = Math.round(base * pulse + game.flashes[index] * 3);
      const along = SIDEWAYS ? (SLOT.top + SLOT.floor) / 2 + 8 : SLOT.top + 7 + LAYOUT.label;
      const [x, y] = toWorld(cx, along);
      ctx.font = font(size);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillText(String(value), x + 1, y + 1);
      ctx.fillStyle = jackpot ? PALETTE.gold : PALETTE.label;
      ctx.fillText(String(value), x, y);
      if (jackpot) {
        const [sx, sy] = toWorld(cx, SIDEWAYS ? SLOT.top + 14 : SLOT.top + 6);
        drawStar(sx, sy, (LAYOUT.label * 0.4) * pulse, PALETTE.gold);
      }
    });
  };

  const drawStar = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const rr = index % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(angle) * rr, y + Math.sin(angle) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };

  const drawPegGlow = () => {
    PEGS.forEach((peg) => {
      if (peg.glow <= 0) {
        return;
      }
      const g = peg.glow;
      dot(peg.x, peg.y, PEG.r + 3 * g, `rgba(${PALETTE.pegGlow}, ${0.35 * g})`);
      dot(peg.x, peg.y, PEG.r, `rgba(255, 255, 240, ${0.4 + 0.6 * g})`);
      if (!reduceMotion) {
        ctx.strokeStyle = `rgba(${PALETTE.pegGlow}, ${g * 0.7})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, PEG.r + (1 - g) * 9, 0, TAU);
        ctx.stroke();
      }
    });
  };

  const drawBall = (x, y, alpha = 1) => {
    ctx.globalAlpha = alpha;
    dot(x + 1, y + 1.5, BALL.r, "rgba(0, 0, 0, 0.3)");
    dot(x, y, BALL.r, shade(ctx.createRadialGradient(x - 1.6, y - 1.8, 0.4, x, y, BALL.r), PALETTE.ball));
    dot(x - 1.7, y - 1.9, 1.2, "rgba(255, 255, 255, 0.95)");
    ctx.globalAlpha = 1;
  };

  const drawBalls = () => {
    game.balls.forEach((b) => {
      const fade = clamp(1 - (b.landedT - LANDED.hold) / LANDED.fade, 0, 1);
      if (b.slot < 0 && !reduceMotion) {
        b.trail.forEach(([x, y], index) => {
          if (index) {
            dot(x, y, BALL.r * (1 - index * 0.2), `rgba(200, 220, 255, ${0.16 - index * 0.04})`);
          }
        });
      }
      drawBall(b.x, b.y, fade);
    });
  };

  const drawCoins = () => {
    game.coins.forEach((coin) => {
      const w = Math.max(0.4, Math.abs(Math.cos(coin.spin)) * 3.4);
      ctx.globalAlpha = clamp((coin.life - coin.age) / 0.25, 0, 1);
      ctx.fillStyle = PALETTE.coin[2];
      ctx.beginPath();
      ctx.ellipse(coin.x, coin.y + 0.6, w, 3.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = shade(ctx.createLinearGradient(coin.x - w, coin.y - 3, coin.x + w, coin.y + 3), PALETTE.coin);
      ctx.beginPath();
      ctx.ellipse(coin.x, coin.y, w, 3.2, 0, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };

  const drawDropper = (time) => {
    const x = game.dropX;
    const loaded = Shell.phase === "play" ? canDrop() : !falling();
    if (Shell.phase === "play" && loaded) {
      ctx.setLineDash([2, 4]);
      strokePath([[x, SPAWN_Y + 8], [x, SLOT.top - 4]], PALETTE.guide, 1);
      ctx.setLineDash([]);
    }
    const open = game.podKick * 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = PALETTE.chrome[2];
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 5, DROPPER.y + 4);
    ctx.lineTo(x - 6 - open, SPAWN_Y + 2);
    ctx.moveTo(x + 5, DROPPER.y + 4);
    ctx.lineTo(x + 6 + open, SPAWN_Y + 2);
    ctx.stroke();
    if (loaded) {
      drawBall(x, SPAWN_Y);
    }
    ctx.fillStyle = shade(ctx.createLinearGradient(0, DROPPER.y - 9, 0, DROPPER.y + 5), PALETTE.pod);
    roundRect(ctx, x - 12, DROPPER.y - 9, 24, 13, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    roundRect(ctx, x - 9, DROPPER.y - 7.5, 18, 3.5, 1.75);
    ctx.fill();
    const blink = loaded && Math.sin(time * 6) > -0.3;
    dot(x, DROPPER.y - 0.5, 1.8, loaded ? (blink ? PALETTE.lamp[0] : "#2a8a52") : PALETTE.lamp[1]);
  };

  // Chevrons either side of the dropper (board space).
  const drawHintArrows = (time) => {
    const x = game.dropX;
    const y = DROPPER.y - 2;
    const nudge = reduceMotion ? 0 : Math.sin(time * 5) * 2.5;
    ctx.globalAlpha = 0.9;
    ctx.lineCap = "round";
    [-1, 1].forEach((side) => {
      const tip = x + side * (24 + nudge);
      strokePath([[tip - side * 4, y - 5], [tip, y], [tip - side * 4, y + 5]], PALETTE.text, 2);
    });
    ctx.globalAlpha = 1;
  };

  // The instruction pill (world space).
  const drawHintText = () => {
    const text = SIDEWAYS ? "DRAG · TAP TO DROP" : "SLIDE · TAP TO DROP";
    const [x, y] = toWorld(BOARD.mid, (PEG.top + SLOT.top) / 2 + (SIDEWAYS ? 0 : -6));
    ctx.font = font(LAYOUT.hint);
    const w = ctx.measureText(text).width + LAYOUT.hint * 1.6;
    const h = LAYOUT.hint * 2;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(14, 4, 32, 0.78)";
    roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(text, x, y + 0.5);
    ctx.globalAlpha = 1;
  };

  const draw = (time) => {
    const hint = Shell.phase === "play" && !game.moved;
    ctx.save();
    ctx.scale(1 / K, 1 / K);
    ctx.drawImage(bgLayer, 0, 0, WW, WH);
    ctx.save();
    boardSpace(ctx);
    drawSlotGlow();
    drawPegGlow();
    drawBalls();
    drawDropper(time);
    drawCoins();
    if (hint) {
      drawHintArrows(time);
    }
    ctx.restore();
    drawSlotLabels(time);
    if (hint) {
      drawHintText();
    }
    ctx.restore();
    drawFx();
  };

  // The strip's dropper runs up and down, so the vertical arrows drive it too.
  const KEYS = SIDEWAYS
    ? { ArrowUp: "left", ArrowDown: "right", ArrowLeft: "left", ArrowRight: "right" }
    : { ArrowLeft: "left", ArrowRight: "right" };

  // Pointer hooks get served pixels; the dropper follows the board x.
  const boardX = (point) => clamp(toBoard(point.x * K, point.y * K)[0], DROPPER.min, DROPPER.max);

  const onPointerDown = (point) => {
    game.dragging = true;
    game.moved = true;
    game.targetX = boardX(point);
  };

  const onPointerMove = (point) => {
    if (game.dragging) {
      game.targetX = boardX(point);
    }
  };

  const onPointerUp = (point, event) => {
    if (!game.dragging) {
      return;
    }
    game.dragging = false;
    if (event && event.type === "pointercancel") {
      return;
    }
    game.targetX = boardX(point);
    if (game.ballsLeft > 0) {
      game.pending = true;
    }
  };

  const onKey = (key, down, event) => {
    const dir = KEYS[key];
    if (dir) {
      game.keys[dir] = down;
      game.moved = true;
      return true;
    }
    if (key === " " || key === "Spacebar" || key === "Enter") {
      if (down && !(event && event.repeat) && game.ballsLeft > 0) {
        game.moved = true;
        game.targetX = clamp(game.dropX, DROPPER.min, DROPPER.max);
        game.pending = true;
      }
      return true;
    }
    return false;
  };

  /* --------------------------------------------------------------------- LOOP */

  let frame = 0;
  let last = 0;
  let stopAt = Infinity;

  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;

    if (Shell.phase === "play") {
      Shell.elapsed += dt * 1000;
      update(dt);
      if (timeValue) {
        timeValue.textContent = String(Math.max(0, Math.ceil((CONFIG.maxPlayMs - Shell.elapsed) / 1000)));
      }
      if (Shell.phase === "play" && Shell.elapsed >= CONFIG.maxPlayMs) {
        endGame(Shell.score >= CONFIG.goal);
      }
    } else {
      idle(dt);
    }
    updateFx(dt);
    draw(now / 1000);

    if (now < stopAt && !document.hidden && !ad.hidden) {
      frame = requestAnimationFrame(tick);
    } else {
      frame = 0;
    }
  };

  // Keep the loop alive for `ms` more (Infinity = until told otherwise).
  const runLoop = (ms = Infinity) => {
    stopAt = performance.now() + ms;
    if (!frame && !document.hidden && !ad.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };

  /* ---------------------------------------------------------------- LIFECYCLE */

  const startGame = () => {
    resetGame();
    particles.length = 0;
    floaters.length = 0;
    setScore(0);
    Shell.elapsed = 0;
    Shell.won = false;
    setPhase("play");
    ad.focus({ preventScroll: true });
    emit("start");
    runLoop();
  };

  const endGame = (won) => {
    if (Shell.phase !== "play") {
      return;
    }
    Shell.won = won;
    setPhase("end");
    endTitle.textContent = won ? CONFIG.winTitle : CONFIG.loseTitle;
    endEyebrow.textContent = endSummary();
    if (won) {
      shake();
    }
    emit("end", { won, score: Shell.score, ms: Math.round(Shell.elapsed) });
    // A little more motion behind the end card, then the loop parks.
    runLoop(2500);
  };

  const getClickUrl = () => {
    if (typeof window.clickTag === "string" && window.clickTag.trim()) {
      return window.clickTag.trim();
    }
    return (ad.dataset.clickUrl || "").trim();
  };

  const openOffer = (source) => {
    const clickUrl = getClickUrl();
    emit("click", { clickUrl, campaign: CONFIG.campaign, source, score: Shell.score });
    if (clickUrl) {
      window.open(clickUrl, "_blank", "noopener,noreferrer");
    }
  };

  const show = () => {
    ad.hidden = false;
    runLoop(Shell.phase === "play" ? Infinity : CONFIG.idleStopMs);
  };

  const hide = () => {
    ad.hidden = true;
    cancelAnimationFrame(frame);
    frame = 0;
    emit("close", { phase: Shell.phase });
  };

  /* -------------------------------------------------------------------- INPUT */

  // Works through the CSS scale: the rect is the scaled box, so this maps
  // back to served pixels whatever size the creative is displayed at.
  const toLocal = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * WIDTH) / rect.width,
      y: ((event.clientY - rect.top) * HEIGHT) / rect.height
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    if (Shell.phase !== "play") {
      return;
    }
    event.preventDefault();
    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }
    onPointerDown(toLocal(event), event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (Shell.phase === "play") {
      onPointerMove(toLocal(event), event);
    }
  });

  const releasePointer = (event) => {
    if (Shell.phase === "play") {
      onPointerUp(toLocal(event), event);
    }
  };

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);

  ad.addEventListener("keydown", (event) => {
    if (Shell.phase === "play") {
      if (onKey(event.key, true, event)) {
        event.preventDefault();
      }
      return;
    }
    if (event.target === ad && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      if (Shell.phase === "intro") {
        startGame();
      } else {
        openOffer("keyboard");
      }
    }
  });

  ad.addEventListener("keyup", (event) => {
    if (Shell.phase === "play" && onKey(event.key, false, event)) {
      event.preventDefault();
    }
  });

  playButton.addEventListener("click", startGame);
  replayButton.addEventListener("click", startGame);
  skipButton.addEventListener("click", () => openOffer("skip"));
  ctaButton.addEventListener("click", () => openOffer("cta"));
  if (closeButton) {
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      hide();
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Shell.phase === "play") {
      runLoop();
    }
  });

  // Any touch on the intro wakes a parked attract loop.
  ad.addEventListener("pointerdown", () => {
    if (Shell.phase === "intro" && !frame) {
      runLoop(CONFIG.idleStopMs);
    }
  });

  /* --------------------------------------------------------------------- BOOT */

  if (goalValue) {
    goalValue.textContent = `/ ${CONFIG.goal}`;
  }
  if (offerValue) {
    offerValue.textContent = CONFIG.offer;
  }
  setPhase("intro");
  runLoop(CONFIG.idleStopMs);

  window[CONFIG.api] = {
    start: startGame,
    end: endGame,
    openOffer,
    show,
    hide
  };
})();
