(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-hen-raiders",        // CustomEvent namespace
    api: "mgHenRaiders",                  // window.<api> handle
    campaign: "orbit-z2",
    offer: "−20%",
    winTitle: "Coop cleared!",
    loseTitle: "Scrambled!",
    goal: 2,                              // waves to clear for a win
    maxPlayMs: 60000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#0c0624",
    skyMid: "#1a0e44",
    skyBottom: "#341552",
    nebulaA: "rgba(255, 86, 170, 0.17)",
    nebulaB: "rgba(70, 150, 255, 0.15)",
    nebulaC: "rgba(150, 90, 255, 0.14)",
    planet: "#ff9f6e",
    planetDark: "#6b2a6e",
    ring: "rgba(255, 214, 170, 0.5)",
    groundTop: "#6c5ca8",
    groundBottom: "#251a4a",
    groundRim: "rgba(214, 196, 255, 0.7)",
    crater: "rgba(24, 14, 48, 0.55)",
    henBody: "#f6f1e8",
    henShade: "#c7bba9",
    henLine: "#4a3428",
    comb: "#e8262f",
    combHi: "#ff6a5a",
    beak: "#ffb21e",
    beakDark: "#e2780c",
    cheek: "rgba(255, 120, 150, 0.55)",
    egg: "#fff7ea",
    eggShade: "#cdb999",
    yolk: "#ffc21a",
    hullHi: "#f2f6ff",
    hullDark: "#7486ad",
    wing: "#2346a8",
    wingHi: "#4f8dff",
    shipLine: "#0d1638",
    shipAccent: "#ff4d5e",
    glass: "#0d4f86",
    glassHi: "#a8f4ff",
    flame: "#ff8a2a",
    flameCore: "#fff3b0",
    laser: "#fff6a8",
    laserGlow: "rgba(255, 196, 40, 0.38)",
    power: "#5ff2ff",
    feather: "#ffffff",
    drum: "#c9692c",
    drumDark: "#7c3a14",
    drumHi: "#f2a464",
    bone: "#fff2d6",
    gift: "#9b5cff",
    giftDark: "#5b31c4",
    ribbon: "#ffd23f",
    helmet: "#8d9ab0",
    helmetDark: "#4b566c",
    helmetHi: "#dfe7f3",
    hurt: "rgba(255, 60, 60, 1)",
    text: "#fff6e0"
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
  const waveValue = document.getElementById("waveValue");
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

  // The game runs in a vertical "field": u across, v from the flock's side
  // (0) down to the ship. Popup and rail map it straight onto SAFE; the strip
  // turns it a quarter turn so the ship sits left and the flock attacks from
  // the right. Sprites are always drawn upright, only positions are mapped.
  const VERTICAL = FORMAT !== "strip";
  const FIELD_W = VERTICAL ? SAFE.w : SAFE.h;
  const FIELD_H = VERTICAL ? SAFE.h : SAFE.w;
  const toX = (u, v) => (VERTICAL ? SAFE.x + u : SAFE.x + FIELD_H - v);
  const toY = (u, v) => (VERTICAL ? SAFE.y + v : SAFE.y + u);

  const LAYOUT = {
    popup: {
      henScale: 1, shipScale: 1, itemScale: 1,
      shipGap: 36, shipMargin: 16, ground: 14,
      formTop: 26, rowGap: 25, sway: 22, enterSwing: 36, enterOffset: 70,
      swoop: { out: 70, back: 34, approach: 80, exit: 50, aim: 24, dropFrom: 66, dropGap: 40, reach: 36 },
      henHitR: 13, touchR: 16, eggHitR: 8, pickupR: 18,
      fireEvery: 0.22, bulletSpeed: 420, spreadVu: 95,
      eggV0: 50, eggGravity: 150, eggMax: 175,
      dragGain: 1.25, keySpeed: 240, giftSway: 14,
      banner: 26, bannerSub: 10, planet: [0.853, 0.712, 16],
      waves: [
        { cols: 6, rows: 3, spacing: 38, hp: 1, points: 10, swoopEvery: 3.4, maxSwoop: 1, swoopTime: 2.6, swoopEggs: false, eggEvery: 1.6, eggAim: 0.3 },
        { cols: 7, rows: 3, spacing: 34, hp: 2, points: 15, swoopEvery: 1.7, maxSwoop: 2, swoopTime: 2.3, swoopEggs: true, eggEvery: 1.15, eggAim: 0.4 }
      ]
    },
    rail: {
      henScale: 0.56, shipScale: 0.68, itemScale: 0.72,
      shipGap: 22, shipMargin: 10, ground: 10,
      formTop: 16, rowGap: 17, sway: 8, enterSwing: 14, enterOffset: 28,
      swoop: { out: 30, back: 20, approach: 30, exit: 20, aim: 10, dropFrom: 50, dropGap: 30, reach: 16 },
      henHitR: 9, touchR: 11, eggHitR: 6, pickupR: 13,
      fireEvery: 0.24, bulletSpeed: 340, spreadVu: 55,
      eggV0: 40, eggGravity: 120, eggMax: 140,
      dragGain: 1.15, keySpeed: 120, giftSway: 8,
      banner: 16, bannerSub: 7.5, planet: [0.78, 0.6, 9],
      waves: [
        { cols: 4, rows: 4, spacing: 20, hp: 1, points: 10, swoopEvery: 3.4, maxSwoop: 1, swoopTime: 2.4, swoopEggs: false, eggEvery: 1.7, eggAim: 0.3 },
        { cols: 4, rows: 4, spacing: 20, hp: 2, points: 15, swoopEvery: 1.9, maxSwoop: 2, swoopTime: 2.2, swoopEggs: true, eggEvery: 1.25, eggAim: 0.4 }
      ]
    },
    strip: {
      henScale: 0.4, shipScale: 0.5, itemScale: 0.58,
      shipGap: 20, shipMargin: 8, ground: 0,
      formTop: 30, rowGap: 24, sway: 3, enterSwing: 8, enterOffset: 14,
      swoop: { out: 12, back: 30, approach: 14, exit: 10, aim: 6, dropFrom: 130, dropGap: 70, reach: 10 },
      henHitR: 8, touchR: 9, eggHitR: 5, pickupR: 11,
      fireEvery: 0.24, bulletSpeed: 420, spreadVu: 34,
      eggV0: 70, eggGravity: 60, eggMax: 160,
      dragGain: 1.3, keySpeed: 90, giftSway: 5,
      banner: 14, bannerSub: 7, planet: [0.6, 0.66, 10],
      waves: [
        { cols: 3, rows: 4, spacing: 16, hp: 1, points: 10, swoopEvery: 3.2, maxSwoop: 1, swoopTime: 2.6, swoopEggs: false, eggEvery: 1.5, eggAim: 0.35 },
        { cols: 3, rows: 5, spacing: 16, hp: 2, points: 15, swoopEvery: 1.9, maxSwoop: 2, swoopTime: 2.4, swoopEggs: true, eggEvery: 1.15, eggAim: 0.45 }
      ]
    }
  }[FORMAT];

  const WAVES = LAYOUT.waves;
  const SHIP_V = FIELD_H - LAYOUT.shipGap;
  const SHIP_MIN = LAYOUT.shipMargin;
  const SHIP_MAX = FIELD_W - LAYOUT.shipMargin;
  // Without a ground band (strip) eggs and pickups just fly out behind the ship.
  const GROUND_V = LAYOUT.ground ? FIELD_H - LAYOUT.ground : FIELD_H + 24;
  const SHIP_ROT = VERTICAL ? 0 : Math.PI / 2;
  const HEN_W = 40;
  const HEN_H = 36;
  const SHIP_W = 32;
  const SHIP_H = 36;
  const FLAP_FRAMES = 6;
  const SHIP_EASE = 16;          // follow stiffness: higher = snappier
  const ENTER_TIME = 1.2;
  const SPREAD_TIME = 7;
  const INVULN_TIME = 2;
  const START_LIVES = 3;
  const SWOOP_BONUS = 10;
  const WAVE_BONUS = 100;
  const WAVE_PAUSE = 1.5;
  const BANNER_TIME = 1.5;
  const DRUM_CHANCE = 0.22;
  const DRUM_POINTS = 50;
  const GIFT_FIRST = 4;
  const GIFT_EVERY = 11;
  const DEATH_DELAY = 1.1;
  const MAX_BULLETS = 36;
  const MAX_EGGS = 14;
  const MAX_FEATHERS = 60;
  const MAX_SPLATS = 8;
  const STAR_DENSITY = (WIDTH * HEIGHT) / 75000;
  const STAR_LAYERS = [
    { count: 70, size: 0.8, speed: 7, alpha: 0.45, streak: 0 },
    { count: 32, size: 1.2, speed: 18, alpha: 0.7, streak: 0 },
    { count: 12, size: 1.3, speed: 46, alpha: 0.85, streak: 4 }
  ];
  const TAU = Math.PI * 2;

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - (1 - t) ** 3;
  const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

  // Draw-time transform in served units without save/restore churn.
  const setXf = (x, y, rot = 0, sx = 1, sy = 1) => {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    ctx.setTransform(DPR * cos * sx, DPR * sin * sx, -DPR * sin * sy, DPR * cos * sy, DPR * x, DPR * y);
  };
  const resetXf = () => ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  const makeLayer = (w, h) => {
    const layer = document.createElement("canvas");
    layer.width = Math.max(1, Math.ceil(w * DPR));
    layer.height = Math.max(1, Math.ceil(h * DPR));
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { canvas: layer, g };
  };

  // Sprite sheet with whole-pixel cells; paint(g, col, row) draws centred at
  // the origin in authored units and is scaled down to `scale` here.
  const makeAtlas = (cols, rows, cellW, cellH, scale, paint) => {
    const cw = Math.ceil(cellW * scale * DPR);
    const ch = Math.ceil(cellH * scale * DPR);
    const sheet = document.createElement("canvas");
    sheet.width = cw * cols;
    sheet.height = ch * rows;
    const g = sheet.getContext("2d");
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        g.setTransform(DPR * scale, 0, 0, DPR * scale, col * cw + cw / 2, row * ch + ch / 2);
        paint(g, col, row);
      }
    }
    return { canvas: sheet, cw, ch, w: cw / DPR, h: ch / DPR };
  };

  const disc = (g, x, y, r) => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };

  const oval = (g, x, y, rx, ry, rot) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, TAU);
    g.fill();
  };

  /* -- Pre-rendered art */

  const GROUND_TOP = SAFE.y + GROUND_V;
  const sky = makeLayer(WIDTH, HEIGHT);
  const ground = LAYOUT.ground ? makeLayer(WIDTH, HEIGHT - GROUND_TOP) : null;
  const starLayers = STAR_LAYERS.map(() => makeLayer(WIDTH, HEIGHT));

  const paintSky = () => {
    const g = sky.g;
    const grad = VERTICAL ? g.createLinearGradient(0, 0, 0, HEIGHT) : g.createLinearGradient(WIDTH, 0, 0, 0);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    const span = Math.max(WIDTH, HEIGHT);
    [[0.2, 0.52, 0.43, PALETTE.nebulaA], [0.83, 0.68, 0.4, PALETTE.nebulaB], [0.63, 0.16, 0.33, PALETTE.nebulaC]].forEach(([fx, fy, fr, color]) => {
      const x = fx * WIDTH;
      const y = fy * HEIGHT;
      const cloud = g.createRadialGradient(x, y, 0, x, y, fr * span);
      cloud.addColorStop(0, color);
      cloud.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = cloud;
      g.fillRect(0, 0, WIDTH, HEIGHT);
    });

    // Distant ringed planet, kept dim so it never competes with the hens.
    const [fx, fy, r] = LAYOUT.planet;
    const px = fx * WIDTH;
    const py = fy * HEIGHT;
    const k = r / 16;
    g.globalAlpha = 0.75;
    g.strokeStyle = PALETTE.ring;
    g.lineWidth = 1.6 * k;
    g.beginPath();
    g.ellipse(px, py, 30 * k, 7 * k, -0.35, Math.PI, TAU);
    g.stroke();
    const body = g.createRadialGradient(px - 6 * k, py - 7 * k, 2 * k, px, py, 18 * k);
    body.addColorStop(0, PALETTE.planet);
    body.addColorStop(1, PALETTE.planetDark);
    g.fillStyle = body;
    disc(g, px, py, r);
    g.beginPath();
    g.ellipse(px, py, 30 * k, 7 * k, -0.35, 0, Math.PI);
    g.stroke();
    g.globalAlpha = 1;
  };

  const paintStars = () => {
    STAR_LAYERS.forEach((spec, index) => {
      const g = starLayers[index].g;
      const count = Math.max(4, Math.round(spec.count * STAR_DENSITY));
      for (let n = 0; n < count; n += 1) {
        const x = rand(0, WIDTH);
        const y = rand(0, HEIGHT);
        const tint = Math.random();
        g.fillStyle = tint < 0.2 ? "#ffe2a8" : tint < 0.45 ? "#bcd6ff" : "#ffffff";
        g.globalAlpha = spec.alpha * rand(0.5, 1);
        if (!spec.streak) {
          g.fillRect(x, y, spec.size, spec.size);
        } else if (VERTICAL) {
          g.fillRect(x, y, spec.size * 0.8, spec.streak);
        } else {
          g.fillRect(x, y, spec.streak, spec.size * 0.8);
        }
      }
      // A few twinkle crosses on the middle layer.
      if (index === 1) {
        g.globalAlpha = 0.8;
        g.fillStyle = "#ffffff";
        for (let n = 0; n < Math.max(2, Math.round(5 * STAR_DENSITY)); n += 1) {
          const x = rand(4, WIDTH - 4);
          const y = rand(4, HEIGHT - 4);
          g.fillRect(x - 2.5, y - 0.4, 5, 0.8);
          g.fillRect(x - 0.4, y - 2.5, 0.8, 5);
        }
      }
      g.globalAlpha = 1;
    });
  };

  const paintGround = () => {
    if (!ground) {
      return;
    }
    const g = ground.g;
    const h = HEIGHT - GROUND_TOP;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, PALETTE.groundTop);
    grad.addColorStop(1, PALETTE.groundBottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, WIDTH, h);
    for (let n = 0; n < Math.round(WIDTH / 27); n += 1) {
      const x = rand(6, WIDTH - 6);
      const y = rand(h * 0.3, h * 0.8);
      const rx = rand(3, 9) * LAYOUT.itemScale;
      g.fillStyle = PALETTE.crater;
      oval(g, x, y, rx, rx * 0.3, 0);
      g.strokeStyle = "rgba(220, 205, 255, 0.25)";
      g.lineWidth = 0.7;
      g.beginPath();
      g.ellipse(x, y + 0.4, rx, rx * 0.3, 0, 0.15, Math.PI - 0.15);
      g.stroke();
    }
    g.fillStyle = PALETTE.groundRim;
    g.fillRect(0, 0, WIDTH, 1);
  };

  const drawHenArt = (g, flap, blink) => {
    const wing = -0.3 + flap * 1.05;
    g.lineJoin = "round";
    g.lineCap = "round";

    // Feet
    g.strokeStyle = PALETTE.beakDark;
    g.lineWidth = 1.3;
    g.beginPath();
    [-1, 1].forEach((side) => {
      const fx = side * 3.6;
      g.moveTo(fx, 10.5);
      g.lineTo(fx, 14.4);
      g.lineTo(fx - 1.9, 15.8);
      g.moveTo(fx, 14.4);
      g.lineTo(fx + 1.9, 15.8);
      g.moveTo(fx, 14.4);
      g.lineTo(fx, 16.2);
    });
    g.stroke();

    // Wings sit behind the body and pivot at the shoulders.
    [-1, 1].forEach((side) => {
      g.save();
      g.translate(side * 6.5, 1);
      g.rotate(-side * wing);
      g.beginPath();
      g.moveTo(0, -2.6);
      g.quadraticCurveTo(side * 8, -6, side * 12.5, -2);
      g.quadraticCurveTo(side * 11.6, 1.2, side * 9.4, 1);
      g.quadraticCurveTo(side * 8.6, 3.4, side * 6, 2.8);
      g.quadraticCurveTo(side * 4.6, 4.8, side * 0.5, 3.4);
      g.closePath();
      g.strokeStyle = PALETTE.henLine;
      g.lineWidth = 2;
      g.stroke();
      const wingFill = g.createLinearGradient(0, -5, 0, 4);
      wingFill.addColorStop(0, "#ffffff");
      wingFill.addColorStop(1, PALETTE.henShade);
      g.fillStyle = wingFill;
      g.fill();
      g.strokeStyle = "rgba(120, 100, 85, 0.5)";
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(side * 5, 0.6);
      g.lineTo(side * 8.8, 0);
      g.moveTo(side * 3, 1.9);
      g.lineTo(side * 6.2, 1.7);
      g.stroke();
      g.restore();
    });

    // Comb
    const comb = [[-3.3, -11.4, 2.4], [0, -12.9, 2.9], [3.3, -11.4, 2.4]];
    g.fillStyle = PALETTE.henLine;
    comb.forEach(([x, y, r]) => {
      disc(g, x, y, r + 0.9);
    });
    const combFill = g.createLinearGradient(0, -16, 0, -9);
    combFill.addColorStop(0, PALETTE.combHi);
    combFill.addColorStop(1, PALETTE.comb);
    g.fillStyle = combFill;
    comb.forEach(([x, y, r]) => {
      disc(g, x, y, r);
    });

    // Body + head: dark pass first, then the fill, so they read as one plump silhouette.
    g.fillStyle = PALETTE.henLine;
    g.beginPath();
    g.ellipse(0, 3, 10.6, 10, 0, 0, TAU);
    g.moveTo(7.2, -5.5);
    g.arc(0, -5.5, 7.2, 0, TAU);
    g.fill();
    const bodyFill = g.createRadialGradient(-3.5, -6, 1, 0, 1, 15);
    bodyFill.addColorStop(0, "#ffffff");
    bodyFill.addColorStop(0.55, PALETTE.henBody);
    bodyFill.addColorStop(1, PALETTE.henShade);
    g.fillStyle = bodyFill;
    g.beginPath();
    g.ellipse(0, 3, 9.6, 9, 0, 0, TAU);
    g.moveTo(6.2, -5.5);
    g.arc(0, -5.5, 6.2, 0, TAU);
    g.fill();

    // Chest fluff
    g.strokeStyle = "rgba(150, 128, 108, 0.4)";
    g.lineWidth = 0.8;
    g.beginPath();
    [[-3.4, 7], [0, 9], [3.4, 7]].forEach(([x, y]) => {
      g.moveTo(x - 1.6, y - 0.8);
      g.quadraticCurveTo(x, y + 0.8, x + 1.6, y - 0.8);
    });
    g.stroke();

    // Cheeks
    g.fillStyle = PALETTE.cheek;
    g.beginPath();
    g.ellipse(-4.6, -3.2, 1.7, 1.1, 0, 0, TAU);
    g.ellipse(4.6, -3.2, 1.7, 1.1, 0, 0, TAU);
    g.fill();

    // Eyes (or closed lids mid-blink)
    if (blink) {
      g.strokeStyle = PALETTE.henLine;
      g.lineWidth = 1.1;
      g.beginPath();
      [-1, 1].forEach((side) => {
        g.moveTo(side * 2.7 - 1.9, -6);
        g.quadraticCurveTo(side * 2.7, -4.8, side * 2.7 + 1.9, -6);
      });
      g.stroke();
    } else {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(-2.7, -6, 2.2, 0, TAU);
      g.moveTo(4.9, -6);
      g.arc(2.7, -6, 2.2, 0, TAU);
      g.fill();
      g.fillStyle = "#1a0f0a";
      g.beginPath();
      g.arc(-2.3, -5.7, 1.3, 0, TAU);
      g.moveTo(3.4, -5.7);
      g.arc(2.1, -5.7, 1.3, 0, TAU);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillRect(-2.9, -6.7, 0.8, 0.8);
      g.fillRect(1.5, -6.7, 0.8, 0.8);
    }

    // Mischievous brows
    g.strokeStyle = PALETTE.henLine;
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(-1, -8.6);
    g.lineTo(-4.6, -9.7);
    g.moveTo(1, -8.6);
    g.lineTo(4.6, -9.7);
    g.stroke();

    // Beak + wattle
    g.fillStyle = PALETTE.beak;
    g.beginPath();
    g.moveTo(0, -4.6);
    g.lineTo(2.6, -2.7);
    g.lineTo(0, -0.6);
    g.lineTo(-2.6, -2.7);
    g.closePath();
    g.fill();
    g.fillStyle = PALETTE.beakDark;
    g.beginPath();
    g.moveTo(-2.6, -2.7);
    g.lineTo(2.6, -2.7);
    g.lineTo(0, -0.6);
    g.closePath();
    g.fill();
    g.fillStyle = PALETTE.comb;
    oval(g, 0.9, 0.7, 1.2, 1.7, 0.2);
  };

  const drawShipArt = (g) => {
    g.lineJoin = "round";
    g.strokeStyle = PALETTE.shipLine;
    g.lineWidth = 1;

    const wingFill = g.createLinearGradient(0, -4, 0, 11);
    wingFill.addColorStop(0, PALETTE.wingHi);
    wingFill.addColorStop(1, PALETTE.wing);
    g.fillStyle = wingFill;
    g.beginPath();
    g.moveTo(-3, -5);
    g.lineTo(-14, 6.5);
    g.lineTo(-14, 10.5);
    g.lineTo(-4, 8.5);
    g.lineTo(4, 8.5);
    g.lineTo(14, 10.5);
    g.lineTo(14, 6.5);
    g.lineTo(3, -5);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = PALETTE.shipLine;
    g.fillRect(-14.4, 0.5, 1.4, 5);
    g.fillRect(13, 0.5, 1.4, 5);
    g.fillStyle = PALETTE.shipAccent;
    g.fillRect(-14.8, 5, 2.4, 6);
    g.fillRect(12.4, 5, 2.4, 6);

    const hull = g.createLinearGradient(-5, 0, 5, 0);
    hull.addColorStop(0, PALETTE.hullDark);
    hull.addColorStop(0.45, PALETTE.hullHi);
    hull.addColorStop(1, PALETTE.hullDark);
    g.fillStyle = hull;
    g.beginPath();
    g.moveTo(0, -16);
    g.quadraticCurveTo(5.6, -7, 5, 6);
    g.lineTo(3.4, 11.5);
    g.lineTo(-3.4, 11.5);
    g.lineTo(-5, 6);
    g.quadraticCurveTo(-5.6, -7, 0, -16);
    g.closePath();
    g.fill();
    g.stroke();

    g.fillStyle = PALETTE.shipAccent;
    g.beginPath();
    g.moveTo(0, -16);
    g.quadraticCurveTo(2.2, -12.5, 2.7, -10);
    g.lineTo(-2.7, -10);
    g.quadraticCurveTo(-2.2, -12.5, 0, -16);
    g.fill();

    const glass = g.createLinearGradient(0, -8, 0, 2);
    glass.addColorStop(0, PALETTE.glassHi);
    glass.addColorStop(1, PALETTE.glass);
    g.fillStyle = glass;
    oval(g, 0, -3, 2.7, 5, 0);
    g.stroke();
    g.fillStyle = "rgba(255, 255, 255, 0.85)";
    oval(g, -0.9, -5, 0.8, 1.8, 0);

    g.fillStyle = PALETTE.shipLine;
    g.fillRect(-4.3, 10.5, 3, 3);
    g.fillRect(1.3, 10.5, 3, 3);
  };

  paintSky();
  paintStars();
  paintGround();
  const henAtlas = makeAtlas(FLAP_FRAMES, 2, HEN_W, HEN_H, LAYOUT.henScale, (g, frame, lid) => {
    drawHenArt(g, (1 - Math.cos((frame / FLAP_FRAMES) * TAU)) / 2, lid === 1);
  });
  const shipSprite = makeAtlas(1, 1, SHIP_W, SHIP_H, LAYOUT.shipScale, drawShipArt);

  /* -- State */

  // Field coordinates: u across, v toward the ship (see toX / toY).
  const game = {
    time: 0,
    wave: 0,
    nextWave: -1,
    waveDelay: 0,
    formU0: 0,
    spacing: 0,
    swayU: 0,
    swayV: 0,
    hens: [],
    bullets: [],
    eggs: [],
    splats: [],
    feathers: [],
    pickups: [],
    lives: START_LIVES,
    invuln: 0,
    spreadTimer: 0,
    fireTimer: 0,
    swoopTimer: 0,
    eggTimer: 0,
    giftTimer: 0,
    dying: 0,
    mercy: false,
    flash: 0,
    muzzle: 0,
    banner: "",
    bannerSub: "",
    bannerAge: BANNER_TIME,
    starOff: [0, 0, 0],
    shipAlive: true,
    shipU: FIELD_W / 2,
    shipVu: 0,
    targetU: FIELD_W / 2,
    dragging: false,
    dragId: 0,
    dragStart: 0,
    dragShipU: 0,
    keyMinus: false,
    keyPlus: false
  };

  const updateLives = () => {
    livesPips.forEach((pip, index) => {
      pip.classList.toggle("off", index >= game.lives);
    });
  };

  const showBanner = (text, sub = "") => {
    game.banner = text;
    game.bannerSub = sub;
    game.bannerAge = 0;
  };

  // floatText kept inside the play area so short formats never clip it.
  const say = (x, y, text, color) => {
    floatText(clamp(x, SAFE.x + 24, SAFE.x + SAFE.w - 24), clamp(y, SAFE.y + 8, SAFE.y + SAFE.h - 6), text, color);
  };

  const slotU = (hen) => game.formU0 + hen.col * game.spacing + game.swayU;
  const slotV = (hen) => LAYOUT.formTop + hen.row * LAYOUT.rowGap + game.swayV + Math.sin(game.time * 3 + hen.phase) * 1.4 * LAYOUT.henScale;

  const spawnWave = (index) => {
    const spec = WAVES[index];
    game.wave = index;
    game.spacing = spec.spacing;
    game.formU0 = FIELD_W / 2 - ((spec.cols - 1) * spec.spacing) / 2;
    game.hens.length = 0;
    for (let row = 0; row < spec.rows; row += 1) {
      for (let col = 0; col < spec.cols; col += 1) {
        const side = col < (spec.cols - 1) / 2 ? -1 : 1;
        const fromCenter = Math.abs(col - (spec.cols - 1) / 2);
        const hen = {
          col,
          row,
          side,
          state: "enter",
          // Negative progress = queued delay, so the flock streams in.
          t: -(row * 0.22 + fromCenter * 0.08),
          su: game.formU0 + col * spec.spacing + side * LAYOUT.enterOffset,
          sv: -24,
          u: 0,
          v: -24,
          tilt: 0,
          phase: rand(0, TAU),
          flapSpeed: rand(11, 14),
          blink: 0,
          blinkGap: rand(1, 4),
          lay: 0,
          hp: spec.hp,
          hit: 0,
          dur: 1,
          dropped: false,
          au: 0, av: 0, bu: 0, bv: 0, cu: 0, cv: 0, du: 0, dv: 0
        };
        hen.u = hen.su;
        game.hens.push(hen);
      }
    }
    if (waveValue) {
      waveValue.textContent = String(index + 1);
    }
  };

  const resetGame = () => {
    game.time = 0;
    game.nextWave = -1;
    game.waveDelay = 0;
    game.hens.length = 0;
    game.bullets.length = 0;
    game.eggs.length = 0;
    game.splats.length = 0;
    game.feathers.length = 0;
    game.pickups.length = 0;
    game.lives = START_LIVES;
    game.invuln = 0;
    game.spreadTimer = 0;
    game.fireTimer = 0.3;
    game.swoopTimer = 2.8;
    game.eggTimer = 1.6;
    game.giftTimer = GIFT_FIRST;
    game.dying = 0;
    game.mercy = false;
    game.flash = 0;
    game.muzzle = 0;
    game.shipAlive = true;
    game.shipU = FIELD_W / 2;
    game.shipVu = 0;
    game.targetU = FIELD_W / 2;
    game.dragging = false;
    game.keyMinus = false;
    game.keyPlus = false;
    spawnWave(0);
    showBanner("WAVE 1", "Here they come!");
    updateLives();
  };

  /* -- Spawners */

  // Feathers live in screen space so they always drift down, whatever the format.
  const addFeathers = (x, y, count) => {
    const s = LAYOUT.henScale;
    for (let n = 0; n < count; n += 1) {
      if (game.feathers.length >= MAX_FEATHERS) {
        game.feathers.shift();
      }
      game.feathers.push({
        x, y,
        vx: rand(-70, 70) * s,
        vy: rand(-80, -10) * s,
        rot: rand(0, TAU),
        vr: rand(-7, 7),
        sway: rand(0, TAU),
        age: 0,
        life: rand(0.9, 1.5),
        size: rand(0.8, 1.2) * Math.max(0.6, s)
      });
    }
  };

  const dropEgg = (u, v) => {
    if (game.eggs.length >= MAX_EGGS) {
      return;
    }
    game.eggs.push({ u, v, vv: LAYOUT.eggV0, rot: rand(-0.3, 0.3), spin: rand(-2, 2) });
  };

  const addSplat = (u) => {
    if (game.splats.length >= MAX_SPLATS) {
      game.splats.shift();
    }
    game.splats.push({ u, age: 0, life: 1.8, k: rand(0.8, 1.15), off: rand(-2, 2) });
  };

  const addPickup = (kind, u, v) => {
    game.pickups.push({
      kind,
      u, v,
      baseU: u,
      vu: kind === "drum" ? rand(-25, 25) * LAYOUT.itemScale : 0,
      vv: kind === "drum" ? -50 * LAYOUT.itemScale : (38 * FIELD_H) / 226,
      rot: rand(-0.4, 0.4),
      vr: kind === "drum" ? rand(-5, 5) : 0,
      age: 0
    });
  };

  const fire = () => {
    if (game.bullets.length >= MAX_BULLETS) {
      return;
    }
    const s = LAYOUT.shipScale;
    const u = game.shipU;
    const v = SHIP_V - 15 * s;
    game.bullets.push({ u, v, vu: 0 });
    if (game.spreadTimer > 0) {
      game.bullets.push({ u: u - 6 * s, v: v + 6 * s, vu: -LAYOUT.spreadVu });
      game.bullets.push({ u: u + 6 * s, v: v + 6 * s, vu: LAYOUT.spreadVu });
    }
    game.muzzle = 0.06;
  };

  const startSwoop = (live) => {
    const spec = WAVES[game.wave];
    const path = LAYOUT.swoop;
    let active = 0;
    let seen = 0;
    let pick = null;
    game.hens.forEach((hen) => {
      if (hen.state === "swoop") {
        active += 1;
      } else if (hen.state === "formation") {
        seen += 1;
        if (Math.random() < 1 / seen) {
          pick = hen;
        }
      }
    });
    if (!pick || active >= (live ? spec.maxSwoop : 1)) {
      return;
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    const edge = LAYOUT.shipMargin;
    const aimU = clamp(game.shipU + rand(-path.aim, path.aim), edge, FIELD_W - edge);
    pick.state = "swoop";
    pick.t = 0;
    pick.dur = spec.swoopTime;
    pick.dropped = !(live && spec.swoopEggs);
    pick.au = pick.u;
    pick.av = pick.v;
    pick.bu = clamp(pick.u + dir * path.out, 2, FIELD_W - 2);
    pick.bv = pick.v - path.back;
    pick.cu = clamp(aimU - dir * path.approach, 2, FIELD_W - 2);
    pick.cv = SHIP_V - 10 * LAYOUT.shipScale;
    pick.du = clamp(aimU + dir * path.exit, 2, FIELD_W - 2);
    pick.dv = FIELD_H + 30;
  };

  const layEgg = () => {
    const spec = WAVES[game.wave];
    let seen = 0;
    let pick = null;
    let best = null;
    let bestDist = Infinity;
    game.hens.forEach((hen) => {
      if (hen.state !== "formation") {
        return;
      }
      seen += 1;
      if (Math.random() < 1 / seen) {
        pick = hen;
      }
      const dist = Math.abs(hen.u - game.shipU);
      if (dist < bestDist) {
        bestDist = dist;
        best = hen;
      }
    });
    const hen = Math.random() < spec.eggAim ? best : pick;
    if (hen) {
      hen.lay = 0.3;
      dropEgg(hen.u, hen.v + 10 * LAYOUT.henScale);
    }
  };

  /* -- Outcomes */

  const waveCleared = () => {
    if (!game.shipAlive) {
      return;   // a stray bullet after the last life is lost doesn't count
    }
    setScore(Shell.score + WAVE_BONUS);
    if (game.wave + 1 >= WAVES.length) {
      burst(toX(game.shipU, SHIP_V), toY(game.shipU, SHIP_V), PALETTE.yolk, 20, 140);
      endGame(true);
      return;
    }
    say(SAFE.x + SAFE.w / 2, SAFE.y + SAFE.h * 0.38, `WAVE CLEAR +${WAVE_BONUS}`, PALETTE.yolk);
    game.nextWave = game.wave + 1;
    game.waveDelay = WAVE_PAUSE;
  };

  const killHen = (index) => {
    const hen = game.hens[index];
    const s = LAYOUT.henScale;
    const x = toX(hen.u, hen.v);
    const y = toY(hen.u, hen.v);
    game.hens.splice(index, 1);
    let points = WAVES[game.wave].points;
    if (hen.state === "swoop") {
      points += SWOOP_BONUS;
    }
    setScore(Shell.score + points);
    say(x, y - 12 * s, `+${points}`, PALETTE.yolk);
    burst(x, y, PALETTE.feather, 8, 90 * Math.max(0.6, s));
    burst(x, y - 8 * s, PALETTE.comb, 4, 70 * Math.max(0.6, s));
    addFeathers(x, y, 7);
    if (Math.random() < DRUM_CHANCE) {
      addPickup("drum", hen.u, hen.v);
    }
    if (game.hens.length === 0) {
      waveCleared();
    }
  };

  const hitShip = () => {
    if (game.invuln > 0 || !game.shipAlive) {
      return;
    }
    const x = toX(game.shipU, SHIP_V);
    const y = toY(game.shipU, SHIP_V);
    game.lives -= 1;
    updateLives();
    shake();
    game.flash = reduceMotion ? 0.12 : 0.45;
    burst(x, y, PALETTE.yolk, 12, 120);
    if (game.lives <= 0) {
      game.shipAlive = false;
      game.dying = DEATH_DELAY;
      game.dragging = false;
      burst(x, y, PALETTE.flame, 26, 170);
      burst(x, y, "#ffffff", 14, 110);
      return;
    }
    game.invuln = INVULN_TIME;
    game.mercy = true;
    say(x, y - 26 * LAYOUT.shipScale, "OUCH!", PALETTE.combHi);
  };

  // Clear eggs right on top of the ship after a hit so one mistake costs one
  // life. Deferred because hits are detected while the egg list is iterated.
  const applyMercy = () => {
    if (!game.mercy) {
      return;
    }
    game.mercy = false;
    const reach = LAYOUT.pickupR * 2.4;
    for (let index = game.eggs.length - 1; index >= 0; index -= 1) {
      const egg = game.eggs[index];
      if (Math.abs(egg.u - game.shipU) < reach && egg.v > SHIP_V - reach * 1.6) {
        game.eggs.splice(index, 1);
        burst(toX(egg.u, egg.v), toY(egg.u, egg.v), PALETTE.egg, 3, 50);
      }
    }
  };

  /* -- Simulation steps */

  const stepStars = (dt) => {
    const span = VERTICAL ? HEIGHT : WIDTH;
    STAR_LAYERS.forEach((spec, index) => {
      game.starOff[index] = (game.starOff[index] + spec.speed * dt) % span;
    });
  };

  const stepShip = (dt) => {
    if (game.keyMinus) {
      game.targetU -= LAYOUT.keySpeed * dt;
    }
    if (game.keyPlus) {
      game.targetU += LAYOUT.keySpeed * dt;
    }
    game.targetU = clamp(game.targetU, SHIP_MIN, SHIP_MAX);
    const prev = game.shipU;
    game.shipU += (game.targetU - game.shipU) * (1 - Math.exp(-SHIP_EASE * dt));
    game.shipVu = (game.shipU - prev) / dt;
  };

  const stepHens = (dt, live) => {
    const s = LAYOUT.henScale;
    game.swayU = Math.sin(game.time * 0.9) * LAYOUT.sway;
    game.swayV = Math.sin(game.time * 1.6) * 3 * s;
    for (let index = game.hens.length - 1; index >= 0; index -= 1) {
      const hen = game.hens[index];
      const oldU = hen.u;
      hen.blink -= dt;
      if (hen.blink < -hen.blinkGap) {
        hen.blink = 0.14;
        hen.blinkGap = rand(1.5, 4);
      }
      hen.lay = Math.max(0, hen.lay - dt);
      hen.hit = Math.max(0, hen.hit - dt);
      const tu = slotU(hen);
      const tv = slotV(hen);
      if (hen.state === "enter") {
        hen.t += dt / ENTER_TIME;
        const e = easeOutCubic(clamp(hen.t, 0, 1));
        hen.u = lerp(hen.su, tu, e) + Math.sin(e * Math.PI) * hen.side * LAYOUT.enterSwing;
        hen.v = lerp(hen.sv, tv, e);
        if (hen.t >= 1) {
          hen.state = "formation";
        }
      } else if (hen.state === "formation") {
        hen.u = tu;
        hen.v = tv;
      } else {
        hen.t += dt / hen.dur;
        const t = Math.min(hen.t, 1);
        const w = 1 - t;
        const k0 = w * w * w;
        const k1 = 3 * w * w * t;
        const k2 = 3 * w * t * t;
        const k3 = t * t * t;
        hen.u = k0 * hen.au + k1 * hen.bu + k2 * hen.cu + k3 * hen.du;
        hen.v = k0 * hen.av + k1 * hen.bv + k2 * hen.cv + k3 * hen.dv;
        const path = LAYOUT.swoop;
        if (!hen.dropped && hen.v > path.dropFrom && hen.v < SHIP_V - path.dropGap && Math.abs(hen.u - game.shipU) < path.reach) {
          hen.dropped = true;
          dropEgg(hen.u, hen.v + 10 * s);
        }
        if (hen.t >= 1) {
          // Out past the ship: loop back in from the far side to its slot.
          hen.state = "enter";
          hen.t = 0;
          hen.su = tu;
          hen.sv = -24;
          hen.side = Math.random() < 0.5 ? -1 : 1;
          hen.u = tu;
          hen.v = -24;
        }
      }
      const vu = (hen.u - oldU) / dt;
      hen.tilt += (clamp(vu / (320 * Math.max(s, 0.5)), -0.6, 0.6) - hen.tilt) * Math.min(1, dt * 10);

      if (live && game.shipAlive && hen.state !== "formation" && hen.v > SHIP_V - LAYOUT.touchR * 2) {
        const du = hen.u - game.shipU;
        const dv = hen.v - SHIP_V;
        if (du * du + dv * dv < LAYOUT.touchR * LAYOUT.touchR && game.invuln <= 0) {
          hitShip();
          killHen(index);
        }
      }
    }
  };

  const stepBullets = (dt) => {
    const hitR2 = LAYOUT.henHitR * LAYOUT.henHitR;
    for (let b = game.bullets.length - 1; b >= 0; b -= 1) {
      const bullet = game.bullets[b];
      bullet.v -= LAYOUT.bulletSpeed * dt;
      bullet.u += bullet.vu * dt;
      if (bullet.v < -8 || bullet.u < -6 || bullet.u > FIELD_W + 6) {
        game.bullets.splice(b, 1);
        continue;
      }
      for (let h = game.hens.length - 1; h >= 0; h -= 1) {
        const hen = game.hens[h];
        if (hen.v < 2) {
          continue;
        }
        const du = hen.u - bullet.u;
        const dv = hen.v + 2 * LAYOUT.henScale - bullet.v;
        if (du * du + dv * dv < hitR2) {
          game.bullets.splice(b, 1);
          hen.hp -= 1;
          if (hen.hp > 0) {
            // First hit knocks the helmet off.
            const x = toX(hen.u, hen.v);
            const y = toY(hen.u, hen.v);
            hen.hit = 0.14;
            addFeathers(x, y, 2);
            burst(x, y - 12 * LAYOUT.henScale, PALETTE.helmetHi, 7, 100 * Math.max(0.6, LAYOUT.henScale));
            say(x, y - 18 * LAYOUT.henScale, "CLANK!", PALETTE.helmetHi);
          } else {
            killHen(h);
          }
          break;
        }
      }
    }
  };

  const stepEggs = (dt, live) => {
    const hitR2 = LAYOUT.eggHitR * LAYOUT.eggHitR;
    for (let index = game.eggs.length - 1; index >= 0; index -= 1) {
      const egg = game.eggs[index];
      egg.vv = Math.min(LAYOUT.eggMax, egg.vv + LAYOUT.eggGravity * dt);
      egg.v += egg.vv * dt;
      egg.rot += egg.spin * dt;
      if (egg.v >= GROUND_V + 2) {
        game.eggs.splice(index, 1);
        if (ground) {
          addSplat(egg.u);
          burst(toX(egg.u, GROUND_V), toY(egg.u, GROUND_V), PALETTE.yolk, 4, 50);
        }
        continue;
      }
      if (live && game.shipAlive && game.invuln <= 0) {
        const du = egg.u - game.shipU;
        const dv = egg.v - (SHIP_V + LAYOUT.shipScale);
        if (du * du + dv * dv < hitR2) {
          game.eggs.splice(index, 1);
          burst(toX(egg.u, egg.v), toY(egg.u, egg.v), PALETTE.yolk, 8, 90);
          hitShip();
        }
      }
    }
  };

  const stepPickups = (dt, live) => {
    const reach2 = LAYOUT.pickupR * LAYOUT.pickupR;
    for (let index = game.pickups.length - 1; index >= 0; index -= 1) {
      const item = game.pickups[index];
      item.age += dt;
      if (item.kind === "drum") {
        item.vv = Math.min(120 * Math.max(0.7, LAYOUT.itemScale), item.vv + 170 * LAYOUT.itemScale * dt);
        item.u = clamp(item.u + item.vu * dt, 4, FIELD_W - 4);
        item.v += item.vv * dt;
        item.rot += item.vr * dt;
      } else {
        item.v += item.vv * dt;
        item.u = item.baseU + Math.sin(item.age * 2.2) * LAYOUT.giftSway;
        item.rot = Math.sin(item.age * 2.2 + 1) * 0.25;
      }
      if (item.v > GROUND_V + 4) {
        game.pickups.splice(index, 1);
        if (ground) {
          burst(toX(item.u, GROUND_V), toY(item.u, GROUND_V), item.kind === "drum" ? PALETTE.drumHi : PALETTE.gift, 5, 50);
        }
        continue;
      }
      if (!live || !game.shipAlive) {
        continue;
      }
      const du = item.u - game.shipU;
      const dv = item.v - SHIP_V;
      if (du * du + dv * dv < reach2) {
        const x = toX(item.u, item.v);
        const y = toY(item.u, item.v);
        game.pickups.splice(index, 1);
        if (item.kind === "drum") {
          setScore(Shell.score + DRUM_POINTS);
          say(x, y - 14, `YUM +${DRUM_POINTS}`, PALETTE.drumHi);
          burst(x, y, PALETTE.drumHi, 10, 90);
        } else {
          game.spreadTimer = SPREAD_TIME;
          say(x, y - 16, "SPREAD SHOT!", PALETTE.power);
          burst(x, y, PALETTE.power, 16, 120);
          burst(x, y, PALETTE.ribbon, 8, 90);
        }
      }
    }
  };

  const stepDebris = (dt) => {
    for (let index = game.feathers.length - 1; index >= 0; index -= 1) {
      const f = game.feathers[index];
      f.age += dt;
      f.vx *= Math.exp(-2.6 * dt);
      f.vy = Math.min(38 * f.size, f.vy + 110 * f.size * dt);
      f.x += (f.vx + Math.sin(f.age * 6 + f.sway) * 22 * f.size) * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.age >= f.life) {
        game.feathers.splice(index, 1);
      }
    }
    for (let index = game.splats.length - 1; index >= 0; index -= 1) {
      const s = game.splats[index];
      s.age += dt;
      if (s.age >= s.life) {
        game.splats.splice(index, 1);
      }
    }
    game.bannerAge += dt;
    game.flash = Math.max(0, game.flash - dt * 2.2);
    game.muzzle = Math.max(0, game.muzzle - dt);
  };

  // Runs only in the play phase.
  const update = (dt) => {
    if (dt <= 0) {
      return;
    }
    // Time-out is a loss here: the goal is waves cleared, not score.
    if (Shell.elapsed >= CONFIG.maxPlayMs) {
      endGame(false);
      return;
    }
    game.time += dt;
    stepStars(dt);

    if (game.shipAlive) {
      stepShip(dt);
      game.fireTimer -= dt;
      if (game.fireTimer <= 0) {
        game.fireTimer += LAYOUT.fireEvery;
        fire();
      }
    }
    game.invuln = Math.max(0, game.invuln - dt);
    game.spreadTimer = Math.max(0, game.spreadTimer - dt);

    if (game.waveDelay > 0) {
      game.waveDelay -= dt;
      if (game.waveDelay <= 0 && game.nextWave >= 0) {
        spawnWave(game.nextWave);
        game.nextWave = -1;
        game.swoopTimer = 2.4;
        game.eggTimer = 1.4;
        showBanner(`WAVE ${game.wave + 1}`, "Final wave!");
      }
    } else {
      const spec = WAVES[game.wave];
      game.swoopTimer -= dt;
      if (game.swoopTimer <= 0) {
        game.swoopTimer = spec.swoopEvery * rand(0.75, 1.25);
        startSwoop(true);
      }
      game.eggTimer -= dt;
      if (game.eggTimer <= 0) {
        game.eggTimer = spec.eggEvery * rand(0.7, 1.3);
        layEgg();
      }
    }

    game.giftTimer -= dt;
    if (game.giftTimer <= 0) {
      game.giftTimer = GIFT_EVERY;
      if (game.spreadTimer <= 0 && !game.pickups.some((item) => item.kind === "gift")) {
        addPickup("gift", rand(LAYOUT.shipMargin * 2, FIELD_W - LAYOUT.shipMargin * 2), -10);
      }
    }

    stepHens(dt, true);
    stepBullets(dt);
    stepEggs(dt, true);
    applyMercy();
    stepPickups(dt, true);
    stepDebris(dt);

    if (game.dying > 0) {
      game.dying -= dt;
      if (game.dying <= 0) {
        endGame(false);
      }
    }
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    if (dt <= 0) {
      return;
    }
    game.time += dt;
    stepStars(dt);
    if (Shell.phase === "intro") {
      game.targetU = FIELD_W / 2 + Math.sin(game.time * 1.1) * FIELD_W * 0.23;
      stepShip(dt);
      game.swoopTimer -= dt;
      if (game.swoopTimer <= 0) {
        game.swoopTimer = 3.2;
        startSwoop(false);
      }
    }
    stepHens(dt, false);
    stepEggs(dt, false);
    stepPickups(dt, false);
    stepDebris(dt);
  };

  /* -- Rendering */

  const drawBackdrop = () => {
    ctx.drawImage(sky.canvas, 0, 0, WIDTH, HEIGHT);
    starLayers.forEach((layer, index) => {
      const off = game.starOff[index];
      if (VERTICAL) {
        ctx.drawImage(layer.canvas, 0, off, WIDTH, HEIGHT);
        ctx.drawImage(layer.canvas, 0, off - HEIGHT, WIDTH, HEIGHT);
      } else {
        ctx.drawImage(layer.canvas, -off, 0, WIDTH, HEIGHT);
        ctx.drawImage(layer.canvas, WIDTH - off, 0, WIDTH, HEIGHT);
      }
    });
    if (ground) {
      ctx.drawImage(ground.canvas, 0, GROUND_TOP, WIDTH, HEIGHT - GROUND_TOP);
    }
  };

  const drawSplats = () => {
    const s = LAYOUT.itemScale;
    game.splats.forEach((splat) => {
      const t = splat.age / splat.life;
      const x = toX(splat.u, GROUND_V);
      const y = GROUND_TOP + 2.5 * s;
      const k = splat.k * s;
      ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
      ctx.fillStyle = PALETTE.egg;
      ctx.beginPath();
      ctx.ellipse(x, y, 9 * k, 2.6 * k, 0, 0, TAU);
      ctx.moveTo(x - 7 * k + 1.6 * s, y - s);
      ctx.arc(x - 7 * k, y - s, 1.6 * s, 0, TAU);
      ctx.moveTo(x + 8 * k + 1.3 * s, y + 0.5 * s);
      ctx.arc(x + 8 * k, y + 0.5 * s, 1.3 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = PALETTE.yolk;
      oval(ctx, x + splat.off * s, y - 0.6 * s, 3.4 * s, 2.1 * s, 0);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(x + (splat.off - 1.6) * s, y - 1.8 * s, 1.4 * s, 0.8 * s);
    });
    ctx.globalAlpha = 1;
  };

  const drawHen = (hen, time) => {
    if (hen.v < -20) {
      return;
    }
    const s = LAYOUT.henScale;
    const angle = time * hen.flapSpeed + hen.phase;
    const frame = Math.floor(((angle / TAU) % 1) * FLAP_FRAMES + FLAP_FRAMES) % FLAP_FRAMES;
    const lid = hen.blink > 0 ? 1 : 0;
    let sx = 1 - Math.cos(angle) * 0.04;
    let sy = 1 + Math.cos(angle) * 0.04;
    if (hen.lay > 0) {
      const squash = Math.sin((hen.lay / 0.3) * Math.PI) * 0.16;
      sx += squash;
      sy -= squash;
    }
    if (hen.hit > 0) {
      sx += 0.12;
      sy -= 0.1;
    }
    const x = toX(hen.u, hen.v);
    const y = toY(hen.u, hen.v) + Math.cos(angle) * 1.2 * s;
    const passes = hen.hit > 0 ? 2 : 1;
    setXf(x, y, hen.tilt, sx, sy);
    for (let pass = 0; pass < passes; pass += 1) {
      // Second pass re-draws additively for a white hit flash.
      if (pass === 1) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.8;
      }
      ctx.drawImage(henAtlas.canvas, frame * henAtlas.cw, lid * henAtlas.ch, henAtlas.cw, henAtlas.ch,
        -henAtlas.w / 2, -henAtlas.h / 2, henAtlas.w, henAtlas.h);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (hen.hp > 1) {
      setXf(x, y, hen.tilt, sx * s, sy * s);
      ctx.fillStyle = PALETTE.helmet;
      ctx.beginPath();
      ctx.arc(0, -8.4, 6.8, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = PALETTE.helmetDark;
      oval(ctx, 0, -8.2, 8.4, 1.9, 0);
      ctx.fillStyle = PALETTE.helmetHi;
      oval(ctx, -2.6, -12, 2.2, 1.1, -0.5);
    }
    resetXf();
  };

  const drawEggs = () => {
    const s = LAYOUT.itemScale;
    game.eggs.forEach((egg) => {
      setXf(toX(egg.u, egg.v), toY(egg.u, egg.v), egg.rot, s, s);
      ctx.fillStyle = PALETTE.eggShade;
      oval(ctx, 0.4, 0.5, 3.9, 4.9, 0);
      ctx.fillStyle = PALETTE.egg;
      oval(ctx, -0.3, -0.2, 3.4, 4.4, 0);
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      oval(ctx, -1.3, -1.8, 0.9, 1.6, -0.3);
    });
    resetXf();
  };

  const drawBullets = () => {
    const s = LAYOUT.itemScale;
    // Long side runs along the firing axis.
    const glowW = (VERTICAL ? 5.2 : 13) * s;
    const glowH = (VERTICAL ? 13 : 5.2) * s;
    const coreW = (VERTICAL ? 2 : 10) * s;
    const coreH = (VERTICAL ? 10 : 2) * s;
    ctx.fillStyle = PALETTE.laserGlow;
    game.bullets.forEach((b) => {
      ctx.fillRect(toX(b.u, b.v) - glowW / 2, toY(b.u, b.v) - glowH / 2, glowW, glowH);
    });
    ctx.fillStyle = PALETTE.laser;
    game.bullets.forEach((b) => {
      ctx.fillRect(toX(b.u, b.v) - coreW / 2, toY(b.u, b.v) - coreH / 2, coreW, coreH);
    });
  };

  const drawShip = (time) => {
    if (!game.shipAlive) {
      return;
    }
    const s = LAYOUT.shipScale;
    const blinkOff = game.invuln > 0 && Math.floor(game.invuln * 14) % 2 === 0;
    const bank = clamp(game.shipVu / (520 * Math.max(s, 0.5)), -0.35, 0.35);
    const x = toX(game.shipU, SHIP_V);
    const y = toY(game.shipU, SHIP_V);

    if (game.spreadTimer > 0) {
      const left = game.spreadTimer / SPREAD_TIME;
      ctx.strokeStyle = PALETTE.power;
      ctx.globalAlpha = 0.25 + Math.sin(time * 10) * 0.08;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(x, y, 21 * s, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.arc(x, y, 21 * s, -Math.PI / 2, -Math.PI / 2 + TAU * left);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = blinkOff ? 0.3 : 1;
    setXf(x, y, SHIP_ROT + bank * 0.35, (1 - Math.abs(bank) * 0.5) * s, s);
    const flick = 0.8 + Math.sin(time * 47) * 0.12 + Math.random() * 0.18;
    [-2.8, 2.8].forEach((nx) => {
      ctx.fillStyle = PALETTE.flame;
      ctx.beginPath();
      ctx.moveTo(nx - 1.9, 13.4);
      ctx.quadraticCurveTo(nx, 13.4 + 13 * flick, nx + 1.9, 13.4);
      ctx.fill();
      ctx.fillStyle = PALETTE.flameCore;
      ctx.beginPath();
      ctx.moveTo(nx - 1, 13.4);
      ctx.quadraticCurveTo(nx, 13.4 + 7 * flick, nx + 1, 13.4);
      ctx.fill();
    });
    ctx.drawImage(shipSprite.canvas, 0, 0, shipSprite.cw, shipSprite.ch,
      -shipSprite.w / 2 / s, -shipSprite.h / 2 / s, shipSprite.w / s, shipSprite.h / s);
    if (game.muzzle > 0) {
      ctx.fillStyle = PALETTE.laser;
      ctx.globalAlpha = blinkOff ? 0.3 : 0.9;
      disc(ctx, 0, -16, 2.6 + game.muzzle * 30);
    }
    resetXf();
    ctx.globalAlpha = 1;
  };

  const drawPickups = (time) => {
    const s = LAYOUT.itemScale;
    game.pickups.forEach((item) => {
      const pulse = 1 + Math.sin(time * 8 + item.age) * 0.12;
      const x = toX(item.u, item.v);
      const y = toY(item.u, item.v);
      if (item.kind === "drum") {
        ctx.fillStyle = "rgba(255, 196, 90, 0.2)";
        disc(ctx, x, y, 11 * pulse * s);
        setXf(x, y, item.rot, s, s);
        ctx.fillStyle = PALETTE.bone;
        ctx.fillRect(-9, -1.2, 7, 2.4);
        ctx.beginPath();
        ctx.arc(-9.3, -1.7, 1.9, 0, TAU);
        ctx.moveTo(-7.4, 1.7);
        ctx.arc(-9.3, 1.7, 1.9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = PALETTE.drumDark;
        oval(ctx, 2.6, 0.7, 7, 5.3, 0);
        ctx.fillStyle = PALETTE.drum;
        oval(ctx, 2.2, 0, 6.4, 4.6, 0);
        ctx.fillStyle = PALETTE.drumHi;
        oval(ctx, 1.2, -1.8, 3.4, 1.4, -0.1);
      } else {
        ctx.strokeStyle = PALETTE.power;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.arc(x, y, 13 * pulse * s, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        setXf(x, y, item.rot, s, s);
        ctx.fillStyle = PALETTE.giftDark;
        ctx.fillRect(-7, -2, 14, 10);
        ctx.fillStyle = PALETTE.gift;
        ctx.fillRect(-7, -2, 10, 10);
        ctx.fillStyle = PALETTE.wingHi;
        ctx.fillRect(-8, -6, 16, 4.5);
        ctx.fillStyle = PALETTE.ribbon;
        ctx.fillRect(-1.4, -6, 2.8, 14);
        ctx.beginPath();
        ctx.ellipse(-3.2, -8, 3, 1.9, 0.5, 0, TAU);
        ctx.ellipse(3.2, -8, 3, 1.9, -0.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#fff6c8";
        disc(ctx, 0, -7, 1.5);
      }
      resetXf();
    });
  };

  const drawFeathers = () => {
    ctx.fillStyle = PALETTE.feather;
    ctx.strokeStyle = "rgba(160, 140, 120, 0.7)";
    ctx.lineWidth = 0.5;
    game.feathers.forEach((f) => {
      const t = f.age / f.life;
      ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
      setXf(f.x, f.y, f.rot, f.size, f.size);
      oval(ctx, 0, 0, 3.8, 1.4, 0);
      ctx.beginPath();
      ctx.moveTo(-3.6, 0);
      ctx.lineTo(3, 0);
      ctx.stroke();
    });
    resetXf();
    ctx.globalAlpha = 1;
  };

  const drawBanner = () => {
    if (game.bannerAge >= BANNER_TIME) {
      return;
    }
    const t = game.bannerAge;
    const s = Math.max(0.01, easeOutBack(clamp(t / 0.35, 0, 1)));
    const size = LAYOUT.banner;
    const sub = LAYOUT.bannerSub;
    const cy = SAFE.y + SAFE.h / 2 - (game.bannerSub ? sub * 0.7 : 0);
    ctx.globalAlpha = clamp((BANNER_TIME - t) / 0.35, 0, 1);
    setXf(SAFE.x + SAFE.w / 2, cy, 0, s, s);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = "#a3241b";
    ctx.fillText(game.banner, 0, size * 0.1);
    ctx.fillStyle = PALETTE.yolk;
    ctx.fillText(game.banner, 0, 0);
    if (game.bannerSub) {
      ctx.font = `900 ${sub}px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(game.bannerSub.toUpperCase(), 0, size * 0.5 + sub);
    }
    resetXf();
    ctx.globalAlpha = 1;
  };

  const draw = (time) => {
    drawBackdrop();
    drawSplats();

    game.hens.forEach((hen) => {
      if (hen.state === "formation") {
        drawHen(hen, time);
      }
    });
    game.hens.forEach((hen) => {
      if (hen.state !== "formation") {
        drawHen(hen, time);
      }
    });

    drawEggs();
    drawBullets();
    drawShip(time);
    drawPickups(time);
    drawFeathers();
    drawFx();
    drawBanner();

    if (game.flash > 0) {
      ctx.globalAlpha = game.flash * 0.5;
      ctx.fillStyle = PALETTE.hurt;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    }
  };

  /* -- Input */

  // The steering axis: finger x in popup/rail, finger y in the strip.
  const lateral = (point) => (VERTICAL ? point.x : point.y);

  const onPointerDown = (point, event) => {
    if (!game.shipAlive) {
      return;
    }
    // Relative drag: the ship keeps its place and follows finger travel.
    game.dragging = true;
    game.dragId = event && event.pointerId !== undefined ? event.pointerId : 0;
    game.dragStart = lateral(point);
    game.dragShipU = game.targetU;
  };

  const onPointerMove = (point, event) => {
    if (!game.dragging || (event && event.pointerId !== undefined && event.pointerId !== game.dragId)) {
      return;
    }
    const raw = game.dragShipU + (lateral(point) - game.dragStart) * LAYOUT.dragGain;
    const next = clamp(raw, SHIP_MIN, SHIP_MAX);
    if (next !== raw) {
      // Re-anchor at the wall so reversing direction responds immediately.
      game.dragShipU = next;
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

  const onKey = (key, down) => {
    if (MINUS_KEYS.includes(key)) {
      game.keyMinus = down;
      return true;
    }
    if (PLUS_KEYS.includes(key)) {
      game.keyPlus = down;
      return true;
    }
    return key === " " || key.startsWith("Arrow");
  };

  // Seed the attract scene: the flock streams in behind the intro panel.
  resetGame();
  game.bannerAge = BANNER_TIME;

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
