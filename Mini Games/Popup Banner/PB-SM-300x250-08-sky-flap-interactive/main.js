(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-sky-flap",           // CustomEvent namespace
    api: "mgSkyFlap",                     // window.<api> handle
    campaign: "zephyr-z2",
    offer: "−20%",
    winTitle: "Sky high!",
    loseTitle: "Crash landing!",
    goal: 8,                              // gates that count as a win (per format below)
    maxPlayMs: 40000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#150936",
    skyMid: "#47196c",
    skyLow: "#b8346f",
    horizon: "#ff8a5c",
    sunTop: "#ffe98a",
    sunBottom: "#ff4f8b",
    sunGlow: "rgba(255, 160, 120, 0.42)",
    star: "#fff4dc",
    farCity: "#3a1862",
    nearCity: "#1c0b34",
    window: ["#ffcf6b", "#ff7ab8", "#7ff6ff"],
    windowOff: "rgba(255, 255, 255, 0.06)",
    tower: ["#21123f", "#3d2a7c", "#140a2a"],
    capBody: "#170b2f",
    neon: "#4ff0d2",
    neonGlow: "rgba(79, 240, 210, 0.22)",
    groundTop: "#2b0f4c",
    groundBottom: "#0f051c",
    groundLine: "#ff4f9a",
    groundGlow: "rgba(255, 79, 154, 0.28)",
    grid: "rgba(255, 110, 190, 0.42)",
    coin: "#ffd23f",
    coinDark: "#d98a0b",
    coinGlow: "rgba(255, 210, 63, 0.25)",
    puff: "rgba(255, 255, 255, 0.85)",
    dust: "#c99be6",
    hintInk: "#2a0618",
    hintBg: "rgba(18, 7, 42, 0.62)",
    bird: {
      light: "#c9f0ff",
      body: "#55b6ff",
      shade: "#2858c4",
      belly: "#f2f9ff",
      wing: "#ffffff",
      wingFold: "#bcd5ff",
      beak: "#ffb02e",
      beakDark: "#e2701c",
      strap: "#7a3a12",
      goggle: "#ff9f1c",
      lens: "#d8fbff",
      eye: "#1a1030",
      scarf: "#ff3f6c",
      blush: "rgba(255, 120, 160, 0.55)"
    },
    text: "#fbefff"
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

  // Everything game-specific lives here: state, resetGame, update, idle, draw
  // and the input hooks. The shell above and below stays the same per game.
  // Lay out from SAFE / WIDTH / HEIGHT so the game fits every FORMAT.

  // Per-format tuning. Rail is a narrow column and strip a 53 px band, so the
  // bird, towers and physics shrink with it. birdX / firstX count from SAFE.x.
  const LAYOUT = {
    popup: {
      scale: 1, font: 12, groundH: 28, birdX: 84, hitR: 7,
      gravity: 760, flapV: -215, maxFall: 330,
      pillarW: 34, capH: 8, spacing: 158, firstX: 250, gap: [75, 65],
      topPad: 20, bottomPad: 16, maxShift: 56, speed: [70, 84], goal: 8
    },
    rail: {
      scale: 0.68, font: 8, groundH: 18, birdX: 28, hitR: 5,
      gravity: 620, flapV: -180, maxFall: 280,
      pillarW: 22, capH: 6, spacing: 112, firstX: 88, gap: [62, 54],
      topPad: 14, bottomPad: 12, maxShift: 44, speed: [46, 54], goal: 8
    },
    strip: {
      scale: 0.5, font: 8, groundH: 4, birdX: 44, hitR: 3.2,
      gravity: 380, flapV: -84, maxFall: 150,
      pillarW: 18, capH: 5, spacing: 120, firstX: 230, gap: [29, 26],
      topPad: 7, bottomPad: 5, maxShift: 10, speed: [62, 70], goal: 10
    }
  }[FORMAT];

  CONFIG.goal = LAYOUT.goal;

  const TAU = Math.PI * 2;
  const STEP = 1 / 120;                  // fixed physics step: same arc at 30, 60 or 144 fps
  const S = LAYOUT.scale;
  const GROUND_Y = HEIGHT - LAYOUT.groundH;
  const FLAP_H = (LAYOUT.flapV * LAYOUT.flapV) / (2 * LAYOUT.gravity);  // rise of one flap
  const BIRD = {
    x: SAFE.x + LAYOUT.birdX,
    readyY: (SAFE.y + GROUND_Y) / 2 - 6 * S,
    r: 11 * S,
    hitR: LAYOUT.hitR,
    gravity: LAYOUT.gravity,
    flapV: LAYOUT.flapV,
    maxFall: LAYOUT.maxFall,
    ceiling: Math.max(SAFE.y - 6, 11 * S * 0.6)
  };
  const PILLAR = {
    w: LAYOUT.pillarW,
    capH: LAYOUT.capH,
    spacing: LAYOUT.spacing,             // px between pairs (~2 s at cruise speed)
    firstX: SAFE.x + LAYOUT.firstX,
    gapStart: LAYOUT.gap[0],
    gapEnd: LAYOUT.gap[1],
    shrinkOver: 9,                       // pairs until the gap reaches gapEnd
    topMin: SAFE.y + LAYOUT.topPad,      // gap top never rises into the HUD
    bottomMax: GROUND_Y - LAYOUT.bottomPad,
    maxShift: LAYOUT.maxShift            // max gap-center change between pairs
  };
  const SPEED = { start: LAYOUT.speed[0], end: LAYOUT.speed[1] };
  const COIN = { r: Math.max(3, 5.5 * S), chance: 0.55 };
  const COIN_GRAB = BIRD.hitR + COIN.r + 0.5;
  const READY_HOLD = 6;                  // s the clock waits for the first flap
  const DEATH_DELAY = 1.2;               // s of tumble before the end card
  const FAR = { h: GROUND_Y * 0.43, parallax: 0.12 };
  const NEAR = { h: GROUND_Y * 0.29, parallax: 0.35 };
  const SUN = { r: Math.min(46, WIDTH * 0.26, GROUND_Y * 0.4) };
  const GRID = 20 * Math.max(0.5, S);    // ground stripe period
  const FX = Math.max(0.55, S);          // particle speed scale

  FAR.y = GROUND_Y - FAR.h;
  NEAR.y = GROUND_Y - NEAR.h;
  SUN.x = WIDTH * 0.68;
  SUN.y = GROUND_Y - SUN.r * 1.55;

  const lerp = (a, b, t) => a + (b - a) * t;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const makeCanvas = (w, h, paint) => {
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(w * DPR);
    layer.height = Math.ceil(h * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    paint(g, w, h);
    return layer;
  };

  const pillPath = (g, x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  // Tileable skyline: blocks that cross the right edge are repeated at -w.
  const paintSkyline = (g, w, h, o) => {
    const win = Math.max(0.6, S);
    for (let x = 0; x < w;) {
      const bw = rand(o.minW, o.maxW) * S;
      const bh = rand(o.minH, o.maxH) * h;
      const top = h - bh;
      const shifts = x + bw > w ? [0, -w] : [0];
      g.globalAlpha = 1;
      g.fillStyle = o.color;
      shifts.forEach((s) => {
        g.fillRect(x + s, top, bw, bh);
        if (bh > o.maxH * h * 0.8) {
          g.fillRect(x + s + bw / 2 - 0.75 * win, top - 9 * win, 1.5 * win, 9 * win);
        }
      });
      if (o.roof && Math.random() < 0.3) {
        g.fillStyle = pick(PALETTE.window);
        g.globalAlpha = 0.75;
        shifts.forEach((s) => g.fillRect(x + s + 2 * win, top - 1.5 * win, bw - 4 * win, 1.5 * win));
      }
      for (let wy = top + 5 * win; wy < h - 4 * win; wy += 6 * win) {
        for (let wx = x + 3 * win; wx < x + bw - 3 * win; wx += 5 * win) {
          if (Math.random() < o.lit) {
            g.fillStyle = pick(PALETTE.window);
            g.globalAlpha = rand(0.3, o.glow);
            shifts.forEach((s) => g.fillRect(wx + s, wy, 2 * win, 2.4 * win));
          }
        }
      }
      x += bw + rand(0, 4) * S;
    }
    g.globalAlpha = 1;
  };

  const skyLayer = makeCanvas(WIDTH, GROUND_Y, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.45, PALETTE.skyMid);
    sky.addColorStop(0.8, PALETTE.skyLow);
    sky.addColorStop(1, PALETTE.horizon);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = PALETTE.star;
    const stars = Math.round((w * h) / 1400);
    for (let index = 0; index < stars; index += 1) {
      const size = rand(0.6, 1.4) * Math.max(0.7, S);
      g.globalAlpha = rand(0.2, 0.8);
      g.fillRect(rand(0, w), rand(0, h * 0.53), size, size);
    }
    g.globalAlpha = 1;
    const glow = g.createRadialGradient(SUN.x, SUN.y, SUN.r * 0.4, SUN.x, SUN.y, SUN.r * 2.6);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, "rgba(255, 120, 160, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    // Sun painted on its own canvas so the retro stripes can be punched out.
    const size = SUN.r * 2 + 8;
    const sun = makeCanvas(size, size, (s) => {
      const mid = size / 2;
      const fill = s.createLinearGradient(0, mid - SUN.r, 0, mid + SUN.r);
      fill.addColorStop(0, PALETTE.sunTop);
      fill.addColorStop(1, PALETTE.sunBottom);
      s.fillStyle = fill;
      s.beginPath();
      s.arc(mid, mid, SUN.r, 0, TAU);
      s.fill();
      s.globalCompositeOperation = "destination-out";
      const band = SUN.r / 46;
      for (let k = 0; k < 7; k += 1) {
        s.fillRect(0, mid + 5 * band + k * 6.5 * band, size, (1 + k * 0.6) * band);
      }
    });
    g.drawImage(sun, SUN.x - size / 2, SUN.y - size / 2, size, size);
  });

  const farLayer = makeCanvas(WIDTH, FAR.h, (g, w, h) => {
    paintSkyline(g, w, h, { color: PALETTE.farCity, minW: 16, maxW: 34, minH: 0.29, maxH: 0.9, lit: 0.1, glow: 0.55, roof: false });
  });

  const nearLayer = makeCanvas(WIDTH, NEAR.h, (g, w, h) => {
    paintSkyline(g, w, h, { color: PALETTE.nearCity, minW: 12, maxW: 26, minH: 0.25, maxH: 0.84, lit: 0.24, glow: 0.9, roof: true });
  });

  const towerTex = makeCanvas(PILLAR.w, GROUND_Y, (g, w, h) => {
    const body = g.createLinearGradient(0, 0, w, 0);
    body.addColorStop(0, PALETTE.tower[0]);
    body.addColorStop(0.35, PALETTE.tower[1]);
    body.addColorStop(1, PALETTE.tower[2]);
    g.fillStyle = body;
    g.fillRect(0, 0, w, h);
    // three window columns scaled to the tower width
    const ww = w * 0.18;
    const wh = ww * 0.66;
    for (let y = wh * 1.2; y < h - wh; y += wh * 2.2) {
      for (let col = 0; col < 3; col += 1) {
        const lit = Math.random() < 0.42;
        g.globalAlpha = lit ? rand(0.55, 0.95) : 1;
        g.fillStyle = lit ? pick(PALETTE.window) : PALETTE.windowOff;
        g.fillRect(w * 0.15 + col * w * 0.265, y, ww, wh);
      }
    }
    const edge = Math.max(1, w * 0.045);
    g.fillStyle = PALETTE.neon;
    g.globalAlpha = 0.85;
    g.fillRect(0, 0, edge, h);
    g.globalAlpha = 0.35;
    g.fillRect(w - edge, 0, edge, h);
    g.globalAlpha = 1;
  });

  // Whole stripe periods wider than the ad, scrolled by drawing at -(scroll % GRID).
  const GROUND_W = Math.ceil(WIDTH / GRID + 1) * GRID;
  const groundTex = makeCanvas(GROUND_W, LAYOUT.groundH, (g, w, h) => {
    const fill = g.createLinearGradient(0, 0, 0, h);
    fill.addColorStop(0, PALETTE.groundTop);
    fill.addColorStop(1, PALETTE.groundBottom);
    g.fillStyle = fill;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = PALETTE.grid;
    g.lineWidth = Math.max(0.6, S);
    g.beginPath();
    for (let x = 0; x <= w; x += GRID) {
      g.moveTo(x, 2);
      g.lineTo(x - GRID / 2, h);
    }
    if (h > 10) {
      [0.29, 0.54, 0.82].forEach((f) => {
        g.moveTo(0, h * f);
        g.lineTo(w, h * f);
      });
    }
    g.stroke();
    g.fillStyle = PALETTE.groundLine;
    g.fillRect(0, 0, w, Math.max(1, 2 * S));
  });

  const twinkles = Array.from({ length: Math.max(3, Math.round(WIDTH / 43)) }, () => ({
    x: rand(SAFE.x + 6, WIDTH - 6),
    y: rand(SAFE.y + 6, Math.max(SAFE.y + 8, GROUND_Y * 0.45)),
    phase: rand(0, TAU)
  }));

  const newBird = () => ({
    y: BIRD.readyY,
    vy: 0,
    rot: 0,
    flap: 0,          // squash/stretch pulse, 1 right after a flap
    wing: 0,          // wing cycle phase
    blink: 0,
    blinkIn: 2.4,
    spinV: 0,
    grounded: false
  });

  const game = {
    mode: "demo",     // demo | ready | fly | dead | won
    t: 0,
    acc: 0,
    scroll: 0,
    speed: SPEED.start,
    spawned: 0,
    passed: 0,
    lastGapY: BIRD.readyY,
    pillars: [],
    coins: 0,
    flash: 0,
    deadT: 0,
    readyT: 0,
    bird: newBird()
  };

  const textAt = (x, y, text, color) => {
    floatText(clamp(x, SAFE.x + 22, SAFE.x + SAFE.w - 22), Math.max(SAFE.y + 10, y), text, color);
  };

  const spawnPillar = (x, gapY) => {
    const index = game.spawned;
    const gap = lerp(PILLAR.gapStart, PILLAR.gapEnd, Math.min(1, index / PILLAR.shrinkOver));
    const lo = PILLAR.topMin + gap / 2;
    const hi = Math.max(lo, PILLAR.bottomMax - gap / 2);
    const y = gapY === undefined
      ? rand(clamp(game.lastGapY - PILLAR.maxShift, lo, hi), clamp(game.lastGapY + PILLAR.maxShift, lo, hi))
      : clamp(gapY, lo, hi);
    game.spawned += 1;
    game.lastGapY = y;
    game.pillars.push({ x, gapY: y, gap, passed: false, flash: 0, coin: index > 0 && Math.random() < COIN.chance });
  };

  const resetWorld = () => {
    game.pillars.length = 0;
    game.acc = 0;
    game.scroll = 0;
    game.speed = SPEED.start;
    game.spawned = 0;
    game.passed = 0;
    game.lastGapY = BIRD.readyY;
    game.flash = 0;
    game.deadT = 0;
    game.readyT = 0;
    game.bird = newBird();
  };

  const startDemo = () => {
    resetWorld();
    game.mode = "demo";
    spawnPillar(SAFE.x + SAFE.w * 0.75, BIRD.readyY);
  };

  const resetGame = () => {
    resetWorld();
    game.mode = "ready";
    game.coins = 0;
    // First pair is already on screen but frozen until the first flap.
    spawnPillar(PILLAR.firstX, BIRD.readyY + rand(-0.3, 0.3) * PILLAR.maxShift);
  };

  const flap = () => {
    const b = game.bird;
    b.vy = BIRD.flapV;
    b.flap = 1;
    burst(BIRD.x - BIRD.r, b.y + BIRD.r * 0.45, PALETTE.puff, 3, 40 * FX);
  };

  const flapInput = () => {
    if (game.mode === "ready") {
      game.mode = "fly";
      Shell.elapsed = 0;
    }
    if (game.mode === "fly") {
      flap();
    }
  };

  // The HUD has no room for coins in every format, so the end card tallies them.
  const finish = (won) => {
    endGame(won);
    if (game.coins && Shell.phase === "end") {
      endEyebrow.textContent = `Score ${Shell.score} · ${game.coins} coin${game.coins > 1 ? "s" : ""}`;
    }
  };

  const crash = () => {
    const b = game.bird;
    game.mode = "dead";
    game.deadT = 0;
    game.flash = reduceMotion ? 0.35 : 1;
    b.vy = Math.min(b.vy, 0) + BIRD.flapV * 0.65;  // small hop so the hit reads before the fall
    b.spinV = 9;
    b.flap = 0;
    burst(BIRD.x, b.y, PALETTE.bird.body, 14, 110 * FX);
    burst(BIRD.x, b.y, PALETTE.bird.belly, 8, 80 * FX);
    textAt(BIRD.x, b.y - BIRD.r - 7, "BONK!", PALETTE.bird.scarf);
    shake();
  };

  const win = () => {
    const b = game.bird;
    game.mode = "won";
    [PALETTE.neon, PALETTE.coin, PALETTE.bird.scarf].forEach((color) => burst(BIRD.x, b.y, color, 14, 130 * FX));
    finish(true);
  };

  const hitsRect = (cx, cy, r, x, y, w, h) => {
    const nx = clamp(cx, x, x + w);
    const ny = clamp(cy, y, y + h);
    return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
  };

  const stepAnim = (h) => {
    const b = game.bird;
    b.flap = Math.max(0, b.flap - h * 6);
    b.wing += h * (b.flap > 0 ? 30 : game.mode === "ready" ? 15 : b.vy < 0 ? 18 : 9);
    b.blinkIn -= h;
    if (b.blinkIn <= 0) {
      b.blink = 0.13;
      b.blinkIn = rand(1.8, 3.6);
    }
    b.blink = Math.max(0, b.blink - h);
    game.flash = Math.max(0, game.flash - h * 3);
  };

  const hover = () => {
    const b = game.bird;
    b.y = BIRD.readyY + Math.sin(game.t * 3.4) * 5 * S;
    b.vy = 0;
    b.rot = -Math.cos(game.t * 3.4) * 0.06;
  };

  const stepWorld = (h) => {
    const dx = game.speed * h;
    game.scroll += dx;
    game.pillars.forEach((p) => {
      p.x -= dx;
      p.flash = Math.max(0, p.flash - h * 3);
    });
    if (game.pillars.length && game.pillars[0].x < -PILLAR.w - 14) {
      game.pillars.shift();
    }
    const last = game.pillars[game.pillars.length - 1];
    if (!last) {
      spawnPillar(WIDTH + 30);
    } else if (last.x + PILLAR.spacing < WIDTH + 40) {
      spawnPillar(last.x + PILLAR.spacing);
    }
  };

  const autopilot = () => {
    const b = game.bird;
    const next = game.pillars.find((p) => p.x + PILLAR.w > BIRD.x - BIRD.r);
    // Flap from just under the gap center so each arc straddles the middle.
    const target = next && next.x < WIDTH ? next.gapY + FLAP_H * 0.47 : BIRD.readyY;
    if (b.y > target && b.vy > 20 * S) {
      flap();
    }
  };

  const stepBird = (h, scoring) => {
    const b = game.bird;
    b.vy = Math.min(b.vy + BIRD.gravity * h, BIRD.maxFall);
    b.y += b.vy * h;
    if (b.y < BIRD.ceiling) {
      b.y = BIRD.ceiling;
      b.vy = Math.max(b.vy, 0);
    }
    if (!scoring && b.y > GROUND_Y - BIRD.r) {
      b.y = GROUND_Y - BIRD.r;
      b.vy = 0;
    }
    const tilt = clamp(b.vy / (BIRD.maxFall * 1.27), -0.42, 1.15);
    b.rot += (tilt - b.rot) * Math.min(1, h * 9);
  };

  const checkHits = () => {
    const b = game.bird;
    if (b.y + BIRD.hitR >= GROUND_Y) {
      return true;
    }
    for (let index = 0; index < game.pillars.length; index += 1) {
      const p = game.pillars[index];
      const top = p.gapY - p.gap / 2;
      const bottom = p.gapY + p.gap / 2;
      if (hitsRect(BIRD.x, b.y, BIRD.hitR, p.x, -100, PILLAR.w, top + 100)
        || hitsRect(BIRD.x, b.y, BIRD.hitR, p.x, bottom, PILLAR.w, GROUND_Y - bottom + 40)) {
        return true;
      }
    }
    return false;
  };

  const checkCoins = (scoring) => {
    const b = game.bird;
    game.pillars.forEach((p) => {
      const cx = p.x + PILLAR.w / 2;
      if (p.coin && Math.hypot(cx - BIRD.x, p.gapY - b.y) < COIN_GRAB) {
        p.coin = false;
        burst(cx, p.gapY, PALETTE.coin, 10, 80 * FX);
        if (scoring) {
          game.coins += 1;
          textAt(BIRD.x + 8 * S, b.y - BIRD.r - 15 * S, "+1 COIN", PALETTE.coin);
        }
      }
    });
  };

  const checkPass = (scoring) => {
    game.pillars.forEach((p) => {
      if (p.passed || p.x + PILLAR.w >= BIRD.x - BIRD.hitR) {
        return;
      }
      p.passed = true;
      p.flash = 1;
      game.passed += 1;
      game.speed = lerp(SPEED.start, SPEED.end, Math.min(1, game.passed / CONFIG.goal));
      if (!scoring || Shell.phase !== "play") {
        return;
      }
      const cx = p.x + PILLAR.w / 2;
      burst(cx, p.gapY - p.gap / 2, PALETTE.neon, 8, 70 * FX);
      burst(cx, p.gapY + p.gap / 2, PALETTE.neon, 8, 70 * FX);
      textAt(BIRD.x, game.bird.y - BIRD.r - 7, "+1", PALETTE.neon);
      setScore(Shell.score + 1);
      if (Shell.score >= CONFIG.goal) {
        win();
      }
    });
  };

  const stepDead = (h) => {
    const b = game.bird;
    game.deadT += h;
    if (!b.grounded) {
      b.vy = Math.min(b.vy + BIRD.gravity * h, BIRD.maxFall);
      b.y = Math.max(BIRD.r * 0.4, b.y + b.vy * h);
      b.rot += b.spinV * h;
      const floor = GROUND_Y - BIRD.r * 0.8;
      if (b.y >= floor) {
        b.y = floor;
        if (b.vy > BIRD.maxFall * 0.42) {
          b.vy *= -0.32;
          b.spinV *= 0.5;
          burst(BIRD.x, GROUND_Y - 2, PALETTE.dust, 6, 50 * FX);
        } else {
          b.vy = 0;
          b.spinV = 0;
          b.grounded = true;
        }
      }
    }
    if (Shell.phase === "play" && game.deadT >= DEATH_DELAY) {
      finish(false);
    }
  };

  const stepOnce = (h, auto) => {
    stepAnim(h);
    if (game.mode === "ready") {
      hover();
      return;
    }
    if (game.mode === "dead") {
      stepDead(h);
      return;
    }
    const scoring = !auto && game.mode === "fly";
    stepWorld(h);
    if (!scoring) {
      autopilot();
    }
    stepBird(h, scoring);
    if (scoring && checkHits()) {
      crash();
      return;
    }
    checkCoins(scoring);
    checkPass(scoring);
  };

  const advance = (dt, auto) => {
    game.acc = Math.min(game.acc + dt, 0.1);
    while (game.acc >= STEP) {
      game.acc -= STEP;
      stepOnce(STEP, auto);
    }
  };

  // Runs only in the play phase.
  const update = (dt) => {
    game.t += dt;
    if (game.mode === "ready") {
      game.readyT += dt;
      // The clock starts on the first flap, unless the player idles too long.
      if (game.readyT < READY_HOLD) {
        Shell.elapsed = 0;
      }
    }
    advance(dt, false);
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    game.t += dt;
    advance(dt, true);
  };

  const drawStrip = (layer, cfg) => {
    const offset = -((game.scroll * cfg.parallax) % WIDTH);
    ctx.drawImage(layer, offset, cfg.y, WIDTH, cfg.h);
    ctx.drawImage(layer, offset + WIDTH, cfg.y, WIDTH, cfg.h);
  };

  const drawTower = (x, y, h) => {
    if (h <= 0) {
      return;
    }
    const sh = Math.min(h, GROUND_Y);
    ctx.drawImage(towerTex, 0, 0, PILLAR.w * DPR, sh * DPR, x, y, PILLAR.w, sh);
  };

  const drawCap = (x, y, flash) => {
    const lip = PILLAR.capH * 0.375;
    const w = PILLAR.w + lip * 2;
    const c = PILLAR.capH / 8;
    ctx.fillStyle = PALETTE.neonGlow;
    ctx.fillRect(x - lip - 4 * c, y - 3 * c, w + 8 * c, PILLAR.capH + 6 * c);
    ctx.fillStyle = PALETTE.capBody;
    ctx.fillRect(x - lip, y, w, PILLAR.capH);
    ctx.fillStyle = PALETTE.neon;
    ctx.fillRect(x - lip, y + 2.5 * c, w, 3 * c);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(x - lip, y + 3.5 * c, w, c);
    if (flash > 0) {
      ctx.globalAlpha = flash;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - lip, y, w, PILLAR.capH);
      ctx.globalAlpha = 1;
    }
  };

  const drawCoin = (x, y, phase) => {
    const r = COIN.r;
    const turn = Math.max(0.18, Math.abs(Math.cos(game.t * 4 + phase)));
    ctx.fillStyle = PALETTE.coinGlow;
    ctx.beginPath();
    ctx.arc(x, y, r * (1.7 + Math.sin(game.t * 6) * 0.15), 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.coinDark;
    ctx.beginPath();
    ctx.ellipse(x, y, r * turn, r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.coin;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.1 * turn, y - r * 0.05, r * 0.76 * turn, r * 0.76, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(x - r * 0.33 * turn, y - r * 0.55, r * 0.22 * turn, r * 0.64);
  };

  const drawPillar = (p) => {
    if (p.x > WIDTH + 10 || p.x < -PILLAR.w - 10) {
      return;
    }
    const top = p.gapY - p.gap / 2;
    const bottom = p.gapY + p.gap / 2;
    const shade = PILLAR.capH / 2;
    drawTower(p.x, 0, top - PILLAR.capH);
    drawTower(p.x, bottom + PILLAR.capH, GROUND_Y - bottom - PILLAR.capH);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(p.x, top - PILLAR.capH - shade, PILLAR.w, shade);
    ctx.fillRect(p.x, bottom + PILLAR.capH, PILLAR.w, shade);
    drawCap(p.x, top - PILLAR.capH, p.flash);
    drawCap(p.x, bottom, p.flash);
    if (p.coin) {
      drawCoin(p.x + PILLAR.w / 2, p.gapY, p.gapY);
    }
  };

  // Bird art is authored at popup size (radius 11) and scaled per format.
  const drawBird = (b) => {
    const P = PALETTE.bird;
    const dead = game.mode === "dead";
    const s = b.flap;
    const wingA = dead ? Math.sin(game.t * 18) * 0.25 : Math.sin(b.wing) * 0.8;
    ctx.save();
    ctx.translate(BIRD.x, b.y);
    ctx.rotate(b.rot);
    ctx.scale(S * (1 - s * 0.1), S * (1 + s * 0.12));

    // scarf tails trail behind and ripple with speed
    const wave = Math.sin(game.t * 16) * 2.2;
    ctx.fillStyle = P.scarf;
    ctx.beginPath();
    ctx.moveTo(-6, 3);
    ctx.quadraticCurveTo(-13, 2 + wave, -22, 4 - wave);
    ctx.lineTo(-21, 8.5 - wave);
    ctx.quadraticCurveTo(-13, 8 + wave, -5, 8);
    ctx.closePath();
    ctx.fill();

    // tail feathers
    ctx.fillStyle = P.shade;
    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.lineTo(-16, -7);
    ctx.lineTo(-13.5, -1);
    ctx.lineTo(-16, 3);
    ctx.lineTo(-8, 3);
    ctx.closePath();
    ctx.fill();

    // round body with a soft top-left light
    const body = ctx.createRadialGradient(-3, -5, 1, 0, 0, 12);
    body.addColorStop(0, P.light);
    body.addColorStop(0.55, P.body);
    body.addColorStop(1, P.shade);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();

    ctx.fillStyle = P.belly;
    ctx.beginPath();
    ctx.ellipse(2.5, 4.5, 7, 5, -0.2, 0, TAU);
    ctx.fill();

    ctx.fillStyle = P.blush;
    ctx.beginPath();
    ctx.ellipse(6.5, 2.5, 2.2, 1.4, 0, 0, TAU);
    ctx.fill();

    // scarf knot where the tails leave the body
    ctx.fillStyle = P.scarf;
    ctx.beginPath();
    ctx.ellipse(-7.5, 5, 3.2, 2.6, 0.4, 0, TAU);
    ctx.fill();

    // goggle strap and lens
    ctx.strokeStyle = P.strap;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 9.6, -2.5, -0.95);
    ctx.stroke();
    ctx.fillStyle = P.goggle;
    ctx.beginPath();
    ctx.arc(5.2, -4.6, 4.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = P.lens;
    ctx.beginPath();
    ctx.arc(5.4, -4.6, 3.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.eye;
    ctx.fillStyle = P.eye;
    ctx.lineWidth = 1.2;
    if (dead) {
      ctx.beginPath();
      ctx.moveTo(4.2, -5.8);
      ctx.lineTo(6.8, -3.4);
      ctx.moveTo(6.8, -5.8);
      ctx.lineTo(4.2, -3.4);
      ctx.stroke();
    } else if (b.blink > 0) {
      ctx.beginPath();
      ctx.moveTo(4, -4.4);
      ctx.lineTo(7.4, -4.4);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(6.2, -4.4, 1.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(4.4, -6, 0.9, 0, TAU);
      ctx.fill();
    }

    // beak opens a touch on each flap
    const open = s * 2.2;
    ctx.fillStyle = P.beak;
    ctx.beginPath();
    ctx.moveTo(8.5, -1.5);
    ctx.lineTo(16, 1);
    ctx.lineTo(9, 2.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.beakDark;
    ctx.beginPath();
    ctx.moveTo(9, 2.6);
    ctx.lineTo(14.5, 2.4 + open);
    ctx.lineTo(8.5, 5);
    ctx.closePath();
    ctx.fill();

    // folded paper-plane wing hinged at the shoulder
    ctx.save();
    ctx.translate(-2, 1.5);
    ctx.rotate(-wingA);
    ctx.fillStyle = P.wing;
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.lineTo(-12, -6);
    ctx.lineTo(-6, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.wingFold;
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.lineTo(-6, 2);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  const drawCaption = (text, x, y, size) => {
    ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + size * 2;
    const h = size * 2;
    ctx.fillStyle = PALETTE.hintBg;
    pillPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(text, x, y + size * 0.05);
  };

  const drawHint = () => {
    const b = game.bird;
    const f = LAYOUT.font;
    const pulse = reduceMotion ? 1 : 1 + Math.sin(game.t * 7) * 0.07;
    const bw = f * 3.5;
    const bh = f * 1.65;
    ctx.save();
    ctx.translate(BIRD.x + BIRD.r + bw * 0.55, Math.max(SAFE.y + bh * 0.6, b.y - BIRD.r - bh * 0.4));
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    pillPath(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-bw * 0.36, bh * 0.3);
    ctx.lineTo(-bw * 0.57, bh * 0.75);
    ctx.lineTo(-bw * 0.14, bh * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.hintInk;
    ctx.font = `900 ${f}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TAP!", 0, f * 0.08);
    ctx.restore();

    if (FORMAT === "popup") {
      drawCaption("TAP · CLICK · SPACE TO FLAP", WIDTH / 2, GROUND_Y - 19, 9);
    } else if (FORMAT === "rail") {
      drawCaption("TAP TO FLAP", SAFE.x + SAFE.w / 2, GROUND_Y - 14, 7.5);
    } else {
      drawCaption("TAP · SPACE TO FLAP", (BIRD.x + PILLAR.firstX) / 2 + 8, GROUND_Y - 9, 7.5);
    }
  };

  const draw = () => {
    ctx.drawImage(skyLayer, 0, 0, WIDTH, GROUND_Y);
    ctx.fillStyle = PALETTE.star;
    const tw = 1.5 * Math.max(0.7, S);
    twinkles.forEach((s) => {
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(game.t * 1.6 + s.phase));
      ctx.fillRect(s.x - tw, s.y - tw * 0.27, tw * 2, tw * 0.54);
      ctx.fillRect(s.x - tw * 0.27, s.y - tw, tw * 0.54, tw * 2);
    });
    ctx.globalAlpha = 1;
    drawStrip(farLayer, FAR);
    drawStrip(nearLayer, NEAR);

    game.pillars.forEach(drawPillar);

    ctx.drawImage(groundTex, -(game.scroll % GRID), GROUND_Y, GROUND_W, LAYOUT.groundH);
    ctx.fillStyle = PALETTE.groundGlow;
    ctx.fillRect(0, GROUND_Y - 4 * S, WIDTH, 4 * S);

    drawBird(game.bird);
    drawFx();

    if (game.flash > 0) {
      ctx.globalAlpha = game.flash * 0.55;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    }
    if (game.mode === "ready" && Shell.phase === "play") {
      drawHint();
    }
  };

  const onPointerDown = () => {
    flapInput();
  };

  const onPointerMove = () => {};
  const onPointerUp = () => {};

  const FLAP_KEYS = [" ", "Spacebar", "ArrowUp", "w", "W", "Enter"];

  // Return true to swallow the key.
  const onKey = (key, down, event) => {
    if (FLAP_KEYS.indexOf(key) === -1) {
      return false;
    }
    if (down && !(event && event.repeat)) {
      flapInput();
    }
    return true;
  };

  startDemo();

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
