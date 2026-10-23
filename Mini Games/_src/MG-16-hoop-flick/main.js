(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-hoop-flick",         // CustomEvent namespace
    api: "mgHoopFlick",                   // window.<api> handle
    campaign: "pulse-p2",
    offer: "−25%",
    winTitle: "Nothing but net!",
    loseTitle: "So close!",
    goal: 10,                               // points: 2 a basket, 3 a swish
    maxPlayMs: 30000,                       // hard stop: a session never runs past this
    idleStopMs: 30000                       // stop the attract loop after this long untouched
  };

  const PALETTE = {
    wall: ["#090d2a", "#1d1c55"],
    light: "255, 232, 200",
    crowd: ["#ff6b8a", "#ffd166", "#6be3ff", "#b18cff"],
    floor: ["#a8693a", "#d39457", "#c07c45"],
    plank: "rgba(80, 38, 12, 0.22)",
    paint: "rgba(255, 79, 58, 0.3)",
    courtLine: "rgba(255, 248, 236, 0.8)",
    banner: "#120f36",
    bannerInk: "#ff6a4d",
    board: ["rgba(255, 255, 255, 0.95)", "rgba(214, 228, 245, 0.88)"],
    boardEdge: "#ff4f3a",
    rim: "#ff5a1f",
    rimDark: "#9a2a08",
    rimHot: "#ffd27a",
    net: "rgba(255, 255, 255, 0.9)",
    netBack: "rgba(255, 255, 255, 0.4)",
    cable: "#3a3f5c",
    ball: ["#ffc483", "#f2741d", "#8f3305"],
    seam: "#3a1604",
    meter: ["#ff5a3a", "#5dff9a", "#ff5a3a"],
    text: "#ffffff",
    swish: "#ffe066",
    miss: "#c9cde0"
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

  // World units are the creative's authored pixels (300x250, 200x480,
  // 1456x180); drawing is scaled by 1/K so the court keeps one physical size.
  // Popup and rail are pseudo-3D: the ball lives in x right, y up, z into the
  // screen and is projected with a pinhole camera (one unit is one pixel at
  // z = 0, so the resting ball and the finger share a scale). The strip is
  // too short for depth, so it plays as a 2D side view with the same rules.
  const WW = WIDTH * K;
  const WH = HEIGHT * K;
  const WSAFE = { x: SAFE.x * K, y: SAFE.y * K, w: SAFE.w * K, h: SAFE.h * K };
  const SIDE = FORMAT === "strip";

  const TAU = Math.PI * 2;
  const STEP = 1 / 120;                 // fixed physics step
  const MAX_STEPS = 8;
  const VIEW = FORMAT === "rail"
    ? { cx: 100, horizon: 125, eye: 440, focal: 300 }
    : { cx: 150, horizon: 34, eye: 339, focal: 220 };
  const GRAVITY = 1450;
  const BALL_R = 22;
  const START = { x: 0, y: 153, z: 0 };
  const HOOP = { z: 400, y: 150, r: 44, tube: 2.5, net: 48, slideAfter: 3, slideAmp: 55, slideSpeed: 0.9, ramp: 1.5 };
  const BOARD = { z: 456, w: 150, y0: 140, y1: 236 };
  const WALL_Z = 600;
  const FLIGHT_T = 0.9;                 // seconds from release to rim height on a perfect flick
  const BOUNCE = { rim: 0.55, board: 0.6, floor: 0.55, wall: 0.5 };
  // Strip side view (y down): ball on the left, hoop ~300 units to its right.
  const FLAT = {
    floor: 170, r: 14, startX: WSAFE.x + WSAFE.w * 0.3, startY: 136, rimY: 92, rimR: 30, gap: 300,
    net: 30, boardGap: 6, boardTop: 44, boardBottom: 104, gravity: 620, refAngle: (54 * Math.PI) / 180
  };
  // Intentional assist, disclosed: a flick whose power and aim land within
  // these tolerances is steered to drop through the (possibly moving) hoop.
  // A little residual jitter keeps some rim rattles, so it never feels canned.
  // The side view only needs the power check; any upward flick counts as aim.
  const ASSIST = { power: 0.27, aim: 60, keepZ: 16, keepX: 13, keepFlat: 6 };
  // Flick power = base + length + speed; 1.0 is a perfect-depth throw.
  const FLICK = { minUp: 14, base: 0.4, perPx: 0.0045, perSpeed: 0.00035, maxSpeed: 2200, window: 110, aimSpread: 170 };
  const METER = { period: 1.3, lo: 0.35, hi: 1.55, autoFire: 3 };
  const KEY_AIM = { speed: 160, max: 140, turn: 0.9, minAngle: 0.52, maxAngle: 1.4 };
  const POINTS = { basket: 2, swish: 3 };
  const RESPAWN = 0.28;
  const DEMO_EVERY = 1.4;
  const WIN_DELAY = 0.9;
  const TEXT = Math.max(9, 7 * K);       // canvas text never under 7 served px

  const proj = (x, y, z) => {
    const s = VIEW.focal / (VIEW.focal + z);
    return { x: VIEW.cx + x * s, y: VIEW.horizon + (VIEW.eye - y) * s, s };
  };

  // Effects live in served pixels.
  const fxBurst = (x, y, color, count, speed) => burst(x / K, y / K, color, count, speed / Math.sqrt(K));
  const fxText = (x, y, text, color) => floatText(x / K, y / K, text, color);

  const newBall = () => ({
    x: SIDE ? FLAT.startX : START.x, y: SIDE ? FLAT.startY : START.y, z: START.z,
    vx: 0, vy: 0, vz: 0,
    spin: 0, spinV: 0,
    state: "spawn",       // spawn | ready | fly
    t: 0, age: 0, bounces: 0, doneT: 0,
    rimHit: false, boardHit: false, scored: false
  });

  // Per-round state; resetGame() restores it.
  const freshState = () => ({
    ball: newBall(),
    acc: 0,
    baskets: 0,
    slideT: 0,
    hoopX: 0,
    swipe: null,          // { x0, y0, samples } while a finger is on the glass
    meter: null,          // seconds the keyboard power meter has run, or null
    keys: { left: false, right: false },
    aimX: 0,
    aimAngle: FLAT.refAngle,
    keyAim: false,
    hinted: false,
    netS: 0,
    netV: 0,
    rimFlash: 0,
    boardFlash: 0,
    demoT: 0,
    winT: 0
  });

  const game = { ...freshState(), time: 0 };

  const hoopOffset = (slideT) => (slideT <= 0
    ? 0
    : Math.sin(slideT * HOOP.slideSpeed) * HOOP.slideAmp * Math.min(1, slideT / HOOP.ramp));

  // Side view: where the rim's center is for a given hoop offset.
  const rimX = (offset = game.hoopX) => FLAT.startX + FLAT.gap + offset;

  const shade = (gradient, colors) => {
    colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
    return gradient;
  };

  const seeded = (seed) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const font = (size) => `900 ${size}px Arial, Helvetica, sans-serif`;

  const makeLayer = (paint) => {
    const layer = document.createElement("canvas");
    layer.width = Math.round(WIDTH * DPR);
    layer.height = Math.round(HEIGHT * DPR);
    const lctx = layer.getContext("2d");
    lctx.setTransform(DPR / K, 0, 0, DPR / K, 0, 0);
    paint(lctx);
    return layer;
  };

  // Shared arena dressing: crowd bokeh and spotlights above `floorY`.
  const paintArena = (c, rnd, floorY) => {
    c.fillStyle = shade(c.createLinearGradient(0, 0, 0, floorY), PALETTE.wall);
    c.fillRect(0, 0, WW, floorY);
    const top = Math.max(20, WSAFE.y - 4);
    for (let index = 0; index < (WW * (floorY - top)) / 220; index += 1) {
      c.globalAlpha = 0.1 + rnd() * 0.28;
      c.fillStyle = PALETTE.crowd[index % PALETTE.crowd.length];
      c.beginPath();
      c.arc(rnd() * WW, top + rnd() * Math.max(10, floorY - top - 25), 0.8 + rnd() * 2.2, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    const lights = Math.max(3, Math.round(WW / 100));
    for (let index = 0; index < lights; index += 1) {
      const x = (WW * (index + 0.5)) / lights;
      c.fillStyle = shade(c.createRadialGradient(x, 0, 2, x, 0, 95), [`rgba(${PALETTE.light}, 0.32)`, `rgba(${PALETTE.light}, 0)`]);
      c.fillRect(x - 95, 0, 190, 100);
    }
  };

  // A lit brand panel for the spare wall space in the rail and strip.
  const paintPanel = (c, x0, y0, x1, y1, big, small) => {
    c.fillStyle = PALETTE.banner;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.strokeStyle = PALETTE.bannerInk;
    c.lineWidth = 2;
    c.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = PALETTE.bannerInk;
    c.font = font(big);
    c.fillText("PULSE P2", (x0 + x1) / 2, (y0 + y1) / 2 - small * 0.7);
    c.fillStyle = PALETTE.text;
    c.font = font(small);
    c.fillText("HEAR EVERY SWISH", (x0 + x1) / 2, (y0 + y1) / 2 + big * 0.55);
  };

  // Arena wall, crowd, banner and the court floor never move: paint once.
  const bgLayer = makeLayer((c) => {
    const rnd = seeded(11);
    if (SIDE) {
      const floorTop = FLAT.floor - 12;
      paintArena(c, rnd, floorTop);
      c.fillStyle = shade(c.createLinearGradient(0, floorTop, 0, WH), PALETTE.floor);
      c.fillRect(0, floorTop, WW, WH - floorTop);
      c.strokeStyle = PALETTE.plank;
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 0; x < WW; x += 46) {
        c.moveTo(x, floorTop + 2);
        c.lineTo(x - 14, WH);
      }
      c.stroke();
      c.strokeStyle = PALETTE.courtLine;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(0, floorTop + 4);
      c.lineTo(WW, floorTop + 4);
      c.stroke();
      const x0 = rimX(HOOP.slideAmp) + FLAT.rimR + 70;
      const x1 = WSAFE.x + WSAFE.w - 14;
      if (x1 - x0 > 180) {
        paintPanel(c, x0, 26, x1, floorTop - 14, 34, 24);
      }
      return;
    }
    const floorY = proj(0, 0, WALL_Z).y;
    paintArena(c, rnd, floorY);
    c.fillStyle = PALETTE.banner;
    c.fillRect(0, floorY - 13, WW, 12);
    if (FORMAT === "popup") {
      c.fillStyle = PALETTE.bannerInk;
      c.font = font(7);
      c.textAlign = "center";
      c.textBaseline = "middle";
      // Kept clear of the middle, where the net hangs in front of the banner.
      c.fillText("PULSE P2  ·  EARBUDS", 64, floorY - 7);
      c.fillText("HEAR EVERY SWISH", 236, floorY - 7);
    } else {
      // The rail's tall wall has room for a scoreboard-style panel.
      paintPanel(c, 16, WSAFE.y + 18, WW - 16, WSAFE.y + 82, 22, 14);
    }

    c.fillStyle = shade(c.createLinearGradient(0, floorY, 0, WH), PALETTE.floor);
    c.fillRect(0, floorY, WW, WH - floorY);
    c.strokeStyle = PALETTE.plank;
    c.lineWidth = 1;
    c.beginPath();
    for (let x = -900; x <= 900; x += 36) {
      const far = proj(x, 0, WALL_Z);
      const near = proj(x, 0, 0);
      c.moveTo(far.x, far.y);
      c.lineTo(near.x, near.y);
    }
    c.stroke();

    const floorPath = (points) => {
      c.beginPath();
      points.forEach(([x, z], index) => {
        const p = proj(x, 0, z);
        if (index) {
          c.lineTo(p.x, p.y);
        } else {
          c.moveTo(p.x, p.y);
        }
      });
    };
    floorPath([[-80, 540], [80, 540], [80, 330], [-80, 330]]);
    c.closePath();
    c.fillStyle = PALETTE.paint;
    c.fill();
    c.strokeStyle = PALETTE.courtLine;
    c.lineWidth = 1.2;
    c.stroke();
    floorPath([[-900, 540], [900, 540]]);
    c.stroke();
    const arc = [];
    for (let index = 0; index <= 20; index += 1) {
      const t = Math.PI + (index / 20) * Math.PI;
      arc.push([Math.cos(t) * 80, 330 + Math.sin(t) * 80]);
    }
    floorPath(arc);
    c.stroke();

    const glow = proj(0, 0, 420);
    c.fillStyle = shade(c.createRadialGradient(glow.x, glow.y, 4, glow.x, glow.y, 120), ["rgba(255, 220, 170, 0.28)", "rgba(255, 220, 170, 0)"]);
    c.fillRect(0, floorY, WW, WH - floorY);
    c.fillStyle = shade(c.createRadialGradient(WW / 2, floorY, 90, WW / 2, floorY, Math.max(WW, WH) * 0.7), ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.45)"]);
    c.fillRect(0, 0, WW, WH);
  });

  const resetGame = () => {
    Object.assign(game, freshState());
  };

  /* ---- physics: pseudo-3D */

  // The rim is a torus: find the closest point on its center circle.
  const collideRim = (b) => {
    const dx = b.x - game.hoopX;
    const dz = b.z - HOOP.z;
    const flat = Math.hypot(dx, dz);
    if (flat < 0.001) {
      return;
    }
    const ex = b.x - (game.hoopX + (dx / flat) * HOOP.r);
    const ey = b.y - HOOP.y;
    const ez = b.z - (HOOP.z + (dz / flat) * HOOP.r);
    const d = Math.hypot(ex, ey, ez);
    const reach = BALL_R + HOOP.tube;
    if (d >= reach || d < 0.001) {
      return;
    }
    const nx = ex / d;
    const ny = ey / d;
    const nz = ez / d;
    b.x += nx * (reach - d);
    b.y += ny * (reach - d);
    b.z += nz * (reach - d);
    const vn = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vn >= 0) {
      return;
    }
    b.vx = (b.vx - (1 + BOUNCE.rim) * vn * nx) * 0.94;
    b.vy -= (1 + BOUNCE.rim) * vn * ny;
    b.vz = (b.vz - (1 + BOUNCE.rim) * vn * nz) * 0.94;
    b.spinV *= -0.6;
    b.rimHit = true;
    if (vn < -80) {
      game.rimFlash = 1;
    }
  };

  const collideBoard = (b) => {
    if (b.vz <= 0 || b.z + BALL_R < BOARD.z || b.z > BOARD.z + 6) {
      return;
    }
    if (Math.abs(b.x - game.hoopX) > BOARD.w / 2 + BALL_R * 0.4 || b.y < BOARD.y0 - BALL_R * 0.4 || b.y > BOARD.y1 + BALL_R * 0.4) {
      return;
    }
    b.z = BOARD.z - BALL_R;
    b.vz = -b.vz * BOUNCE.board;
    b.vx *= 0.9;
    b.boardHit = true;
    game.boardFlash = 1;
  };

  // Where scoring effects appear, in world units.
  const hoopPoint = () => (SIDE ? { x: rimX(), y: FLAT.rimY } : proj(game.hoopX, HOOP.y, HOOP.z));

  const scoreBasket = (b) => {
    b.scored = true;
    game.netV = reduceMotion ? 3 : 9;
    const swish = !b.rimHit && !b.boardHit;
    const at = hoopPoint();
    fxBurst(at.x, at.y + 6, swish ? PALETTE.swish : PALETTE.rim, 14, 90);
    fxBurst(at.x, at.y + 6, "#ffffff", 8, 60);
    if (Shell.phase !== "play") {
      return;
    }
    const points = swish ? POINTS.swish : POINTS.basket;
    game.baskets += 1;
    setScore(Shell.score + points);
    fxText(at.x, at.y - 16, swish ? `SWISH +${points}` : b.boardHit ? `BANK +${points}` : `+${points}`, swish ? PALETTE.swish : PALETTE.text);
    if (swish) {
      shake();
    }
    if (game.baskets === HOOP.slideAfter && Shell.score < CONFIG.goal) {
      fxText(SIDE ? at.x : WW / 2, SIDE ? 40 : WSAFE.y + 28, "HOOP ON THE MOVE!", PALETTE.bannerInk);
    }
  };

  const stepBall3D = (b, h) => {
    const prevY = b.y;
    b.vy -= GRAVITY * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.z += b.vz * h;
    collideRim(b);
    collideBoard(b);
    if (b.y < BALL_R) {
      b.y = BALL_R;
      if (b.vy < 0) {
        b.vy = -b.vy * BOUNCE.floor;
        b.vx *= 0.85;
        b.vz *= 0.85;
        b.bounces += 1;
      }
    }
    if (b.z > WALL_Z - BALL_R) {
      b.z = WALL_Z - BALL_R;
      b.vz = -Math.abs(b.vz) * BOUNCE.wall;
    }
    const inside = Math.hypot(b.x - game.hoopX, b.z - HOOP.z);
    if (!b.scored && prevY >= HOOP.y && b.y < HOOP.y && b.vy < 0 && inside < HOOP.r - 4) {
      scoreBasket(b);
    }
    if (b.scored && b.y < HOOP.y && b.y > HOOP.y - HOOP.net - BALL_R * 0.5) {
      // The net grabs the ball and funnels it straight down.
      b.vx *= 0.96;
      b.vz *= 0.96;
      b.vy *= 0.99;
      b.x += (game.hoopX - b.x) * 0.05;
      b.z += (HOOP.z - b.z) * 0.05;
    }
  };

  const throw3D = (b, p, aimX) => {
    let t = FLIGHT_T * Math.sqrt(p);
    let zT = HOOP.z * p;
    let xT = aimX;
    const hoopLater = hoopOffset(game.slideT + (game.baskets >= HOOP.slideAfter ? FLIGHT_T : 0));
    if (Math.abs(p - 1) < ASSIST.power && Math.abs(xT - hoopLater) < ASSIST.aim) {
      t = FLIGHT_T;
      zT = HOOP.z + rand(-1, 1) * ASSIST.keepZ;
      xT = hoopLater + rand(-1, 1) * ASSIST.keepX;
    }
    b.vx = (xT - b.x) / t;
    b.vz = (zT - b.z) / t;
    b.vy = (HOOP.y - b.y + 0.5 * GRAVITY * t * t) / t;
  };

  /* ---- physics: side view (strip) */

  const bounceCircle = (b, px, py, reach, restitution) => {
    const dx = b.x - px;
    const dy = b.y - py;
    const d = Math.hypot(dx, dy);
    if (d >= reach || d < 0.001) {
      return 0;
    }
    const nx = dx / d;
    const ny = dy / d;
    b.x = px + nx * reach;
    b.y = py + ny * reach;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) {
      return 0;
    }
    b.vx = (b.vx - (1 + restitution) * vn * nx) * 0.95;
    b.vy -= (1 + restitution) * vn * ny;
    return -vn;
  };

  const stepBallFlat = (b, h) => {
    const prevY = b.y;
    const rx = rimX();
    b.vy += FLAT.gravity * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    [rx - FLAT.rimR, rx + FLAT.rimR].forEach((edge) => {
      const hit = bounceCircle(b, edge, FLAT.rimY, FLAT.r + HOOP.tube, BOUNCE.rim);
      if (hit) {
        b.rimHit = true;
        b.spinV *= -0.6;
        if (hit > 80) {
          game.rimFlash = 1;
        }
      }
    });
    const boardX = rx + FLAT.rimR + FLAT.boardGap + 2.5;
    if (bounceCircle(b, boardX, clamp(b.y, FLAT.boardTop, FLAT.boardBottom), FLAT.r + 2.5, BOUNCE.board)) {
      b.boardHit = true;
      game.boardFlash = 1;
    }
    if (b.y > FLAT.floor - FLAT.r) {
      b.y = FLAT.floor - FLAT.r;
      if (b.vy > 0) {
        b.vy = -b.vy * BOUNCE.floor;
        b.vx *= 0.85;
        b.bounces += 1;
      }
    }
    if (!b.scored && prevY <= FLAT.rimY && b.y > FLAT.rimY && b.vy > 0 && Math.abs(b.x - rx) < FLAT.rimR - 3) {
      scoreBasket(b);
    }
    if (b.scored && b.y > FLAT.rimY && b.y < FLAT.rimY + FLAT.net + FLAT.r * 0.5) {
      b.vx *= 0.96;
      b.vy *= 0.99;
      b.x += (rx - b.x) * 0.05;
    }
  };

  // Launch speed that carries the ball from its start through the rim center.
  const speedFor = (angle, dx) => {
    const dy = FLAT.startY - FLAT.rimY;
    const lift = dx * Math.tan(angle) - dy;
    return lift > 1 ? Math.sqrt((FLAT.gravity * dx * dx) / (2 * Math.cos(angle) ** 2 * lift)) : 0;
  };
  const FLAT_SPEED = speedFor(FLAT.refAngle, FLAT.gap);   // a power-1.0 flick

  const throwFlat = (b, p, angle) => {
    let a = clamp(angle, 0.26, 1.48);
    let v = p * FLAT_SPEED;
    if (Math.abs(p - 1) < ASSIST.power && angle > 0.4) {
      // Assisted: a comfortable arc that clears the top of the band, aimed
      // where the moving hoop will be when the ball gets there.
      a = clamp(angle, 0.92, 1.0);
      let target = rimX();
      for (let pass = 0; pass < 3; pass += 1) {
        v = speedFor(a, target - b.x);
        while (a > 0.7 && FLAT.startY - (v * Math.sin(a)) ** 2 / (2 * FLAT.gravity) < 8) {
          a -= 0.035;
          v = speedFor(a, target - b.x);
        }
        const t = (target - b.x) / Math.max(1, v * Math.cos(a));
        target = rimX(hoopOffset(game.slideT + (game.baskets >= HOOP.slideAfter ? t : 0))) + rand(-1, 1) * ASSIST.keepFlat;
      }
      v = speedFor(a, target - b.x);
    }
    b.vx = v * Math.cos(a);
    b.vy = -v * Math.sin(a);
  };

  /* ---- shared */

  const throwBall = (power, aim) => {
    const b = game.ball;
    if (b.state === "fly" || game.winT > 0) {
      return;
    }
    const p = clamp(power, 0.3, 1.6);
    if (SIDE) {
      throwFlat(b, p, aim);
    } else {
      throw3D(b, p, aim);
    }
    b.state = "fly";
    b.age = 0;
    b.spinV = SIDE ? 9 : -9;
    game.hinted = true;
    game.demoT = 0;
  };

  const stepBall = (b, h) => {
    b.age += h;
    b.spin += b.spinV * h;
    if (SIDE) {
      stepBallFlat(b, h);
    } else {
      stepBall3D(b, h);
    }
  };

  const ballDone = (b) => (b.scored
    ? b.doneT > 0.65
    : b.age > 2.3 || b.bounces >= 2 || (b.bounces >= 1 && b.age > 1.4));

  const missText = (b) => {
    if (SIDE) {
      return [clamp(b.x, WSAFE.x + 60, rimX()), FLAT.rimY - 30];
    }
    const at = proj(b.x, Math.max(b.y, HOOP.y), Math.min(b.z, HOOP.z));
    return [clamp(at.x, 30, WW - 30), clamp(at.y, WSAFE.y + 16, at.y)];
  };

  const stepWorld = (dt) => {
    const b = game.ball;
    if (b.state === "fly") {
      game.acc = Math.min(game.acc + dt, STEP * MAX_STEPS);
      while (game.acc >= STEP) {
        stepBall(b, STEP);
        game.acc -= STEP;
      }
      if (b.scored) {
        b.doneT += dt;
      }
      if (ballDone(b)) {
        if (!b.scored && Shell.phase === "play") {
          const [x, y] = missText(b);
          fxText(x, y, b.rimHit ? "SO CLOSE!" : "MISS", PALETTE.miss);
        }
        game.ball = newBall();
      }
    } else {
      game.acc = 0;
      b.t += dt;
      if (b.state === "spawn" && b.t >= RESPAWN) {
        b.state = "ready";
      }
    }
    // Damped spring for the net's stretch.
    game.netV += (-game.netS * 140 - game.netV * 9) * dt;
    game.netS = clamp(game.netS + game.netV * dt, -0.6, 1.4);
    game.rimFlash = Math.max(0, game.rimFlash - dt * 4);
    game.boardFlash = Math.max(0, game.boardFlash - dt * 4);
  };

  const meterValue = () => {
    const u = (game.meter / METER.period) % 1;
    return METER.lo + (METER.hi - METER.lo) * (1 - Math.abs(u * 2 - 1));
  };

  const fireMeter = () => {
    const power = meterValue();
    game.meter = null;
    throwBall(power, SIDE ? game.aimAngle : game.aimX);
  };

  const advanceHoop = (dt) => {
    game.time += dt;
    if (game.baskets >= HOOP.slideAfter) {
      game.slideT += dt;
    }
    game.hoopX = hoopOffset(game.slideT);
  };

  const endSummary = () => `${game.baskets} baskets · ${Shell.score} pts`;

  // Runs only in the play phase.
  const update = (dt) => {
    advanceHoop(dt);
    if (game.keyAim) {
      const dir = (game.keys.right ? 1 : 0) - (game.keys.left ? 1 : 0);
      if (SIDE) {
        game.aimAngle = clamp(game.aimAngle - dir * KEY_AIM.turn * dt, KEY_AIM.minAngle, KEY_AIM.maxAngle);
      } else {
        game.aimX = clamp(game.aimX + dir * KEY_AIM.speed * dt, -KEY_AIM.max, KEY_AIM.max);
      }
    }
    if (game.meter !== null) {
      game.meter += dt;
      if (game.meter > METER.autoFire) {
        fireMeter();
      }
    }
    stepWorld(dt);
    if (Shell.score >= CONFIG.goal) {
      game.winT += dt;
      if (game.winT > WIN_DELAY) {
        endGame(true);
      }
    }
  };

  // Attract motion behind the intro and end panels: demo shots in the intro.
  const idle = (dt) => {
    advanceHoop(dt);
    if (Shell.phase === "intro" && game.ball.state === "ready") {
      game.demoT += dt;
      if (game.demoT > DEMO_EVERY) {
        throwBall(1, SIDE ? FLAT.refAngle : game.hoopX);
      }
    }
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

  const label = (text, x, y, align = "center") => {
    ctx.font = font(TEXT);
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
  };

  const paintBoard = (x, y, w, h) => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x + 2, y + 3, w, h);
    ctx.fillStyle = shade(ctx.createLinearGradient(x, y, x + w, y + h), PALETTE.board);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.boardEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    if (game.boardFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${game.boardFlash * 0.6})`;
      ctx.fillRect(x, y, w, h);
    }
  };

  const drawBoard = () => {
    const hx = game.hoopX;
    const tl = proj(hx - BOARD.w / 2, BOARD.y1, BOARD.z);
    const br = proj(hx + BOARD.w / 2, BOARD.y0, BOARD.z);
    // On the rail the board hangs from the wall panel rather than the roof.
    const cableTop = FORMAT === "rail" ? WSAFE.y + 82 : 0;
    strokePath([[tl.x + 7, tl.y], [tl.x + 3, cableTop]], PALETTE.cable, 1.2);
    strokePath([[br.x - 7, tl.y], [br.x - 3, cableTop]], PALETTE.cable, 1.2);
    paintBoard(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    const a = proj(hx - 30, HOOP.y + 36, BOARD.z);
    const b = proj(hx + 30, HOOP.y + 3, BOARD.z);
    ctx.lineWidth = 1.3;
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    if (FORMAT === "popup") {
      ctx.fillStyle = PALETTE.boardEdge;
      ctx.font = font(5);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PULSE", hx * a.s + VIEW.cx, tl.y + 5);
    }
    const bracket = proj(hx, HOOP.y - 6, BOARD.z);
    const rimBack = proj(hx, HOOP.y, HOOP.z + HOOP.r);
    ctx.fillStyle = PALETTE.rimDark;
    ctx.fillRect(bracket.x - 2.5, rimBack.y - 1, 5, bracket.y - rimBack.y + 2);
  };

  const ringPoints = (r, y, from, sway = 0) => {
    const points = [];
    for (let index = 0; index <= 16; index += 1) {
      const t = from + (index / 16) * Math.PI;
      const p = proj(game.hoopX + Math.cos(t) * r + sway, y, HOOP.z + Math.sin(t) * r);
      points.push([p.x, p.y]);
    }
    return points;
  };

  // Back half (far side, sin > 0) is drawn before the ball, front half after.
  const drawRim = (back) => {
    const points = ringPoints(HOOP.r, HOOP.y, back ? 0 : Math.PI);
    ctx.lineCap = "round";
    strokePath(points.map(([x, y]) => [x, y + 1.2]), PALETTE.rimDark, 2.6);
    strokePath(points, game.rimFlash > 0.3 ? PALETTE.rimHot : PALETTE.rim, 2.2);
  };

  const netPoint = (level, t) => {
    const stretch = game.netS;
    const r = HOOP.r * (level === 0 ? 1 : level === 1 ? 0.8 - 0.08 * stretch : 0.6 - 0.12 * stretch);
    const y = HOOP.y - (level === 0 ? 0 : level === 1 ? 24 + stretch * 10 : HOOP.net + stretch * 24);
    const sway = reduceMotion ? 0 : Math.sin(game.time * 9) * stretch * 3 * level;
    const p = proj(game.hoopX + Math.cos(t) * r + sway, y, HOOP.z + Math.sin(t) * r);
    return [p.x, p.y];
  };

  const drawNet = (back) => {
    const strands = 12;
    const step = TAU / strands;
    ctx.strokeStyle = back ? PALETTE.netBack : PALETTE.net;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let index = 0; index < strands; index += 1) {
      const t = index * step + step / 2;
      if ((Math.sin(t) > 0) !== back) {
        continue;
      }
      [-1, 1].forEach((dir) => {
        const [x0, y0] = netPoint(0, t);
        const [x1, y1] = netPoint(1, t + (dir * step) / 2);
        const [x2, y2] = netPoint(2, t + dir * step);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
      });
    }
    ctx.stroke();
    const from = back ? 0 : Math.PI;
    const bottom = [];
    for (let index = 0; index <= 8; index += 1) {
      bottom.push(netPoint(2, from + (index / 8) * Math.PI));
    }
    strokePath(bottom, back ? PALETTE.netBack : PALETTE.net, 0.8);
  };

  const drawShadow = (b) => {
    const floor = proj(b.x, 0, b.z);
    if (floor.y > WH + 8) {
      return;
    }
    ctx.fillStyle = `rgba(30, 10, 0, ${0.38 * clamp(1 - b.y / 420, 0.15, 1)})`;
    ctx.beginPath();
    ctx.ellipse(floor.x, floor.y, BALL_R * floor.s * 0.95, BALL_R * floor.s * 0.3, 0, 0, TAU);
    ctx.fill();
  };

  const paintBall = (x, y, r, spin) => {
    if (r < 0.5) {
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    dot(0, 0, r, shade(ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r), PALETTE.ball));
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();
    ctx.rotate(spin);
    ctx.strokeStyle = PALETTE.seam;
    ctx.lineWidth = Math.max(0.6, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.moveTo(-r * 0.42, -r);
    ctx.quadraticCurveTo(-r * 0.95, 0, -r * 0.42, r);
    ctx.moveTo(r * 0.42, -r);
    ctx.quadraticCurveTo(r * 0.95, 0, r * 0.42, r);
    ctx.stroke();
    ctx.restore();
    dot(-r * 0.32, -r * 0.38, r * 0.3, "rgba(255, 255, 255, 0.22)");
    ctx.restore();
  };

  // Spawn pop and idle bob for the resting ball.
  const ballLook = (b, time) => {
    if (b.state === "spawn") {
      const t = clamp(b.t / RESPAWN, 0, 1);
      return { scale: 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2), bob: 0 };
    }
    return { scale: 1, bob: b.state === "ready" && !game.swipe && !reduceMotion ? Math.sin(time * 3) * 2 : 0 };
  };

  const drawBall = (b, time) => {
    const { scale, bob } = ballLook(b, time);
    const p = proj(b.x, b.y + bob, b.z);
    paintBall(p.x, p.y, BALL_R * p.s * scale, b.spin);
  };

  // Screen anchor for hints and the meter, just above the resting ball.
  const ballTop = () => (SIDE
    ? { x: game.ball.x, y: game.ball.y - FLAT.r }
    : proj(game.ball.x, game.ball.y + BALL_R, 0));

  const drawHint = (time) => {
    const base = ballTop();
    const dir = SIDE ? { x: Math.cos(FLAT.refAngle), y: -Math.sin(FLAT.refAngle) } : { x: 0, y: -1 };
    const nx = -dir.y;
    const ny = dir.x;
    ctx.lineCap = "round";
    for (let index = 0; index < 3; index += 1) {
      const phase = (time * 1.6 + index / 3) % 1;
      const cx = base.x + dir.x * (8 + phase * 26);
      const cy = base.y + dir.y * (8 + phase * 26);
      ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.9;
      strokePath([
        [cx - dir.x * 5 + nx * 7, cy - dir.y * 5 + ny * 7],
        [cx, cy],
        [cx - dir.x * 5 - nx * 7, cy - dir.y * 5 - ny * 7]
      ], "#ffffff", 2.2);
    }
    ctx.globalAlpha = 1;
    if (SIDE) {
      label("FLICK TOWARD THE HOOP", base.x - FLAT.r - 18, base.y - 6, "right");
    } else {
      label("FLICK UP", base.x, base.y - 34 - (TEXT - 9));
    }
  };

  const drawAimAndMeter = () => {
    const base = ballTop();
    let to;
    if (SIDE) {
      to = { x: base.x + Math.cos(game.aimAngle) * 70, y: base.y - Math.sin(game.aimAngle) * 70 };
    } else {
      to = proj(game.aimX, HOOP.y + 60, HOOP.z);
    }
    ctx.setLineDash([3, 4]);
    strokePath([[base.x, base.y], [to.x, to.y]], "rgba(255, 255, 255, 0.45)", 1.2);
    ctx.setLineDash([]);
    if (game.meter === null) {
      return;
    }
    const x = SIDE ? base.x - FLAT.r - 18 : base.x + 36;
    const height = 44;
    const top = SIDE ? FLAT.floor - height - 6 : base.y - 24;
    const level = (value) => top + height * (1 - (value - METER.lo) / (METER.hi - METER.lo));
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(x - 1, top - 1, 8, height + 2);
    ctx.fillStyle = shade(ctx.createLinearGradient(0, top, 0, top + height), PALETTE.meter);
    const sweetTop = level(1 + ASSIST.power);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x, top, 6, height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#5dff9a";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, sweetTop, 7, level(1 - ASSIST.power) - sweetTop);
    const v = level(meterValue());
    ctx.fillRect(x, v, 6, top + height - v);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 3, v - 1, 12, 2);
  };

  // Side view: rim seen edge-on as a flat ellipse, net hanging below it.
  const drawFlatRim = (back) => {
    const rx = rimX();
    ctx.lineCap = "round";
    ctx.strokeStyle = back ? PALETTE.rimDark : game.rimFlash > 0.3 ? PALETTE.rimHot : PALETTE.rim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(rx, FLAT.rimY, FLAT.rimR, 4, 0, back ? Math.PI : 0, back ? TAU : Math.PI);
    ctx.stroke();
  };

  const drawFlatNet = () => {
    const rx = rimX();
    const s = game.netS;
    const depth = FLAT.net * (1 + 0.6 * s);
    const bottomR = FLAT.rimR * (0.6 - 0.12 * s);
    const sway = reduceMotion ? 0 : Math.sin(game.time * 9) * s * 3;
    ctx.strokeStyle = PALETTE.net;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let index = 0; index <= 4; index += 1) {
      const top = rx - FLAT.rimR + (index / 4) * FLAT.rimR * 2;
      const bottom = rx + sway - bottomR + (index / 4) * bottomR * 2;
      ctx.moveTo(top, FLAT.rimY + 2);
      ctx.lineTo(bottom + (index % 2 ? 4 : -4), FLAT.rimY + depth * 0.55);
      ctx.lineTo(bottom, FLAT.rimY + depth);
    }
    ctx.moveTo(rx + sway - bottomR, FLAT.rimY + depth);
    ctx.lineTo(rx + sway + bottomR, FLAT.rimY + depth);
    ctx.stroke();
  };

  const drawFlatScene = (time) => {
    const b = game.ball;
    const rx = rimX();
    const boardX = rx + FLAT.rimR + FLAT.boardGap;
    // Stanchion: post behind the board, arm out to it.
    ctx.fillStyle = PALETTE.cable;
    ctx.fillRect(boardX + 26, FLAT.boardTop + 10, 6, FLAT.floor - FLAT.boardTop - 16);
    ctx.fillRect(boardX + 4, FLAT.boardTop + 22, 26, 5);
    ctx.fillRect(boardX + 18, FLAT.floor - 10, 22, 6);
    paintBoard(boardX, FLAT.boardTop, 5, FLAT.boardBottom - FLAT.boardTop);
    ctx.fillStyle = PALETTE.rimDark;
    ctx.fillRect(rx + FLAT.rimR, FLAT.rimY - 2, FLAT.boardGap + 1, 4);
    if (b.state === "fly" && b.y < FLAT.floor) {
      const lift = clamp(1 - (FLAT.floor - b.y) / 200, 0.15, 1);
      ctx.fillStyle = `rgba(30, 10, 0, ${0.38 * lift})`;
      ctx.beginPath();
      ctx.ellipse(b.x, FLAT.floor - 3, FLAT.r * (0.6 + 0.4 * lift), 3, 0, 0, TAU);
      ctx.fill();
    }
    drawFlatRim(true);
    const { scale, bob } = ballLook(b, time);
    paintBall(b.x, b.y - bob, FLAT.r * scale, b.spin);
    drawFlatNet();
    drawFlatRim(false);
  };

  const draw3DScene = (time) => {
    const b = game.ball;
    const flying = b.state === "fly";
    if (flying) {
      drawShadow(b);
    }
    const rel = b.z - HOOP.z;
    const behindBoard = flying && b.z > BOARD.z;
    const behind = flying && !behindBoard && rel > HOOP.r * 0.6;
    const inside = flying && Math.abs(rel) <= HOOP.r * 0.6;
    if (behindBoard) {
      drawBall(b, time);
    }
    drawBoard();
    if (behind) {
      drawBall(b, time);
    }
    drawRim(true);
    drawNet(true);
    if (inside) {
      drawBall(b, time);
    }
    drawNet(false);
    drawRim(false);
    if (!flying || (!behind && !inside && !behindBoard)) {
      drawBall(b, time);
    }
  };

  const draw = (time) => {
    ctx.save();
    ctx.scale(1 / K, 1 / K);
    ctx.drawImage(bgLayer, 0, 0, WW, WH);
    if (SIDE) {
      drawFlatScene(time);
    } else {
      draw3DScene(time);
    }
    if (Shell.phase === "play" && game.ball.state !== "fly") {
      if (game.keyAim || game.meter !== null) {
        drawAimAndMeter();
      } else if (!game.hinted && !game.swipe) {
        drawHint(time);
      }
    }
    ctx.restore();
    drawFx();
  };

  // The side view aims by angle, so the vertical arrows steer it too.
  const KEYS = SIDE
    ? { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "left", ArrowDown: "right" }
    : { ArrowLeft: "left", ArrowRight: "right" };

  // Pointer hooks get served pixels; flicks are measured in world units.
  const toWorld = (point) => ({ x: point.x * K, y: point.y * K });

  const onPointerDown = (served) => {
    if (game.ball.state === "fly" || game.winT > 0) {
      return;
    }
    const point = toWorld(served);
    const now = performance.now();
    game.swipe = { x0: point.x, y0: point.y, samples: [{ x: point.x, y: point.y, t: now }] };
  };

  const onPointerMove = (served) => {
    const swipe = game.swipe;
    const b = game.ball;
    if (!swipe || b.state === "fly") {
      return;
    }
    const point = toWorld(served);
    const now = performance.now();
    swipe.samples.push({ x: point.x, y: point.y, t: now });
    while (swipe.samples.length > 2 && now - swipe.samples[0].t > 200) {
      swipe.samples.shift();
    }
    // The ball rides the finger a little so the flick feels grabbed.
    const ox = clamp((point.x - swipe.x0) * 0.4, -14, 14);
    const oy = clamp((swipe.y0 - point.y) * 0.35, -4, 18);
    b.x = (SIDE ? FLAT.startX : START.x) + ox;
    b.y = SIDE ? FLAT.startY - oy * 0.6 : START.y + oy;
  };

  const onPointerUp = (served, event) => {
    const swipe = game.swipe;
    const b = game.ball;
    if (!swipe) {
      return;
    }
    game.swipe = null;
    const point = toWorld(served);
    const up = swipe.y0 - point.y;
    const dx = point.x - swipe.x0;
    if ((event && event.type === "pointercancel") || up < FLICK.minUp || b.state === "fly") {
      if (b.state !== "fly") {
        b.x = SIDE ? FLAT.startX : START.x;
        b.y = SIDE ? FLAT.startY : START.y;
      }
      return;
    }
    const now = performance.now();
    const recent = swipe.samples.filter((sample) => now - sample.t <= FLICK.window);
    const first = recent[0] || swipe.samples[swipe.samples.length - 1];
    const seconds = Math.max(16, now - first.t) / 1000;
    const speed = Math.min(FLICK.maxSpeed, Math.hypot(point.x - first.x, point.y - first.y) / seconds);
    const power = FLICK.base + FLICK.perPx * Math.hypot(dx, up) + FLICK.perSpeed * speed;
    throwBall(power, SIDE ? Math.atan2(up, dx) : clamp(dx / up, -1.2, 1.2) * FLICK.aimSpread);
  };

  const onKey = (key, down, event) => {
    const dir = KEYS[key];
    if (dir) {
      game.keys[dir] = down;
      if (down) {
        game.keyAim = true;
      }
      return true;
    }
    if (key === " " || key === "Spacebar" || key === "Enter") {
      if (down && !(event && event.repeat) && game.meter === null && game.ball.state !== "fly" && !game.swipe) {
        game.meter = 0;
        game.keyAim = true;
      } else if (!down && game.meter !== null) {
        fireMeter();
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
