(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-brick-breaker",        // CustomEvent namespace
    api: "mgBrickBreaker",                  // window.<api> handle
    campaign: "volt-m3",
    offer: "−30%",
    winTitle: "Wall smashed!",
    loseTitle: "Out of balls!",
    goal: 300,                                 // score that counts as a win (clearing the wall also wins)
    maxPlayMs: 45000,                          // hard stop: a session never runs past this
    idleStopMs: 30000                          // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#0a0424",
    skyBottom: "#1c0838",
    grid: "rgba(255, 61, 242, 0.32)",
    horizon: "rgba(255, 61, 242, 0.5)",
    wall: "#3de8ff",
    rows: ["#ff3df2", "#ff8a3d", "#ffe14d", "#4dff9a", "#3dd8ff"],
    steelHi: "#eef2fa",
    steelMid: "#9aa4b8",
    steelLow: "#535d72",
    crack: "rgba(16, 6, 30, 0.85)",
    paddleHi: "#bff8ff",
    paddle: "#2fb4ff",
    paddleLow: "#1440a8",
    paddleCap: "#ff3df2",
    ball: "#ffffff",
    ballGlow: "#3de8ff",
    power: { wide: "#4dff9a", multi: "#ff3df2", slow: "#3dd8ff" },
    lost: "rgba(255, 50, 90, 1)",
    text: "#f1f4ff"
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
  const livesPips = document.querySelectorAll("#livesValue i");
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
    count = Math.min(count, MAX_PARTICLES - particles.length);
    for (let index = 0; index < count; index += 1) {
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

  // Everything game-specific lives here: state, resetGame, update, idle, draw
  // and the input hooks. The shell above and below stays the same per game.
  // Lay out from SAFE / WIDTH / HEIGHT so the game fits every FORMAT.

  // The board is a vertical "field": u across, v from the back wall (0) to
  // the paddle. Popup and rail map it straight onto SAFE; the strip turns it
  // a quarter turn, so the paddle rides the left edge and the wall sits right.
  const VERTICAL = FORMAT !== "strip";
  const FIELD_W = VERTICAL ? SAFE.w : SAFE.h;
  const FIELD_H = VERTICAL ? SAFE.h : SAFE.w;
  const toX = (u, v) => (VERTICAL ? SAFE.x + u : SAFE.x + FIELD_H - v);
  const toY = (u, v) => (VERTICAL ? SAFE.y + v : SAFE.y + u);

  // N = normal (1 hit), T = tough (2 hits), S = steel (3 hits). Rows run from
  // the back wall toward the paddle; points scale so the goal stays the same.
  const LAYOUT = {
    popup: {
      brickW: 32, brickH: 11, gap: 3, brickTop: 16, ceiling: 3,
      rows: ["TSNNNNST", "NTNNNNTN", "NNTNNTNN", "NNNNNNNN", "NNNNNNNN"],
      points: { N: 10, T: 20, S: 50 },
      paddleGap: 20, paddleW: 52, wideW: 80, paddleH: 8, ballR: 4,
      speed: 185, speedMax: 245, speedup: 2,
      powerW: 24, powerH: 11, powerFall: 72,
      dragGain: 1.2, keySpeed: 280, hint: 10, hintGap: 22, horizon: 0.56
    },
    rail: {
      brickW: 16, brickH: 8, gap: 2, brickTop: 12, ceiling: 2,
      rows: ["TSNST", "NTNTN", "NNTNN", "NNNNN", "NNNNN"],
      points: { N: 15, T: 30, S: 60 },
      paddleGap: 16, paddleW: 28, wideW: 42, paddleH: 6, ballR: 3,
      speed: 140, speedMax: 185, speedup: 1.5,
      powerW: 18, powerH: 8, powerFall: 55,
      dragGain: 1.15, keySpeed: 150, hint: 7, hintGap: 16, horizon: 0.56
    },
    strip: {
      brickW: 11, brickH: 20, gap: 2, brickTop: 6, ceiling: 2,
      rows: ["TSST", "NTTN", "NNNN", "NNNN", "NNNN"],
      points: { N: 20, T: 40, S: 75 },
      paddleGap: 10, paddleW: 17, wideW: 25, paddleH: 5, ballR: 2.6,
      speed: 175, speedMax: 225, speedup: 1.6,
      powerW: 17, powerH: 8, powerFall: 70,
      dragGain: 1.3, keySpeed: 110, hint: 7, hintGap: 40, horizon: 0.5
    }
  }[FORMAT];

  const PADDLE_V = FIELD_H - LAYOUT.paddleGap;
  const BALL_R = LAYOUT.ballR;
  const COLS = LAYOUT.rows[0].length;
  const BRICK_W = LAYOUT.brickW;
  const BRICK_H = LAYOUT.brickH;
  const BRICK_LEFT = (FIELD_W - (COLS * BRICK_W + (COLS - 1) * LAYOUT.gap)) / 2;
  const BRICK_HP = { N: 1, T: 2, S: 3 };
  // Power-up capsules always read horizontally on screen.
  const POWER_U = VERTICAL ? LAYOUT.powerW / 2 : LAYOUT.powerH / 2;
  const POWER_V = VERTICAL ? LAYOUT.powerH / 2 : LAYOUT.powerW / 2;
  const PADDLE_EASE = 30;          // follow stiffness: higher = snappier
  const SLOW_FACTOR = 0.68;
  const MIN_VV_RATIO = 0.38;       // never let a ball run near-parallel to the paddle
  const MAX_BOUNCE = 1.05;         // paddle-edge deflection (rad)
  const SUBSTEP = BALL_R / 2;      // max travel between collision checks
  const AUTO_LAUNCH = 3;
  const MAX_BALLS = 6;
  const TRAIL = 8;
  const START_LIVES = 3;
  const WIDE_TIME = 9;
  const SLOW_TIME = 6;
  const FIRST_DROP_AT = 3;         // the 3rd brick broken always drops a power-up
  const DROP_CHANCE = 0.26;
  const POWER_ORDER = ["multi", "wide", "slow"];
  const POWER_POINTS = 15;
  const TAU = Math.PI * 2;

  const makeLayer = (w, h) => {
    const layer = document.createElement("canvas");
    layer.width = Math.max(1, Math.ceil(w * DPR));
    layer.height = Math.max(1, Math.ceil(h * DPR));
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { canvas: layer, g };
  };

  // roundRect() is still missing on older WebViews, so build the path by hand.
  const roundRectPath = (g, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  };

  // Screen box of a field rectangle (reused object, no per-frame garbage).
  const BOX = { x: 0, y: 0, w: 0, h: 0 };
  const toBox = (u, v, w, h) => {
    BOX.x = VERTICAL ? SAFE.x + u : SAFE.x + FIELD_H - v - h;
    BOX.y = VERTICAL ? SAFE.y + v : SAFE.y + u;
    BOX.w = VERTICAL ? w : h;
    BOX.h = VERTICAL ? h : w;
    return BOX;
  };

  const fieldLine = (g, u1, v1, u2, v2) => {
    g.moveTo(toX(u1, v1), toY(u1, v1));
    g.lineTo(toX(u2, v2), toY(u2, v2));
  };

  /* -- Pre-rendered art */

  const backdrop = makeLayer(WIDTH, HEIGHT);
  const brickLayer = makeLayer(WIDTH, HEIGHT);

  const paintBackdrop = () => {
    const g = backdrop.g;
    const sky = g.createLinearGradient(toX(0, 0), toY(0, 0), toX(0, FIELD_H), toY(0, FIELD_H));
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, WIDTH, HEIGHT);

    // Faint dust of stars behind the wall.
    const horizon = FIELD_H * LAYOUT.horizon;
    for (let n = 0; n < Math.round((WIDTH * HEIGHT) / 1900); n += 1) {
      const u = rand(0, FIELD_W);
      const v = rand(0, horizon);
      g.fillStyle = Math.random() < 0.5 ? "rgba(255, 255, 255, 0.5)" : "rgba(160, 220, 255, 0.4)";
      g.fillRect(toX(u, v), toY(u, v), 1, 1);
    }

    // Synthwave floor grid converging on a horizon past the bricks.
    const mid = FIELD_W / 2;
    const glowBand = g.createLinearGradient(toX(0, horizon - 20), toY(0, horizon - 20), toX(0, horizon + 6), toY(0, horizon + 6));
    glowBand.addColorStop(0, "rgba(255, 61, 242, 0)");
    glowBand.addColorStop(1, "rgba(255, 61, 242, 0.22)");
    g.fillStyle = glowBand;
    const band = toBox(0, horizon - 20, FIELD_W, 26);
    g.fillRect(band.x, band.y, band.w, band.h);
    g.lineWidth = 1;
    g.strokeStyle = PALETTE.grid;
    g.beginPath();
    for (let k = -12; k <= 12; k += 1) {
      fieldLine(g, mid + k * FIELD_W * 0.02, horizon, mid + k * FIELD_W * 0.16, FIELD_H + 2);
    }
    for (let k = 1; k <= 9; k += 1) {
      const v = horizon + (FIELD_H - horizon) * (k / 9) ** 2;
      fieldLine(g, -2, v, FIELD_W + 2, v);
    }
    g.stroke();
    g.strokeStyle = PALETTE.horizon;
    g.beginPath();
    fieldLine(g, -2, horizon, FIELD_W + 2, horizon);
    g.stroke();

    // Neon frame: back wall and side rails.
    g.strokeStyle = PALETTE.wall;
    const ceil = LAYOUT.ceiling;
    [[5, 0.12], [2.5, 0.3], [1, 0.9]].forEach(([width, alpha]) => {
      g.globalAlpha = alpha;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(toX(0.5, FIELD_H + 4), toY(0.5, FIELD_H + 4));
      g.lineTo(toX(0.5, ceil), toY(0.5, ceil));
      g.lineTo(toX(FIELD_W - 0.5, ceil), toY(FIELD_W - 0.5, ceil));
      g.lineTo(toX(FIELD_W - 0.5, FIELD_H + 4), toY(FIELD_W - 0.5, FIELD_H + 4));
      g.stroke();
    });
    g.globalAlpha = 1;

    const cx = SAFE.x + SAFE.w / 2;
    const cy = SAFE.y + SAFE.h / 2;
    const reach = Math.max(SAFE.w, SAFE.h) * 0.7;
    const vignette = g.createRadialGradient(cx, cy, reach * 0.4, cx, cy, reach);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    g.fillStyle = vignette;
    g.fillRect(0, 0, WIDTH, HEIGHT);
  };

  paintBackdrop();

  /* -- State */

  // Field coordinates: u across, v toward the paddle (see toX / toY).
  const game = {
    time: 0,
    bricks: [],
    bricksLeft: 0,
    broken: 0,
    dropIndex: 0,
    dirty: true,
    balls: [],
    powers: [],
    pops: [],
    lives: START_LIVES,
    paddleU: FIELD_W / 2,
    paddleW: LAYOUT.paddleW,
    paddleVu: 0,
    targetU: FIELD_W / 2,
    squash: 0,
    wideTimer: 0,
    slowTimer: 0,
    stuckTimer: 0,
    flash: 0,
    cleared: false,
    dragging: false,
    dragId: 0,
    dragStart: 0,
    dragPaddleU: 0,
    keyMinus: false,
    keyPlus: false
  };

  const updateLives = () => {
    livesPips.forEach((pip, index) => {
      pip.classList.toggle("off", index >= game.lives);
    });
  };

  // floatText kept inside the play area so short formats never clip it.
  const say = (x, y, text, color) => {
    floatText(clamp(x, SAFE.x + 26, SAFE.x + SAFE.w - 26), clamp(y, SAFE.y + 8, SAFE.y + SAFE.h - 6), text, color);
  };

  // Two jagged polylines in screen space; the first shows after one hit.
  const makeCracks = (box) => {
    const cracks = [];
    for (let n = 0; n < 2; n += 1) {
      const points = [];
      let x = box.x + rand(box.w * 0.2, box.w * 0.8);
      let y = box.y;
      points.push(x, y);
      while (y < box.y + box.h) {
        x = clamp(x + rand(-0.16, 0.16) * box.w, box.x + 1.5, box.x + box.w - 1.5);
        y = Math.min(box.y + box.h, y + rand(0.25, 0.4) * box.h);
        points.push(x, y);
      }
      cracks.push(points);
    }
    return cracks;
  };

  const buildBricks = () => {
    game.bricks.length = 0;
    LAYOUT.rows.forEach((line, row) => {
      for (let col = 0; col < line.length; col += 1) {
        const kind = line[col];
        const u = BRICK_LEFT + col * (BRICK_W + LAYOUT.gap);
        const v = LAYOUT.brickTop + row * (BRICK_H + LAYOUT.gap);
        game.bricks.push({
          kind,
          u,
          v,
          hp: BRICK_HP[kind],
          maxHp: BRICK_HP[kind],
          color: PALETTE.rows[row % PALETTE.rows.length],
          alive: true,
          flash: 0,
          cracks: makeCracks(toBox(u, v, BRICK_W, BRICK_H))
        });
      }
    });
    game.bricksLeft = game.bricks.length;
    game.dirty = true;
  };

  const makeBall = (u, v, vu, vv, stuck) => {
    const trail = [];
    for (let n = 0; n < TRAIL; n += 1) {
      trail.push({ u, v });
    }
    return { u, v, vu, vv, stuck, trail, head: 0 };
  };

  const stickBall = () => {
    game.balls.length = 0;
    game.balls.push(makeBall(game.paddleU, PADDLE_V - LAYOUT.paddleH / 2 - BALL_R, 0, 0, true));
    game.stuckTimer = 0;
  };

  const resetGame = () => {
    game.time = 0;
    buildBricks();
    game.broken = 0;
    game.dropIndex = 0;
    game.powers.length = 0;
    game.pops.length = 0;
    game.lives = START_LIVES;
    game.paddleU = FIELD_W / 2;
    game.paddleW = LAYOUT.paddleW;
    game.paddleVu = 0;
    game.targetU = FIELD_W / 2;
    game.squash = 0;
    game.wideTimer = 0;
    game.slowTimer = 0;
    game.flash = 0;
    game.cleared = false;
    game.dragging = false;
    game.keyMinus = false;
    game.keyPlus = false;
    stickBall();
    updateLives();
  };

  /* -- Ball physics */

  const ballSpeed = () => {
    const base = Math.min(LAYOUT.speed + (Shell.elapsed / 1000) * LAYOUT.speedup, LAYOUT.speedMax);
    return base * (game.slowTimer > 0 ? SLOW_FACTOR : 1);
  };

  // Rescale to the current speed and keep enough travel toward / away from the paddle.
  const normalizeBall = (ball, speed) => {
    const len = Math.hypot(ball.vu, ball.vv) || 1;
    let vu = (ball.vu / len) * speed;
    let vv = (ball.vv / len) * speed;
    const minVv = speed * MIN_VV_RATIO;
    if (Math.abs(vv) < minVv) {
      vv = (vv < 0 ? -1 : 1) * minVv;
      vu = (vu < 0 ? -1 : 1) * Math.sqrt(speed * speed - minVv * minVv);
    }
    ball.vu = vu;
    ball.vv = vv;
  };

  const launchBall = (ball) => {
    if (!ball.stuck) {
      return;
    }
    const lean = clamp(game.paddleVu / (FIELD_W * 1.3), -0.35, 0.35);
    const angle = lean + rand(-0.3, 0.3);
    const speed = ballSpeed();
    ball.stuck = false;
    ball.vu = Math.sin(angle) * speed;
    ball.vv = -Math.cos(angle) * speed;
    game.squash = 1;
  };

  const overlaps = (ball, u, v, w, h) => {
    const nu = clamp(ball.u, u, u + w);
    const nv = clamp(ball.v, v, v + h);
    const du = ball.u - nu;
    const dv = ball.v - nv;
    return du * du + dv * dv < BALL_R * BALL_R;
  };

  const findBrick = (ball) => {
    for (let index = 0; index < game.bricks.length; index += 1) {
      const brick = game.bricks[index];
      if (brick.alive && overlaps(ball, brick.u, brick.v, BRICK_W, BRICK_H)) {
        return brick;
      }
    }
    return null;
  };

  const dropPower = (brick) => {
    game.broken += 1;
    if (game.powers.length >= 3) {
      return;
    }
    if (game.broken === FIRST_DROP_AT || (game.broken > FIRST_DROP_AT && Math.random() < DROP_CHANCE)) {
      const kind = POWER_ORDER[game.dropIndex % POWER_ORDER.length];
      game.dropIndex += 1;
      game.powers.push({ kind, u: brick.u + BRICK_W / 2, v: brick.v + BRICK_H / 2, age: 0 });
    }
  };

  const damageBrick = (brick, live) => {
    brick.flash = 1;
    if (!live) {
      return;
    }
    brick.hp -= 1;
    game.dirty = true;
    const x = toX(brick.u + BRICK_W / 2, brick.v + BRICK_H / 2);
    const y = toY(brick.u + BRICK_W / 2, brick.v + BRICK_H / 2);
    const steel = brick.kind === "S";
    if (brick.hp > 0) {
      burst(x, y, steel ? PALETTE.steelHi : brick.color, 5, 70);
      return;
    }
    brick.alive = false;
    game.bricksLeft -= 1;
    const points = LAYOUT.points[brick.kind];
    setScore(Shell.score + points);
    say(x, y, `+${points}`, steel ? PALETTE.steelHi : brick.color);
    burst(x, y, steel ? PALETTE.steelMid : brick.color, steel ? 20 : 12, 120);
    game.pops.push({ u: brick.u, v: brick.v, color: steel ? PALETTE.steelHi : brick.color, age: 0 });
    if (steel) {
      shake();
    }
    dropPower(brick);
    if (game.bricksLeft === 0) {
      game.cleared = true;
    }
  };

  const bounceOffPaddle = (ball) => {
    const half = game.paddleW / 2;
    const offset = clamp((ball.u - game.paddleU) / (half + BALL_R), -1, 1);
    const angle = offset * MAX_BOUNCE;
    const speed = Math.hypot(ball.vu, ball.vv);
    ball.vu = Math.sin(angle) * speed;
    ball.vv = -Math.cos(angle) * speed;
    ball.v = PADDLE_V - LAYOUT.paddleH / 2 - BALL_R;
    game.squash = 1;
    burst(toX(ball.u, ball.v), toY(ball.u, ball.v), PALETTE.paddleHi, 4, 60);
  };

  // Axis-separated substeps: a move that ends inside a brick is undone and that
  // velocity component flipped, so a ball can never tunnel or stay embedded.
  const moveBall = (ball, dt, live) => {
    const dist = Math.hypot(ball.vu, ball.vv) * dt;
    const steps = Math.max(1, Math.ceil(dist / SUBSTEP));
    const sdt = dt / steps;
    const ceil = LAYOUT.ceiling + BALL_R;
    for (let step = 0; step < steps; step += 1) {
      ball.u += ball.vu * sdt;
      if (ball.u < BALL_R) {
        ball.u = BALL_R;
        ball.vu = Math.abs(ball.vu);
      } else if (ball.u > FIELD_W - BALL_R) {
        ball.u = FIELD_W - BALL_R;
        ball.vu = -Math.abs(ball.vu);
      }
      let brick = findBrick(ball);
      if (brick) {
        ball.u -= ball.vu * sdt;
        ball.vu = -ball.vu;
        damageBrick(brick, live);
      }

      ball.v += ball.vv * sdt;
      if (ball.v < ceil) {
        ball.v = ceil;
        ball.vv = Math.abs(ball.vv);
      }
      brick = findBrick(ball);
      if (brick) {
        ball.v -= ball.vv * sdt;
        ball.vv = -ball.vv;
        damageBrick(brick, live);
      }

      if (ball.vv > 0 && ball.v < PADDLE_V
        && overlaps(ball, game.paddleU - game.paddleW / 2, PADDLE_V - LAYOUT.paddleH / 2, game.paddleW, LAYOUT.paddleH)) {
        bounceOffPaddle(ball);
      }
      if (ball.v > FIELD_H + BALL_R * 2) {
        return false;
      }
    }
    return true;
  };

  const stepBalls = (dt, live) => {
    const speed = ballSpeed();
    for (let index = game.balls.length - 1; index >= 0; index -= 1) {
      const ball = game.balls[index];
      if (ball.stuck) {
        ball.u = game.paddleU;
        ball.v = PADDLE_V - LAYOUT.paddleH / 2 - BALL_R;
      } else {
        normalizeBall(ball, speed);
        if (!moveBall(ball, dt, live)) {
          game.balls.splice(index, 1);
          continue;
        }
      }
      ball.head = (ball.head + 1) % TRAIL;
      ball.trail[ball.head].u = ball.u;
      ball.trail[ball.head].v = ball.v;
    }
  };

  const loseBall = () => {
    const x = toX(game.paddleU, PADDLE_V);
    const y = toY(game.paddleU, PADDLE_V);
    game.lives -= 1;
    updateLives();
    shake();
    game.flash = reduceMotion ? 0.3 : 1;
    say(x, y - 18, game.lives > 0 ? "BALL LOST" : "GAME OVER", "#ff7a9a");
    burst(x, y, PALETTE.lost, 14, 120);
    if (game.lives <= 0) {
      endGame(false);
      return;
    }
    stickBall();
  };

  /* -- Power-ups */

  const applyPower = (kind, u, v) => {
    const x = toX(u, v);
    const y = toY(u, v);
    setScore(Shell.score + POWER_POINTS);
    burst(x, y, PALETTE.power[kind], 16, 120);
    if (kind === "wide") {
      game.wideTimer = WIDE_TIME;
      say(x, y - 14, "WIDE PADDLE!", PALETTE.power.wide);
    } else if (kind === "slow") {
      game.slowTimer = SLOW_TIME;
      say(x, y - 14, "SLOW BALL!", PALETTE.power.slow);
    } else {
      say(x, y - 14, "MULTIBALL!", PALETTE.power.multi);
      const source = game.balls[0];
      if (!source) {
        return;
      }
      launchBall(source);
      [-0.45, 0.45].forEach((turn) => {
        if (game.balls.length >= MAX_BALLS) {
          return;
        }
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        const vu = source.vu * cos - source.vv * sin;
        const vv = source.vu * sin + source.vv * cos;
        game.balls.push(makeBall(source.u, source.v, vu, vv, false));
      });
    }
  };

  const stepPowers = (dt, live) => {
    for (let index = game.powers.length - 1; index >= 0; index -= 1) {
      const power = game.powers[index];
      power.age += dt;
      power.v += LAYOUT.powerFall * dt;
      if (power.v > FIELD_H + POWER_V * 2) {
        game.powers.splice(index, 1);
        continue;
      }
      if (live && Math.abs(power.u - game.paddleU) < game.paddleW / 2 + POWER_U
        && Math.abs(power.v - PADDLE_V) < LAYOUT.paddleH / 2 + POWER_V) {
        game.powers.splice(index, 1);
        applyPower(power.kind, power.u, power.v);
      }
    }
  };

  /* -- Simulation steps */

  const stepPaddle = (dt) => {
    if (game.keyMinus) {
      game.targetU -= LAYOUT.keySpeed * dt;
    }
    if (game.keyPlus) {
      game.targetU += LAYOUT.keySpeed * dt;
    }
    const wantW = game.wideTimer > 0 ? LAYOUT.wideW : LAYOUT.paddleW;
    game.paddleW += (wantW - game.paddleW) * Math.min(1, dt * 10);
    const half = game.paddleW / 2 + 1;
    game.targetU = clamp(game.targetU, half, FIELD_W - half);
    const prev = game.paddleU;
    game.paddleU += (game.targetU - game.paddleU) * (1 - Math.exp(-PADDLE_EASE * dt));
    game.paddleU = clamp(game.paddleU, half, FIELD_W - half);
    game.paddleVu = (game.paddleU - prev) / dt;
  };

  const stepEffects = (dt) => {
    game.bricks.forEach((brick) => {
      if (brick.flash > 0) {
        brick.flash = Math.max(0, brick.flash - dt * 6);
      }
    });
    for (let index = game.pops.length - 1; index >= 0; index -= 1) {
      game.pops[index].age += dt;
      if (game.pops[index].age > 0.25) {
        game.pops.splice(index, 1);
      }
    }
    game.squash = Math.max(0, game.squash - dt * 6);
    game.flash = Math.max(0, game.flash - dt * 2.5);
  };

  // Runs only in the play phase.
  const update = (dt) => {
    if (dt <= 0) {
      return;
    }
    game.time += dt;
    game.wideTimer = Math.max(0, game.wideTimer - dt);
    game.slowTimer = Math.max(0, game.slowTimer - dt);
    stepPaddle(dt);

    const stuck = game.balls.length === 1 && game.balls[0].stuck;
    if (stuck) {
      game.stuckTimer += dt;
      if (game.stuckTimer >= AUTO_LAUNCH) {
        launchBall(game.balls[0]);
      }
    }
    stepBalls(dt, true);
    stepPowers(dt, true);
    stepEffects(dt);

    if (Shell.score >= CONFIG.goal || game.cleared) {
      endGame(true);
      return;
    }
    if (game.balls.length === 0) {
      loseBall();
    }
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    if (dt <= 0) {
      return;
    }
    game.time += dt;
    if (Shell.phase === "intro") {
      // Demo rally: an auto paddle chases the ball, bricks only flash.
      const ball = game.balls[0];
      if (!ball) {
        stickBall();
      } else if (ball.stuck) {
        launchBall(ball);
      } else {
        game.targetU = ball.u + Math.sin(game.time * 1.7) * game.paddleW * 0.27;
      }
      stepPaddle(dt);
      stepBalls(dt, false);
    }
    stepPowers(dt, false);
    stepEffects(dt);
  };

  /* -- Rendering */

  const paintBricks = () => {
    const g = brickLayer.g;
    g.clearRect(0, 0, WIDTH, HEIGHT);
    game.bricks.forEach((brick) => {
      if (!brick.alive) {
        return;
      }
      const { x, y, w, h } = toBox(brick.u, brick.v, BRICK_W, BRICK_H);
      const unit = Math.min(w, h) / 11;   // detail scale: 1 on the popup brick
      if (brick.kind === "S") {
        const metal = g.createLinearGradient(0, y, 0, y + h);
        metal.addColorStop(0, PALETTE.steelHi);
        metal.addColorStop(0.5, PALETTE.steelMid);
        metal.addColorStop(1, PALETTE.steelLow);
        g.fillStyle = metal;
        roundRectPath(g, x, y, w, h, 2 * unit);
        g.fill();
        g.strokeStyle = "rgba(40, 46, 60, 0.9)";
        g.lineWidth = 1;
        g.stroke();
        g.strokeStyle = "rgba(60, 68, 86, 0.45)";
        g.lineWidth = 2 * unit;
        g.beginPath();
        for (let k = 0; k < 3; k += 1) {
          const sx = x + w * (0.25 + k * 0.22);
          g.moveTo(sx, y + h - 1.5 * unit);
          g.lineTo(sx + 4 * unit, y + 1.5 * unit);
        }
        g.stroke();
        g.fillStyle = "#3e4658";
        const inset = 3 * unit;
        [[inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset]].forEach(([rx, ry]) => {
          g.beginPath();
          g.arc(x + rx, y + ry, 1.3 * unit, 0, TAU);
          g.fill();
        });
        g.fillStyle = "rgba(255, 255, 255, 0.7)";
        g.fillRect(x + 2 * unit, y + unit, w - 4 * unit, unit);
      } else {
        g.globalAlpha = 0.28;
        g.fillStyle = brick.color;
        roundRectPath(g, x - 1.5 * unit, y - 1.5 * unit, w + 3 * unit, h + 3 * unit, 3 * unit);
        g.fill();
        g.globalAlpha = 1;
        const body = g.createLinearGradient(0, y, 0, y + h);
        body.addColorStop(0, "#ffffff");
        body.addColorStop(0.18, brick.color);
        body.addColorStop(1, "rgba(20, 0, 40, 0.9)");
        g.fillStyle = brick.color;
        roundRectPath(g, x, y, w, h, 2 * unit);
        g.fill();
        g.globalAlpha = 0.55;
        g.fillStyle = body;
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = "rgba(255, 255, 255, 0.6)";
        g.fillRect(x + 2.5 * unit, y + 1.5 * unit, w - 5 * unit, 1.3 * unit);
        if (brick.kind === "T") {
          const inset = 3 * unit;
          g.strokeStyle = "rgba(255, 255, 255, 0.75)";
          g.lineWidth = Math.max(0.6, unit);
          g.strokeRect(x + inset, y + inset + 0.5 * unit, w - inset * 2, h - inset * 2);
        }
      }
      const damage = brick.maxHp - brick.hp;
      for (let n = 0; n < Math.min(damage, 2); n += 1) {
        const points = brick.cracks[n];
        [[PALETTE.crack, 1.2, 0], ["rgba(255, 255, 255, 0.45)", 0.6, 0.8]].forEach(([color, width, shift]) => {
          g.strokeStyle = color;
          g.lineWidth = width * Math.max(unit, 0.7);
          g.beginPath();
          g.moveTo(points[0] + shift * unit, points[1]);
          for (let p = 2; p < points.length; p += 2) {
            g.lineTo(points[p] + shift * unit, points[p + 1]);
          }
          g.stroke();
        });
      }
    });
    game.dirty = false;
  };

  const drawBrickFx = () => {
    ctx.fillStyle = "#ffffff";
    game.bricks.forEach((brick) => {
      if (brick.alive && brick.flash > 0) {
        const box = toBox(brick.u, brick.v, BRICK_W, BRICK_H);
        ctx.globalAlpha = brick.flash * 0.7;
        ctx.fillRect(box.x, box.y, box.w, box.h);
      }
    });
    game.pops.forEach((pop) => {
      const t = pop.age / 0.25;
      const grow = t * Math.min(BRICK_W, BRICK_H) * 0.45;
      const box = toBox(pop.u, pop.v, BRICK_W, BRICK_H);
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = pop.color;
      ctx.lineWidth = 2 * (1 - t) + 0.5;
      ctx.strokeRect(box.x - grow, box.y - grow, box.w + grow * 2, box.h + grow * 2);
    });
    ctx.globalAlpha = 1;
  };

  const drawPowers = (time) => {
    const pw = LAYOUT.powerW;
    const ph = LAYOUT.powerH;
    const k = ph / 11;   // icon scale
    game.powers.forEach((power) => {
      const color = PALETTE.power[power.kind];
      const cx = toX(power.u, power.v);
      const cy = toY(power.u, power.v);
      const x = cx - pw / 2;
      const y = cy - ph / 2;
      ctx.globalAlpha = 0.3 + Math.sin(time * 10 + power.age) * 0.1;
      ctx.fillStyle = color;
      roundRectPath(ctx, x - 2 * k, y - 2 * k, pw + 4 * k, ph + 4 * k, ph / 2 + 2 * k);
      ctx.fill();
      ctx.globalAlpha = 1;
      roundRectPath(ctx, x, y, pw, ph, ph / 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(x + 4 * k, y + 1.5 * k, pw - 8 * k, 1.5 * k);
      ctx.fillStyle = "#14002a";
      ctx.strokeStyle = "#14002a";
      ctx.lineWidth = 1.4 * k;
      const iy = cy + 0.5 * k;
      if (power.kind === "wide") {
        ctx.beginPath();
        ctx.moveTo(cx - 7 * k, iy);
        ctx.lineTo(cx + 7 * k, iy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 9 * k, iy);
        ctx.lineTo(cx - 5.5 * k, iy - 3 * k);
        ctx.lineTo(cx - 5.5 * k, iy + 3 * k);
        ctx.moveTo(cx + 9 * k, iy);
        ctx.lineTo(cx + 5.5 * k, iy - 3 * k);
        ctx.lineTo(cx + 5.5 * k, iy + 3 * k);
        ctx.fill();
      } else if (power.kind === "multi") {
        ctx.beginPath();
        [-5.5, 0, 5.5].forEach((dx) => {
          ctx.moveTo(cx + (dx + 2.1) * k, iy);
          ctx.arc(cx + dx * k, iy, 2.1 * k, 0, TAU);
        });
        ctx.fill();
      } else {
        // Hourglass
        ctx.beginPath();
        ctx.moveTo(cx - 3.5 * k, iy - 3.5 * k);
        ctx.lineTo(cx + 3.5 * k, iy - 3.5 * k);
        ctx.lineTo(cx - 3.5 * k, iy + 3.5 * k);
        ctx.lineTo(cx + 3.5 * k, iy + 3.5 * k);
        ctx.closePath();
        ctx.fill();
      }
    });
  };

  const drawPaddle = () => {
    // Squash: thinner across the paddle, a little longer along it.
    const squash = game.squash * 0.35;
    const thick = LAYOUT.paddleH * (1 - squash);
    const long = game.paddleW + squash * 6;
    const box = toBox(game.paddleU - long / 2, PADDLE_V - thick / 2 + squash * 2, long, thick);
    const { x, y, w, h } = box;
    const cap = Math.min(7, long * 0.14);

    ctx.globalAlpha = 0.3;
    ctx.fillStyle = PALETTE.paddle;
    roundRectPath(ctx, x - 3, y - 3, w + 6, h + 6, 6);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Lit from the brick side.
    const body = VERTICAL ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x + w, 0, x, 0);
    body.addColorStop(0, PALETTE.paddleHi);
    body.addColorStop(0.45, PALETTE.paddle);
    body.addColorStop(1, PALETTE.paddleLow);
    ctx.fillStyle = body;
    roundRectPath(ctx, x, y, w, h, Math.min(w, h) / 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.paddleCap;
    if (VERTICAL) {
      roundRectPath(ctx, x, y, cap, h, h / 2);
      ctx.fill();
      roundRectPath(ctx, x + w - cap, y, cap, h, h / 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.fillRect(x + cap + 1, y + h * 0.15, w - cap * 2 - 2, h * 0.16);
    } else {
      roundRectPath(ctx, x, y, w, cap, w / 2);
      ctx.fill();
      roundRectPath(ctx, x, y + h - cap, w, cap, w / 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.fillRect(x + w * 0.69, y + cap + 1, w * 0.16, h - cap * 2 - 2);
    }
  };

  const drawBalls = () => {
    ctx.globalCompositeOperation = "lighter";
    game.balls.forEach((ball) => {
      if (ball.stuck) {
        return;
      }
      for (let n = 1; n < TRAIL; n += 1) {
        const point = ball.trail[(ball.head - n + TRAIL) % TRAIL];
        const k = 1 - n / TRAIL;
        ctx.globalAlpha = k * 0.45;
        ctx.fillStyle = PALETTE.ballGlow;
        ctx.beginPath();
        ctx.arc(toX(point.u, point.v), toY(point.u, point.v), BALL_R * (0.4 + k * 0.6), 0, TAU);
        ctx.fill();
      }
    });
    game.balls.forEach((ball) => {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = PALETTE.ballGlow;
      ctx.beginPath();
      ctx.arc(toX(ball.u, ball.v), toY(ball.u, ball.v), BALL_R * 2.1, 0, TAU);
      ctx.fill();
    });
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.ball;
    game.balls.forEach((ball) => {
      ctx.beginPath();
      ctx.arc(toX(ball.u, ball.v), toY(ball.u, ball.v), BALL_R, 0, TAU);
      ctx.fill();
    });
  };

  const drawLaunchHint = (time) => {
    const ball = game.balls[0];
    if (Shell.phase !== "play" || !ball || !ball.stuck) {
      return;
    }
    const u = clamp(game.paddleU, LAYOUT.hint * 5, FIELD_W - LAYOUT.hint * 5);
    const v = PADDLE_V - LAYOUT.hintGap;
    ctx.globalAlpha = 0.55 + Math.sin(time * 6) * 0.35;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${LAYOUT.hint}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = PALETTE.wall;
    ctx.fillText("TAP TO LAUNCH", toX(u, v), VERTICAL ? toY(u, v) : SAFE.y + SAFE.h / 2);
    ctx.globalAlpha = 1;
  };

  const draw = (time) => {
    if (game.dirty) {
      paintBricks();
    }
    ctx.drawImage(backdrop.canvas, 0, 0, WIDTH, HEIGHT);
    ctx.drawImage(brickLayer.canvas, 0, 0, WIDTH, HEIGHT);
    drawBrickFx();
    drawPowers(time);
    drawPaddle();
    drawBalls();
    drawFx();
    drawLaunchHint(time);

    if (game.flash > 0) {
      // Red glow along the edge the ball escaped through.
      const glow = game.flash * 0.6;
      const edge = toBox(0, FIELD_H - 6, FIELD_W, 6);
      ctx.globalAlpha = glow;
      ctx.fillStyle = PALETTE.lost;
      ctx.fillRect(edge.x, edge.y, edge.w, edge.h);
      ctx.globalAlpha = glow * 0.25;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    }
  };

  /* -- Input */

  // The steering axis: finger x in popup/rail, finger y in the strip.
  const lateral = (point) => (VERTICAL ? point.x : point.y);

  const onPointerDown = (point, event) => {
    // Relative drag: the paddle keeps its place and follows finger travel.
    game.dragging = true;
    game.dragId = event && event.pointerId !== undefined ? event.pointerId : 0;
    game.dragStart = lateral(point);
    game.dragPaddleU = game.targetU;
    const ball = game.balls[0];
    if (ball && ball.stuck) {
      launchBall(ball);
    }
  };

  const onPointerMove = (point, event) => {
    if (!game.dragging || (event && event.pointerId !== undefined && event.pointerId !== game.dragId)) {
      return;
    }
    const half = game.paddleW / 2 + 1;
    const raw = game.dragPaddleU + (lateral(point) - game.dragStart) * LAYOUT.dragGain;
    const next = clamp(raw, half, FIELD_W - half);
    if (next !== raw) {
      // Re-anchor at the wall so reversing direction responds immediately.
      game.dragPaddleU = next;
      game.dragStart = lateral(point);
    }
    game.targetU = next;
  };

  const onPointerUp = (point, event) => {
    if (!event || event.pointerId === undefined || event.pointerId === game.dragId) {
      game.dragging = false;
    }
  };

  const MINUS_KEYS = VERTICAL ? ["ArrowLeft", "a", "A"] : ["ArrowUp", "w", "W"];
  const PLUS_KEYS = VERTICAL ? ["ArrowRight", "d", "D"] : ["ArrowDown", "s", "S"];
  const LAUNCH_KEYS = [" ", "Enter", VERTICAL ? "ArrowUp" : "ArrowRight"];

  const onKey = (key, down) => {
    if (MINUS_KEYS.includes(key)) {
      game.keyMinus = down;
      return true;
    }
    if (PLUS_KEYS.includes(key)) {
      game.keyPlus = down;
      return true;
    }
    if (LAUNCH_KEYS.includes(key)) {
      const ball = game.balls[0];
      if (down && ball && ball.stuck) {
        launchBall(ball);
      }
      return true;
    }
    return key.startsWith("Arrow");
  };

  // Seed the attract scene: a demo rally runs behind the intro panel.
  resetGame();

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
    endEyebrow.textContent = `Score ${Shell.score}`;
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
