(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-rail-rush",           // CustomEvent namespace
    api: "mgRailRush",                     // window.<api> handle
    campaign: "vexa-dash-5",
    offer: "−25%",
    winTitle: "Finish line!",
    loseTitle: "Wiped out!",
    scoreLabel: "Distance",                // end-card eyebrow reads "<label> <score><unit>"
    scoreUnit: "m",
    goal: 500,                             // metres that count as a win (~29s with no hits)
    maxPlayMs: 45000,                      // hard stop: a session never runs past this
    idleStopMs: 30000                      // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#1b1046",
    skyMid: "#6b2a7d",
    skyLow: "#ff6f7f",
    horizon: "#ffb48a",
    sunTop: "#fff1a8",
    sunLow: "#ff7a4c",
    skyline: "#3b1f5a",
    skylineLit: "#ffc98a",
    groundTop: "#4a2f55",
    groundLow: "#1a1226",
    ballast: "#4e3c5a",
    sleeper: "#2f2130",
    rail: "#9aa3bd",
    railShine: "#ffd2b0",
    wall: "#55447a",
    wallTop: "#8a78a8",
    wallSeam: "#3a2d52",
    gantry: "#24183a",
    fog: "255, 158, 142",
    facade: ["#4b2f6e", "#3a2a63", "#5a3156"],
    facadeSide: ["#2f1d49", "#251a43", "#3a1f39"],
    window: "#ffcf87",
    windowDim: "#5e4479",
    barrier: "#ff4f5e",
    barrierLight: "#ffffff",
    post: "#2e2a3e",
    lamp: "#ffb02e",
    high: "#ffd23f",
    highInk: "#22202e",
    coin: "#ffd23f",
    coinDark: "#d38a10",
    coinLight: "#fff7c2",
    hoodie: "#7b4dff",
    hoodieDark: "#5531c9",
    pants: "#232a44",
    shoe: "#f4f6ff",
    sole: "#2ee6b8",
    pack: "#2ee6b8",
    packDark: "#139c7e",
    strap: "#1c2236",
    skin: "#f2b48c",
    phones: "#20263c",
    hit: "#ff4f5e",
    accent: "#3df5c8",
    confetti: ["#3df5c8", "#ffd23f", "#ff6f9a", "#9f7bff", "#ffffff"],
    dust: "#cbb8dc",
    text: "#ffffff"
  };

  const TRAIN_STYLES = [
    { body: "#dfe6f4", bodyDark: "#9aa6c2", side: "#c3cce0", roof: "#eef2fa", stripe: "#ff5a6e", glass: "#1b2a4a" },
    { body: "#2fc7a5", bodyDark: "#16806b", side: "#24a88b", roof: "#5fe0c2", stripe: "#ffd23f", glass: "#132238" }
  ];

  const ad = document.getElementById("ad");
  const canvas = document.getElementById("stage");
  const playButton = document.getElementById("playButton");
  const skipButton = document.getElementById("skipButton");
  const ctaButton = document.getElementById("ctaButton");
  const replayButton = document.getElementById("replayButton");
  const closeButton = document.getElementById("closeButton");
  const scoreValue = document.getElementById("scoreValue");
  const goalValue = document.getElementById("goalValue");
  const coinValue = document.getElementById("coinValue");
  const livesValue = document.getElementById("livesValue");
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

  // Popup and rail look down the track from behind the runner; the rail's
  // camera sits higher so the tall frame shows more track. The strip is too
  // flat for that, so it turns the same run into a side view with the three
  // lanes stacked as rows (SIDE).
  const VIEW = {
    popup: { horizon: 84, camH: 3.6, focal: 230, follow: 0.55, fx: 1 },
    rail: { horizon: 96, camH: 6.2, focal: 114, follow: 0.75, fx: 0.6 },
    strip: { horizon: 84, camH: 3.6, focal: 230, follow: 0, fx: 0.45 }
  }[FORMAT];
  const SIDE = FORMAT === "strip" ? {
    laneY: [21, 34, 47],           // feet line of the top, middle and bottom rows
    runnerX: SAFE.x + 30,
    ppm: 8,                        // horizontal px per metre
    ppmY: 7.5                      // vertical px per metre (jump height, coin height)
  } : null;

  const HORIZON = VIEW.horizon;
  const CAM_H = VIEW.camH;         // camera height above the rails (m)
  const FOCAL = VIEW.focal;
  const RUNNER_Z = 6;              // camera-to-runner depth (m)
  // The runner and floating text are drawn at popup size (38px per metre) and scaled.
  const RS = SIDE ? 0.22 : FOCAL / RUNNER_Z / 38.33;
  const NEAR_Z = 0.9;
  const FAR_Z = 74;
  const FOG_NEAR = 34;
  const FOG_FAR = 70;
  const SPAWN_AHEAD = 76;
  const LANE_W = 2;
  const LANE_EASE = 16;
  const CAM_FOLLOW = VIEW.follow;
  const SPEED_START = 13;          // m/s
  const SPEED_RAMP = 0.3;          // m/s gained per second of play
  const SPEED_MAX = 22;
  const DEMO_SPEED = 15;
  const HIT_SLOW = 0.5;
  const SLOW_RECOVER = 1.4;
  const JUMP_V = 7.4;              // ~1.2m apex, ~0.64s airtime
  const GRAVITY = 23;
  const FAST_FALL = 14;
  const JUMP_BUFFER = 0.14;
  const SLIDE_TIME = 0.75;
  const LOW_CLEAR = 0.55;          // feet above this clear a low barrier
  const HIT_HALF_W = 0.95;
  const TRAIN_LEN = 9;
  const START_LIVES = 2;
  const INVULN_TIME = 1.6;
  const STUMBLE_TIME = 0.6;
  const CRASH_TIME = 1;
  const FINISH_TIME = 1.1;
  const FIRST_ROW = 34;            // metres of clear track before the first row
  const ROW_TIME_START = 1.5;      // seconds between obstacle rows, easing down to ROW_TIME_END
  const ROW_TIME_END = 1.15;
  const SLEEPER_GAP = 1.3;
  const SLEEPER_FAR = 46;
  const GANTRY_GAP = 32;
  const POST_GAP = 5;
  const BUILD_X = 4.6;
  const SWIPE_MIN = FORMAT === "popup" ? 16 : 12;
  const MAX_STREAKS = 12;
  const HINT_TIME = 2.8;

  // Lanes left|centre|right (strip: top|middle|bottom). L low barrier (jump)
  // H high barrier (slide)  T parked car (switch)  . clear. Every row keeps a
  // lane open; spawnRow also keeps one lane open across consecutive rows. The
  // strip has no slide, so it never deals high barriers.
  const PATTERNS = SIDE ? [
    [".L.", "L..", "..L", "T..", "..T", ".T.", "...", "..."],
    ["LL.", ".LL", "L.L", "T.T", "TT.", ".TT", "T.L", "L.T", ".T.", "LT.", "..."],
    ["LLL", "TLT", "TT.", ".TT", "T.T", "LTL", "L.T", "TL."]
  ] : [
    [".L.", "L..", "..L", "T..", "..T", ".H.", "H..", "..H", "...", "..."],
    ["LL.", ".LL", "L.L", "T.T", "TT.", ".TT", "H.L", "L.H", "T.L", "L.T", "H.T", "T.H", ".H.", "..."],
    ["LLL", "HHH", "TLT", "THT", "LHL", "HLT", "TT.", ".TT", "T.T", "L.H"]
  ];

  const TAU = Math.PI * 2;
  // In the strip the rows run top to bottom, so up/down switch lanes and the
  // forward key (or space) jumps.
  const KEYMAP = SIDE ? {
    ArrowUp: "left", w: "left", W: "left",
    ArrowDown: "right", s: "right", S: "right",
    ArrowRight: "jump", d: "jump", D: "jump", " ": "jump", Spacebar: "jump"
  } : {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "jump", w: "jump", W: "jump", " ": "jump", Spacebar: "jump",
    ArrowDown: "slide", s: "slide", S: "slide"
  };

  const game = {
    dist: 0,
    speed: 0,
    slowT: SLOW_RECOVER,
    playT: 0,
    lane: 0,
    x: 0,
    y: 0,
    vy: 0,
    grounded: true,
    slideT: 0,
    queuedSlide: false,
    jumpBuffer: 0,
    run: 0,
    lean: 0,
    sx: 1,
    sy: 1,
    invuln: 0,
    stumble: 0,
    bumpCool: 0,
    crashT: -1,
    finishT: -1,
    flash: 0,
    confettiT: 0,
    lives: START_LIVES,
    coinCount: 0,
    camX: 0,
    rows: [],
    obstacles: [],
    coins: [],
    buildings: [],
    streaks: [],
    drawList: [],
    nextRowZ: FIRST_ROW,
    lastPattern: "...",
    nextBuild: [0, 0],
    finish: null,
    pilotCool: 0
  };

  const RUNNER = { kind: "runner", key: RUNNER_Z };
  const swipes = new Map();   // pointerId -> { x, y, fired }

  let viewX = 0;
  const px = (x, z) => WIDTH / 2 + ((x - viewX) * FOCAL) / z;
  const py = (y, z) => HORIZON + ((CAM_H - y) * FOCAL) / z;
  const fogAlpha = (z) => 1 - clamp((z - FOG_NEAR) / (FOG_FAR - FOG_NEAR), 0, 1);
  // Side view: lane position (-1..1, may be fractional mid-switch) to feet line, world z to screen x.
  const laneFeet = (lanePos) => {
    const t = clamp(lanePos + 1, 0, 2);
    const i = Math.min(1, Math.floor(t));
    return SIDE.laneY[i] + (SIDE.laneY[i + 1] - SIDE.laneY[i]) * (t - i);
  };
  const sideX = (wz) => SIDE.runnerX + (wz - game.dist) * SIDE.ppm;
  // Where a point at the runner's depth (lateral x, height y in metres) lands on screen.
  const screenAt = (x, y) => (SIDE ? { x: SIDE.runnerX, y: laneFeet(x / LANE_W) - y * SIDE.ppmY } : { x: px(x, RUNNER_Z), y: py(y, RUNNER_Z) });
  const spark = (x, y, color, count, speed) => burst(x, y, color, count, speed * VIEW.fx);
  const hash = (n) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  /* ---- art, painted once into offscreen canvases (40px per metre for sprites) */

  const makeLayer = (w, h, paint) => {
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(w * DPR);
    layer.height = Math.ceil(h * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    paint(g, w, h);
    return layer;
  };

  const rrect = (g, x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  const paintSun = (g, w, h) => {
    const sun = g.createLinearGradient(0, 4, 0, h - 4);
    sun.addColorStop(0, PALETTE.sunTop);
    sun.addColorStop(1, PALETTE.sunLow);
    g.fillStyle = sun;
    g.beginPath();
    g.arc(w / 2, h / 2, 32, 0, TAU);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    [[40, 2], [46, 2.4], [52, 2.8], [57, 3.2], [62, 3.6]].forEach(([y, band]) => g.fillRect(0, y, w, band));
    g.globalCompositeOperation = "source-over";
  };

  // Sky, sun and skyline down to `horizon`, ground below; `q` scales the sun
  // and skyline to the format (the strip's sky is a thin band above the rows).
  const BACK = { popup: { horizon: HORIZON, q: 1 }, rail: { horizon: HORIZON, q: 0.6 }, strip: { horizon: 15, q: 0.3 } }[FORMAT];

  const paintBackdrop = (g, w, h) => {
    const { horizon, q } = BACK;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.45, PALETTE.skyMid);
    sky.addColorStop(0.8, PALETTE.skyLow);
    sky.addColorStop(1, PALETTE.horizon);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, horizon);
    const sunX = SIDE ? SAFE.x + 20 + SAFE.w * 0.62 : w / 2;
    const glow = g.createRadialGradient(sunX, horizon - 10 * q, 6 * q, sunX, horizon - 10 * q, 130 * q);
    glow.addColorStop(0, "rgba(255, 214, 150, 0.55)");
    glow.addColorStop(1, "rgba(255, 214, 150, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, horizon);
    for (let index = 0; index < 28; index += 1) {
      g.fillStyle = `rgba(255, 255, 255, ${0.3 + hash(index + 80) * 0.6})`;
      g.fillRect(hash(index) * w, 3 + hash(index + 40) * (horizon * 0.4), 1, 1);
    }
    g.drawImage(makeLayer(72, 72, paintSun), sunX - 36 * q, horizon - 52 * q, 72 * q, 72 * q);
    let x = 0;
    for (let index = 0; x < w; index += 1) {
      const bw = (10 + hash(index) * 22) * q;
      const bh = (8 + hash(index + 9) * 34) * q;
      g.fillStyle = PALETTE.skyline;
      g.fillRect(x, horizon - bh, bw + 0.5, bh);
      g.fillStyle = PALETTE.skylineLit;
      for (let wy = horizon - bh + 3 * q; wy < horizon - 4 * q; wy += 4 * q) {
        for (let wx = x + 2 * q; wx < x + bw - 2 * q; wx += 4 * q) {
          if (hash(wx * 3.1 + wy * 7.7) > 0.74) {
            g.fillRect(wx, wy, 1.4 * q, 1.6 * q);
          }
        }
      }
      x += bw;
    }
    const haze = g.createLinearGradient(0, horizon - 28 * q, 0, horizon);
    haze.addColorStop(0, `rgba(${PALETTE.fog}, 0)`);
    haze.addColorStop(1, `rgba(${PALETTE.fog}, 0.85)`);
    g.fillStyle = haze;
    g.fillRect(0, horizon - 28 * q, w, 28 * q);
    const ground = g.createLinearGradient(0, horizon, 0, h);
    ground.addColorStop(0, PALETTE.groundTop);
    ground.addColorStop(1, PALETTE.groundLow);
    g.fillStyle = ground;
    g.fillRect(0, horizon, w, h - horizon);
  };

  const paintFacade = (g, w, h, variant) => {
    g.fillStyle = PALETTE.facade[variant];
    g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0, 0, 0, 0.3)";
    g.fillRect(0, 0, w, 4);
    g.fillStyle = "rgba(255, 255, 255, 0.07)";
    g.fillRect(0, 4, 3, h - 4);
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        g.fillStyle = hash(variant * 100 + row * 7 + col) > 0.42 ? PALETTE.window : PALETTE.windowDim;
        g.fillRect(5 + col * 11, 9 + row * 10, 7, 6);
      }
    }
  };

  const paintLow = (g) => {
    g.fillStyle = PALETTE.post;
    g.fillRect(7, 2, 5, 36);
    g.fillRect(56, 2, 5, 36);
    g.fillRect(3, 35, 13, 3);
    g.fillRect(52, 35, 13, 3);
    g.save();
    g.beginPath();
    g.rect(2, 5, 64, 15);
    g.clip();
    g.fillStyle = PALETTE.barrierLight;
    g.fillRect(2, 5, 64, 15);
    g.fillStyle = PALETTE.barrier;
    for (let x = -14; x < 70; x += 12) {
      g.beginPath();
      g.moveTo(x, 20);
      g.lineTo(x + 6, 20);
      g.lineTo(x + 21, 5);
      g.lineTo(x + 15, 5);
      g.closePath();
      g.fill();
    }
    g.restore();
    g.strokeStyle = "rgba(40, 10, 20, 0.6)";
    g.lineWidth = 1;
    g.strokeRect(2.5, 5.5, 63, 14);
    g.fillStyle = PALETTE.lamp;
    g.beginPath();
    g.arc(9.5, 3, 2.6, 0, TAU);
    g.moveTo(61.1, 3);
    g.arc(58.5, 3, 2.6, 0, TAU);
    g.fill();
  };

  const paintHigh = (g) => {
    g.fillStyle = PALETTE.post;
    g.fillRect(4, 0, 5, 92);
    g.fillRect(67, 0, 5, 92);
    g.fillRect(1, 89, 11, 3);
    g.fillRect(64, 89, 11, 3);
    g.fillStyle = PALETTE.high;
    g.fillRect(1, 6, 74, 38);
    g.fillStyle = PALETTE.highInk;
    for (let index = 0; index < 4; index += 1) {
      const cx = 13.5 + index * 16.5;
      g.beginPath();
      g.moveTo(cx - 7, 15);
      g.lineTo(cx, 23);
      g.lineTo(cx + 7, 15);
      g.lineTo(cx + 7, 22);
      g.lineTo(cx, 30);
      g.lineTo(cx - 7, 22);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = PALETTE.highInk;
    g.lineWidth = 2;
    g.strokeRect(2, 7, 72, 36);
    g.fillStyle = PALETTE.hit;
    g.beginPath();
    g.arc(38, 3, 2.5, 0, TAU);
    g.fill();
  };

  const paintTrain = (g, w, h, style) => {
    const body = g.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, style.body);
    body.addColorStop(1, style.bodyDark);
    g.fillStyle = body;
    rrect(g, 2, 4, 72, 116, 9);
    g.fill();
    g.fillStyle = style.glass;
    rrect(g, 9, 16, 58, 34, 6);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.18)";
    g.beginPath();
    g.moveTo(14, 48);
    g.lineTo(30, 18);
    g.lineTo(40, 18);
    g.lineTo(24, 48);
    g.closePath();
    g.fill();
    g.fillStyle = style.stripe;
    g.fillRect(2, 60, 72, 7);
    g.fillStyle = "rgba(255, 244, 200, 0.35)";
    g.beginPath();
    g.arc(17, 82, 8, 0, TAU);
    g.moveTo(67, 82);
    g.arc(59, 82, 8, 0, TAU);
    g.fill();
    g.fillStyle = "#fff6d2";
    g.beginPath();
    g.arc(17, 82, 4.6, 0, TAU);
    g.moveTo(63.6, 82);
    g.arc(59, 82, 4.6, 0, TAU);
    g.fill();
    g.fillStyle = "#1c1830";
    g.fillRect(29, 76, 18, 11);
    g.fillStyle = PALETTE.accent;
    g.fillRect(32, 79, 12, 2);
    g.fillRect(32, 83, 8, 1.5);
    g.fillStyle = "#3a3550";
    g.fillRect(5, 100, 66, 8);
    g.fillStyle = "#141020";
    g.fillRect(3, 108, 70, 16);
  };

  const paintFinish = (g, w, h) => {
    g.fillStyle = "#16112a";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    for (let col = 0; col < w / 6; col += 1) {
      for (let row = 0; row < 2; row += 1) {
        if ((col + row) % 2 === 0) {
          g.fillRect(col * 6, row * 6, 6, 6);
          g.fillRect(col * 6, h - 12 + row * 6, 6, 6);
        }
      }
    }
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = PALETTE.accent;
    g.font = "italic 900 18px Arial, Helvetica, sans-serif";
    g.fillText("FINISH", w / 2, h / 2 + 1);
    g.fillStyle = "#ffffff";
    g.font = "900 8px Arial, Helvetica, sans-serif";
    g.fillText("VEXA DASH 5", 46, h / 2 + 1);
    g.fillText("VEXA DASH 5", w - 46, h / 2 + 1);
  };

  const ART = {
    backdrop: makeLayer(WIDTH + 40, HEIGHT, paintBackdrop),
    facades: [0, 1, 2].map((variant) => makeLayer(40, 100, (g, w, h) => paintFacade(g, w, h, variant))),
    low: makeLayer(68, 38, paintLow),
    high: makeLayer(76, 92, paintHigh),
    trains: TRAIN_STYLES.map((style) => makeLayer(76, 124, (g, w, h) => paintTrain(g, w, h, style))),
    finish: makeLayer(272, 44, paintFinish)
  };

  const FOG = { top: HORIZON - 40 * BACK.q, h: 70 * BACK.q };
  const FOG_BAND = ctx.createLinearGradient(0, FOG.top, 0, FOG.top + FOG.h);
  FOG_BAND.addColorStop(0, `rgba(${PALETTE.fog}, 0)`);
  FOG_BAND.addColorStop(0.57, `rgba(${PALETTE.fog}, 0.8)`);
  FOG_BAND.addColorStop(1, `rgba(${PALETTE.fog}, 0)`);

  const VIGNETTE = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, Math.min(WIDTH, HEIGHT) * 0.24, WIDTH / 2, HEIGHT / 2, Math.hypot(WIDTH, HEIGHT) * 0.51);
  VIGNETTE.addColorStop(0, "rgba(255, 60, 80, 0)");
  VIGNETTE.addColorStop(1, "rgba(255, 60, 80, 0.8)");

  /* ---- state */

  const showLives = () => {
    if (livesValue) {
      livesValue.dataset.lives = String(Math.max(0, game.lives));
    }
  };

  const showCoins = () => {
    if (coinValue) {
      coinValue.textContent = String(game.coinCount);
    }
  };

  const releaseInput = () => {
    swipes.clear();
  };

  const resetGame = () => {
    Object.assign(game, {
      dist: 0,
      speed: 0,
      slowT: SLOW_RECOVER,
      playT: 0,
      lane: 0,
      x: 0,
      y: 0,
      vy: 0,
      grounded: true,
      slideT: 0,
      queuedSlide: false,
      jumpBuffer: 0,
      run: 0,
      lean: 0,
      sx: 1,
      sy: 1,
      invuln: 0,
      stumble: 0,
      bumpCool: 0,
      crashT: -1,
      finishT: -1,
      flash: 0,
      confettiT: 0,
      lives: START_LIVES,
      coinCount: 0,
      camX: 0,
      nextRowZ: FIRST_ROW,
      lastPattern: "...",
      nextBuild: [-12, -7],
      finish: null,
      pilotCool: 0
    });
    game.rows.length = 0;
    game.obstacles.length = 0;
    game.coins.length = 0;
    game.buildings.length = 0;
    game.streaks.length = 0;
    showLives();
    showCoins();
    releaseInput();
  };

  /* ---- spawning */

  const sharesOpenLane = (a, b) => [0, 1, 2].some((index) => a[index] !== "T" && b[index] !== "T");

  const trainAt = (lane, z0, z1) => game.obstacles.some((o) => o.kind === "train" && o.lane === lane && o.wz < z1 && o.wz + o.len > z0);

  const pickPattern = (demo) => {
    const progress = game.dist / CONFIG.goal;
    let tier = 1;
    if (!demo) {
      tier = progress < 0.22 ? 0 : progress < 0.55 ? (Math.random() < 0.25 ? 0 : 1) : (Math.random() < 0.5 ? 1 : 2);
    }
    const list = PATTERNS[tier];
    for (let tries = 0; tries < 12; tries += 1) {
      const pattern = list[Math.floor(Math.random() * list.length)];
      if (sharesOpenLane(game.lastPattern, pattern)) {
        return pattern;
      }
    }
    return "...";
  };

  const spawnCoins = (row) => {
    if (Math.random() > 0.75) {
      return;
    }
    const open = [-1, 0, 1].filter((lane) => row.lanes[lane + 1] === ".");
    const usable = open.length ? open : [-1, 0, 1].filter((lane) => row.lanes[lane + 1] !== "T");
    const lane = usable[Math.floor(Math.random() * usable.length)];
    const kind = row.lanes[lane + 1];
    row.coinLane = lane;
    const offsets = kind === "L" ? [-4, -2, 0, 2, 4] : kind === "H" ? [-3, -1.5, 0, 1.5, 3] : [-6, -3, 0, 3, 6];
    offsets.forEach((offset, index) => {
      const y = kind === "L" ? 0.5 + 1.15 * (1 - (offset / 5) * (offset / 5)) : kind === "H" ? 0.4 : 0.5;
      game.coins.push({ kind: "coin", key: 0, x: lane * LANE_W, y, wz: row.wz + offset, taken: false, phase: index * 0.6 });
    });
  };

  const spawnRow = (wz, demo) => {
    const pattern = pickPattern(demo);
    game.lastPattern = pattern;
    const row = { wz, lanes: pattern, coinLane: null };
    for (let lane = -1; lane <= 1; lane += 1) {
      const cell = pattern[lane + 1];
      if (cell === "L" || cell === "H") {
        game.obstacles.push({ kind: cell === "L" ? "low" : "high", key: 0, lane, wz, len: 0.3, done: false, hit: false });
      } else if (cell === "T") {
        game.obstacles.push({ kind: "train", key: 0, lane, wz, len: TRAIN_LEN, done: false, hit: false, style: Math.random() < 0.5 ? 0 : 1 });
      }
    }
    spawnCoins(row);
    game.rows.push(row);
  };

  const spawnAhead = (demo) => {
    const horizon = game.dist + SPAWN_AHEAD;
    while (game.nextRowZ < horizon) {
      if (!demo && game.nextRowZ > CONFIG.goal - 22) {
        game.finish = { kind: "finish", key: 0, wz: CONFIG.goal };
        game.nextRowZ = Infinity;
        break;
      }
      spawnRow(game.nextRowZ, demo);
      const rowTime = ROW_TIME_START + (ROW_TIME_END - ROW_TIME_START) * clamp(game.dist / CONFIG.goal, 0, 1);
      game.nextRowZ += clamp(Math.max(game.speed, SPEED_START) * rowTime, 15, 28);
    }
    [-1, 1].forEach((side, index) => {
      while (game.nextBuild[index] < horizon + 10) {
        const len = rand(7, 15);
        game.buildings.push({ side, wz: game.nextBuild[index], len, h: rand(5.5, 13), depth: rand(5, 9), variant: Math.floor(rand(0, 3)) });
        game.nextBuild[index] += len + rand(1.5, 5);
      }
    });
  };

  const cull = () => {
    const behind = game.dist - RUNNER_Z + NEAR_Z - 1;
    const keep = (item) => item.wz + (item.len || 0) > behind;
    game.rows = game.rows.filter((row) => row.wz > behind);
    game.obstacles = game.obstacles.filter(keep);
    game.coins = game.coins.filter((coin) => !coin.taken && keep(coin));
    game.buildings = game.buildings.filter(keep);
  };

  /* ---- runner actions */

  const runnerScreen = () => screenAt(game.x, game.y);

  // Floating text above the runner, kept inside the play area.
  const callout = (rise, text, color) => {
    const spot = runnerScreen();
    floatText(spot.x, Math.max(spot.y - rise * RS, SAFE.y + 6), text, color);
  };

  const stretch = (sx, sy) => {
    const k = reduceMotion ? 0.4 : 1;
    game.sx = 1 + (sx - 1) * k;
    game.sy = 1 + (sy - 1) * k;
  };

  const canAct = () => game.crashT < 0 && game.finishT < 0;

  const moveLane = (dir) => {
    if (!canAct()) {
      return;
    }
    const next = clamp(game.lane + dir, -1, 1);
    if (next === game.lane) {
      game.lean = dir * 0.25;
      return;
    }
    game.lane = next;
    const spot = screenAt(game.x, 0);
    spark(spot.x, spot.y, PALETTE.dust, 4, 40);
  };

  const jump = () => {
    if (!canAct()) {
      return;
    }
    if (!game.grounded) {
      game.jumpBuffer = JUMP_BUFFER;
      return;
    }
    game.slideT = 0;
    game.queuedSlide = false;
    game.vy = JUMP_V;
    game.grounded = false;
    stretch(0.84, 1.18);
    const spot = runnerScreen();
    spark(spot.x, spot.y, PALETTE.dust, 6, 50);
  };

  const slide = () => {
    if (!canAct()) {
      return;
    }
    if (!game.grounded) {
      game.vy = Math.min(game.vy, -FAST_FALL);
      game.queuedSlide = true;
      return;
    }
    game.slideT = SLIDE_TIME;
    stretch(1.15, 0.85);
  };

  const ejectFromTrain = () => {
    const options = [game.lane - 1, game.lane + 1]
      .filter((lane) => lane >= -1 && lane <= 1 && !trainAt(lane, game.dist - 1, game.dist + 2))
      .sort((a, b) => Math.abs(a * LANE_W - game.x) - Math.abs(b * LANE_W - game.x));
    if (options.length) {
      game.lane = options[0];
    }
  };

  const collide = (o, live) => {
    const spot = runnerScreen();
    if (o.kind === "train") {
      ejectFromTrain();
      // Clipping a car's flank while switching lanes only stumbles; running into its nose costs a life.
      if (o.wz < game.dist - 0.6) {
        if (game.bumpCool <= 0) {
          game.bumpCool = 0.3;
          game.stumble = STUMBLE_TIME * 0.6;
          game.slowT = Math.min(game.slowT, SLOW_RECOVER * 0.5);
          spark(spot.x, spot.y - 30 * RS, PALETTE.dust, 8, 70);
        }
        return;
      }
    }
    o.hit = true;
    o.done = true;
    if (game.invuln > 0 || !live) {
      return;
    }
    game.lives -= 1;
    showLives();
    game.invuln = INVULN_TIME;
    game.stumble = STUMBLE_TIME;
    game.slowT = 0;
    game.flash = 0.35;
    game.slideT = 0;
    shake();
    spark(spot.x, spot.y - 30 * RS, PALETTE.hit, 14, 110);
    callout(72, game.lives > 0 ? "OUCH!" : "WIPEOUT!", PALETTE.hit);
    if (game.lives <= 0) {
      game.crashT = 0;
      game.invuln = 0;
    }
  };

  const checkHits = (live) => {
    if (!canAct()) {
      return;
    }
    for (let index = 0; index < game.obstacles.length; index += 1) {
      const o = game.obstacles[index];
      if (o.done) {
        continue;
      }
      const inLane = Math.abs(game.x - o.lane * LANE_W) < HIT_HALF_W;
      if (o.kind === "train") {
        if (o.wz + o.len < game.dist - 0.4) {
          o.done = true;
        } else if (inLane && o.wz < game.dist + 0.4) {
          collide(o, live);
        }
        continue;
      }
      if (o.wz > game.dist) {
        continue;
      }
      o.done = true;
      if (!inLane) {
        continue;
      }
      const clear = o.kind === "low" ? game.y > LOW_CLEAR : game.slideT > 0;
      if (!clear) {
        collide(o, live);
      } else if (live) {
        callout(74, "NICE!", PALETTE.accent);
      }
    }
  };

  const collectCoins = (prevDist, live) => {
    const top = game.slideT > 0 ? 0.9 : 1.75;
    game.coins.forEach((coin) => {
      if (coin.taken || coin.wz < prevDist - 0.7 || coin.wz > game.dist + 0.7) {
        return;
      }
      if (Math.abs(coin.x - game.x) > 0.85 || coin.y < game.y - 0.25 || coin.y > game.y + top) {
        return;
      }
      coin.taken = true;
      const spot = screenAt(coin.x, coin.y + 0.3);
      spark(spot.x, spot.y, PALETTE.coinLight, 5, 60);
      if (live) {
        game.coinCount += 1;
        showCoins();
        floatText(spot.x, Math.max(spot.y - 12 * RS, SAFE.y + 6), "+1", PALETTE.coin);
      }
    });
  };

  // Attract-mode pilot: picks an open lane for the next row, then jumps or slides on cue.
  const pilot = (dt) => {
    game.pilotCool -= dt;
    let row = null;
    for (let index = 0; index < game.rows.length; index += 1) {
      if (game.rows[index].wz > game.dist - 0.2) {
        row = game.rows[index];
        break;
      }
    }
    if (!row) {
      return;
    }
    const ahead = row.wz - game.dist;
    let best = game.lane;
    let bestScore = -Infinity;
    for (let lane = -1; lane <= 1; lane += 1) {
      const cell = row.lanes[lane + 1];
      if (cell !== "T") {
        const score = (cell === "." ? 2 : 1) - Math.abs(lane - game.lane) * 0.6 + (row.coinLane === lane ? 0.5 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = lane;
        }
      }
    }
    if (best !== game.lane && game.pilotCool <= 0 && ahead < 40) {
      const step = Math.sign(best - game.lane);
      if (!trainAt(game.lane + step, game.dist - 1, game.dist + 1.5)) {
        moveLane(step);
        game.pilotCool = 0.18;
      }
    }
    const cell = row.lanes[game.lane + 1];
    const lead = ahead / Math.max(1, game.speed);
    if (cell === "L" && lead < 0.3 && game.grounded) {
      jump();
    } else if (cell === "H" && lead < 0.35 && game.slideT <= 0) {
      slide();
    }
  };

  /* ---- simulation */

  const stepSpeed = (dt, mode) => {
    if (mode === "end" || game.crashT >= 0) {
      game.speed = Math.max(0, game.speed - (game.speed * 3 + 2) * dt);
      return;
    }
    if (game.finishT >= 0) {
      game.speed += (7 - game.speed) * Math.min(1, dt * 2);
      return;
    }
    const base = mode === "demo" ? DEMO_SPEED : Math.min(SPEED_MAX, SPEED_START + SPEED_RAMP * game.playT);
    game.slowT += dt;
    const k = clamp(game.slowT / SLOW_RECOVER, 0, 1);
    game.speed = base * (HIT_SLOW + (1 - HIT_SLOW) * (1 - (1 - k) * (1 - k)));
  };

  const stepRunner = (dt) => {
    const prevX = game.x;
    const targetX = game.lane * LANE_W;
    game.x += (targetX - game.x) * (1 - Math.exp(-dt * LANE_EASE));
    if (Math.abs(targetX - game.x) < 0.005) {
      game.x = targetX;
    }
    const vx = dt > 0 ? (game.x - prevX) / dt : 0;
    game.lean += (clamp(vx * 0.035, -0.35, 0.35) - game.lean) * Math.min(1, dt * 12);

    if (!game.grounded) {
      game.vy -= GRAVITY * dt;
      game.y += game.vy * dt;
      if (game.y <= 0) {
        const impact = Math.min(1, -game.vy / 12);
        game.y = 0;
        game.vy = 0;
        game.grounded = true;
        stretch(1 + impact * 0.22, 1 - impact * 0.2);
        const spot = runnerScreen();
        spark(spot.x, spot.y, PALETTE.dust, 5, 45);
        if (game.queuedSlide) {
          game.queuedSlide = false;
          slide();
        } else if (game.jumpBuffer > 0) {
          jump();
        }
      }
    }
    game.jumpBuffer = Math.max(0, game.jumpBuffer - dt);
    if (game.slideT > 0) {
      game.slideT = Math.max(0, game.slideT - dt);
      if (!reduceMotion && Math.random() < 0.5) {
        const spot = runnerScreen();
        spark(spot.x + rand(-10, 10) * RS, spot.y - 2 * RS, PALETTE.dust, 1, 50);
      }
    }
    if (game.speed > 0.5) {
      game.run += dt * (6 + game.speed * 0.42);
    }
    const ease = Math.min(1, dt * 12);
    game.sx += (1 - game.sx) * ease;
    game.sy += (1 - game.sy) * ease;
  };

  // Direction a speed streak travels: away from the vanishing point, or leftward in the side view.
  const streakDir = (streak) => {
    if (SIDE) {
      return { x: -1, y: 0 };
    }
    const dx = streak.x - WIDTH / 2;
    const dy = streak.y - HORIZON;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };

  const stepStreaks = (dt) => {
    if (!reduceMotion && game.speed > 15 && game.streaks.length < MAX_STREAKS && Math.random() < (game.speed - 14) * dt * 2.2) {
      const side = Math.random() < 0.5 ? -1 : 1;
      game.streaks.push(SIDE
        ? { x: rand(SAFE.x + 120, WIDTH), y: rand(6, HEIGHT - 4), age: 0, life: rand(0.2, 0.35) }
        : { x: WIDTH / 2 + side * rand(0.23, 0.5) * WIDTH, y: rand(HORIZON + 14 * VIEW.fx, HEIGHT), age: 0, life: rand(0.2, 0.35) });
    }
    const pace = game.speed * (SIDE ? SIDE.ppm * 1.6 : 18 * VIEW.fx);
    for (let index = game.streaks.length - 1; index >= 0; index -= 1) {
      const streak = game.streaks[index];
      const dir = streakDir(streak);
      streak.age += dt;
      streak.x += dir.x * pace * dt;
      streak.y += dir.y * pace * dt;
      if (streak.age >= streak.life) {
        game.streaks.splice(index, 1);
      }
    }
  };

  const stepWorld = (dt, mode) => {
    const live = mode === "play";
    const demo = mode === "demo";
    stepSpeed(dt, mode);
    const prevDist = game.dist;
    game.dist += game.speed * dt;
    if (demo) {
      pilot(dt);
    }
    stepRunner(dt);
    if (mode !== "end") {
      checkHits(live);
      collectCoins(prevDist, live);
      spawnAhead(demo);
    }
    cull();

    if (live && canAct() && game.dist >= CONFIG.goal) {
      game.finishT = 0;
      game.invuln = 0;
      const spot = runnerScreen();
      spark(spot.x, spot.y - 40 * RS, PALETTE.accent, 24, 130);
      callout(80, "FINISH!", PALETTE.accent);
    }
    game.invuln = Math.max(0, game.invuln - dt);
    game.stumble = Math.max(0, game.stumble - dt);
    game.bumpCool = Math.max(0, game.bumpCool - dt);
    game.flash = Math.max(0, game.flash - dt);
    if (game.crashT >= 0) {
      game.crashT += dt;
    }
    if (game.finishT >= 0) {
      game.finishT += dt;
      game.confettiT -= dt;
      if (game.confettiT <= 0) {
        game.confettiT = 0.16;
        const x = rand(SAFE.x + SAFE.w * 0.1, SAFE.x + SAFE.w * 0.9);
        const y = rand(SAFE.y + SAFE.h * 0.08, SAFE.y + SAFE.h * 0.4);
        spark(x, y, PALETTE.confetti[Math.floor(Math.random() * PALETTE.confetti.length)], 12, 100);
      }
    }
    game.camX += (game.x * CAM_FOLLOW - game.camX) * (1 - Math.exp(-dt * 8));
    stepStreaks(dt);
  };

  // Runs only in the play phase.
  const update = (dt) => {
    game.playT += dt;
    stepWorld(dt, "play");
    const metres = Math.min(CONFIG.goal, Math.floor(game.dist));
    if (metres !== Shell.score) {
      setScore(metres);
    }
    if (game.crashT >= CRASH_TIME) {
      endGame(false);
    } else if (game.finishT >= FINISH_TIME) {
      endGame(true);
    }
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    stepWorld(dt, Shell.phase === "intro" ? "demo" : "end");
  };

  /* ---- drawing */

  // Quad helpers add to the current path when `batch` is set, so many strips share one fill.
  const quad = (x1, y1, x2, y2, x3, y3, x4, y4, batch) => {
    if (!batch) {
      ctx.beginPath();
    }
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    if (!batch) {
      ctx.fill();
    }
  };

  // A strip on a vertical plane x = const, between heights y0..y1 and depths z0..z1.
  const wallQuad = (x, y0, y1, z0, z1, batch) => {
    quad(px(x, z0), py(y0, z0), px(x, z0), py(y1, z0), px(x, z1), py(y1, z1), px(x, z1), py(y0, z1), batch);
  };

  // A strip on a horizontal plane y = const, between x0..x1 and depths z0..z1.
  const floorQuad = (y, x0, x1, z0, z1, batch) => {
    quad(px(x0, z0), py(y, z0), px(x1, z0), py(y, z0), px(x1, z1), py(y, z1), px(x0, z1), py(y, z1), batch);
  };

  const drawBuildings = (base) => {
    for (let index = game.buildings.length - 1; index >= 0; index -= 1) {
      const b = game.buildings[index];
      const z0 = b.wz - base;
      const z1 = z0 + b.len;
      if (z1 < NEAR_Z || z0 > FAR_Z) {
        continue;
      }
      const zn = Math.max(z0, NEAR_Z);
      const inner = b.side * BUILD_X;
      const outer = b.side * (BUILD_X + b.depth);
      ctx.globalAlpha = fogAlpha(zn);
      ctx.fillStyle = PALETTE.facadeSide[b.variant];
      wallQuad(inner, 0, b.h, zn, z1);
      ctx.fillStyle = "rgba(255, 207, 135, 0.2)";
      ctx.beginPath();
      for (let floor = 1.3; floor + 1 < b.h - 0.6; floor += 2.6) {
        wallQuad(inner, floor, floor + 0.9, zn, z1, true);
      }
      ctx.fill();
      // The rail's higher camera looks down onto the shorter roofs.
      if (b.h < CAM_H) {
        ctx.fillStyle = PALETTE.facade[b.variant];
        floorQuad(b.h, Math.min(inner, outer), Math.max(inner, outer), zn, z1);
      }
      if (z0 >= NEAR_Z) {
        const left = px(Math.min(inner, outer), z0);
        const right = px(Math.max(inner, outer), z0);
        ctx.drawImage(ART.facades[b.variant], left, py(b.h, z0), right - left, (b.h * FOCAL) / z0);
      }
    }
    ctx.globalAlpha = 1;
  };

  const drawTrack = (base) => {
    const zn = 3.6;
    ctx.fillStyle = PALETTE.ballast;
    floorQuad(0, -3.2, 3.2, zn, FAR_Z);

    ctx.fillStyle = PALETTE.wall;
    wallQuad(-3.3, 0, 1.05, zn, FAR_Z);
    wallQuad(3.3, 0, 1.05, zn, FAR_Z);
    ctx.fillStyle = PALETTE.wallTop;
    floorQuad(1.05, -3.65, -3.3, zn, FAR_Z);
    floorQuad(1.05, 3.3, 3.65, zn, FAR_Z);
    ctx.strokeStyle = PALETTE.wallSeam;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = Math.ceil((base + zn) / POST_GAP); k * POST_GAP - base < 44; k += 1) {
      const z = k * POST_GAP - base;
      [-3.3, 3.3].forEach((x) => {
        ctx.moveTo(px(x, z), py(0, z));
        ctx.lineTo(px(x, z), py(1.05, z));
      });
    }
    ctx.stroke();

    ctx.fillStyle = PALETTE.sleeper;
    ctx.beginPath();
    for (let k = Math.ceil((base + zn) / SLEEPER_GAP); k * SLEEPER_GAP - base < SLEEPER_FAR; k += 1) {
      const z = k * SLEEPER_GAP - base;
      const top = py(0, z + 0.32);
      const bottom = py(0, z);
      for (let lane = -1; lane <= 1; lane += 1) {
        const left = px(lane * LANE_W - 0.95, z);
        ctx.rect(left, top, px(lane * LANE_W + 0.95, z) - left, bottom - top);
      }
    }
    ctx.fill();

    ctx.fillStyle = PALETTE.rail;
    ctx.beginPath();
    for (let lane = -1; lane <= 1; lane += 1) {
      [-0.55, 0.55].forEach((offset) => {
        const x = lane * LANE_W + offset;
        quad(px(x - 0.06, zn), py(0.12, zn), px(x + 0.06, zn), py(0.12, zn), px(x + 0.06, FAR_Z), py(0.12, FAR_Z), px(x - 0.06, FAR_Z), py(0.12, FAR_Z), true);
      });
    }
    ctx.fill();
    ctx.strokeStyle = PALETTE.railShine;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let lane = -1; lane <= 1; lane += 1) {
      [-0.55, 0.55].forEach((offset) => {
        const x = lane * LANE_W + offset;
        ctx.moveTo(px(x, zn), py(0.14, zn));
        ctx.lineTo(px(x, FAR_Z), py(0.14, FAR_Z));
      });
    }
    ctx.stroke();
  };

  const drawGantries = (base) => {
    ctx.fillStyle = PALETTE.gantry;
    for (let k = Math.floor((base + FAR_Z) / GANTRY_GAP); k * GANTRY_GAP - base > 2; k -= 1) {
      const z = k * GANTRY_GAP - base;
      const s = FOCAL / z;
      ctx.globalAlpha = fogAlpha(z);
      ctx.fillRect(px(-3.64, z), py(6.2, z), 0.28 * s, 6.2 * s);
      ctx.fillRect(px(3.36, z), py(6.2, z), 0.28 * s, 6.2 * s);
      ctx.fillRect(px(-3.64, z), py(6.2, z), 7.28 * s, 0.42 * s);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(30, 16, 46, 0.7)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let lane = -1; lane <= 1; lane += 1) {
      ctx.moveTo(px(lane * LANE_W, 3.6), py(5.6, 3.6));
      ctx.lineTo(px(lane * LANE_W, FAR_Z), py(5.6, FAR_Z));
    }
    ctx.stroke();
  };

  // Shadows lie on the ground, which nothing farther away can overlap, so they all go down first in one fill.
  const drawShadows = (list) => {
    ctx.fillStyle = "rgba(10, 4, 20, 0.34)";
    ctx.beginPath();
    list.forEach((item) => {
      if (item.kind === "coin") {
        const z = item.key;
        const r = (0.25 * FOCAL) / z;
        const x = px(item.x, z);
        const y = py(0, z);
        ctx.moveTo(x + r, y);
        ctx.ellipse(x, y, r, r * 0.25, 0, 0, TAU);
      } else if (item.kind === "train") {
        const z0 = item.wz - (game.dist - RUNNER_Z);
        floorQuad(0.01, item.lane * LANE_W - 1.1, item.lane * LANE_W + 1.1, Math.max(z0, NEAR_Z), z0 + item.len, true);
      } else if (item.kind === "low" || item.kind === "high") {
        const half = item.kind === "low" ? 0.9 : 1;
        floorQuad(0.01, item.lane * LANE_W - half, item.lane * LANE_W + half, item.key, item.key + 0.35, true);
      }
    });
    ctx.fill();
  };

  const drawBarrier = (o, z) => {
    const x = o.lane * LANE_W;
    const s = FOCAL / z;
    const sprite = o.kind === "low" ? ART.low : ART.high;
    const w = o.kind === "low" ? 1.7 : 1.9;
    const h = o.kind === "low" ? 0.95 : 2.3;
    ctx.globalAlpha = fogAlpha(z);
    if (o.hit) {
      // Knocked flat: squash the sprite down onto the sleepers.
      ctx.drawImage(sprite, px(x - w / 2, z), py(h * 0.3, z), w * s, h * 0.3 * s);
    } else {
      ctx.drawImage(sprite, px(x - w / 2, z), py(h, z), w * s, h * s);
    }
    ctx.globalAlpha = 1;
  };

  const drawTrain = (o, z0raw) => {
    const style = TRAIN_STYLES[o.style];
    const z0 = Math.max(z0raw, NEAR_Z);
    const z1 = z0raw + o.len;
    const x = o.lane * LANE_W;
    const hw = 0.95;
    const H = 3.1;
    ctx.globalAlpha = fogAlpha(z0);
    const sideX = x < viewX - 0.05 ? x + hw : x > viewX + 0.05 ? x - hw : null;
    if (sideX !== null) {
      ctx.fillStyle = style.side;
      wallQuad(sideX, 0.35, H - 0.15, z0, z1);
      ctx.fillStyle = "#141020";
      wallQuad(sideX, 0, 0.45, z0, z1);
      ctx.fillStyle = style.glass;
      wallQuad(sideX, 1.75, 2.5, z0, z1);
      ctx.fillStyle = style.stripe;
      wallQuad(sideX, 1.15, 1.35, z0, z1);
      ctx.strokeStyle = style.side;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 1.5; k < o.len; k += 1.5) {
        const z = z0raw + k;
        if (z > z0) {
          ctx.moveTo(px(sideX, z), py(1.75, z));
          ctx.lineTo(px(sideX, z), py(2.5, z));
        }
      }
      ctx.stroke();
    }
    ctx.fillStyle = style.roof;
    floorQuad(H, x - hw + 0.1, x + hw - 0.1, z0, z1);
    if (z0raw >= NEAR_Z) {
      const s = FOCAL / z0raw;
      ctx.drawImage(ART.trains[o.style], px(x - hw, z0raw), py(H, z0raw), 2 * hw * s, H * s);
    }
    ctx.globalAlpha = 1;
  };

  const drawCoin = (coin, z, time) => {
    const s = FOCAL / z;
    const x = px(coin.x, z);
    const y = py(coin.y + 0.3, z);
    const r = 0.28 * s;
    const spin = Math.abs(Math.cos(time * 5 + coin.phase));
    ctx.globalAlpha = fogAlpha(z);
    ctx.fillStyle = PALETTE.coinDark;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.6, r * spin), r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.coin;
    ctx.beginPath();
    ctx.ellipse(x - spin * r * 0.08, y, Math.max(0.4, r * spin * 0.74), r * 0.78, 0, 0, TAU);
    ctx.fill();
    if (spin > 0.4 && r > 2) {
      ctx.fillStyle = PALETTE.coinLight;
      ctx.fillRect(x - r * spin * 0.42, y - r * 0.5, Math.max(0.6, r * spin * 0.22), r * 0.8);
    }
    ctx.globalAlpha = 1;
  };

  const drawFinish = (z) => {
    const s = FOCAL / z;
    ctx.globalAlpha = fogAlpha(z);
    ctx.fillStyle = PALETTE.gantry;
    ctx.fillRect(px(-3.62, z), py(4.7, z), 0.26 * s, 4.7 * s);
    ctx.fillRect(px(3.36, z), py(4.7, z), 0.26 * s, 4.7 * s);
    ctx.drawImage(ART.finish, px(-3.4, z), py(4.6, z), 6.8 * s, 1.1 * s);
    ctx.globalAlpha = 1;
  };

  const drawLegBack = (hipX, hipY, lift) => {
    const footY = -2 - lift * 13;
    ctx.strokeStyle = PALETTE.pants;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(hipX * 1.2, (hipY + footY) / 2 + lift * 2);
    ctx.lineTo(hipX, footY - 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.shoe;
    ctx.beginPath();
    ctx.ellipse(hipX, footY, 4.4, 3 + lift * 1.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.sole;
    if (lift > 0.15) {
      ctx.beginPath();
      ctx.ellipse(hipX, footY + 0.8, 3.6, 1.2 + lift * 1.8, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillRect(hipX - 4.2, footY + 1.4, 8.4, 1.6);
    }
  };

  const drawArm = (side, swing, top, sway, raised) => {
    const sx = side * 10.5 + sway;
    const sy = top + 4.5;
    let ex = side * (13.5 - swing * 1.2) + sway;
    let ey = top + 13 - swing * 2;
    let hx = side * (12 - swing * 3) + sway;
    let hy = top + 21 - swing * 7;
    if (raised) {
      ex = side * 15 + sway;
      ey = top - 3;
      hx = side * 13 + sway;
      hy = top - 12;
    }
    ctx.strokeStyle = PALETTE.hoodieDark;
    ctx.lineWidth = 5.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = PALETTE.skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 2.4, 0, TAU);
    ctx.fill();
  };

  // Torso, backpack and hooded head, seen from behind; `hip` is the waist line, `top` the shoulders.
  const drawUpper = (hip, top, sway, time) => {
    ctx.fillStyle = PALETTE.hoodie;
    ctx.beginPath();
    ctx.moveTo(-9.5 + sway, hip);
    ctx.lineTo(9.5 + sway, hip);
    ctx.quadraticCurveTo(12.5 + sway, (hip + top) / 2, 11 + sway, top + 2);
    ctx.quadraticCurveTo(sway, top - 2, -11 + sway, top + 2);
    ctx.quadraticCurveTo(-12.5 + sway, (hip + top) / 2, -9.5 + sway, hip);
    ctx.fill();
    ctx.fillStyle = PALETTE.hoodieDark;
    ctx.fillRect(-9.8 + sway, hip - 3, 19.6, 3.2);

    const packTop = top + 3;
    const packH = Math.max(8, hip - top - 7);
    ctx.fillStyle = PALETTE.packDark;
    rrect(ctx, -8.5 + sway, packTop, 17, packH + 1, 4);
    ctx.fill();
    ctx.fillStyle = PALETTE.pack;
    rrect(ctx, -7.5 + sway, packTop + 1, 15, packH - 1, 3.5);
    ctx.fill();
    ctx.fillStyle = PALETTE.packDark;
    ctx.fillRect(-7.5 + sway, packTop + 2, 15, 3.5);
    ctx.fillStyle = "#eaffff";
    ctx.fillRect(-7.5 + sway, packTop + packH * 0.55, 15, 1.6);
    ctx.strokeStyle = PALETTE.strap;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5.5 + sway, packTop + 0.5);
    ctx.lineTo(-7.5 + sway, top - 1);
    ctx.moveTo(5.5 + sway, packTop + 0.5);
    ctx.lineTo(7.5 + sway, top - 1);
    ctx.stroke();

    const hx = sway * 1.1;
    const hy = top - 6;
    ctx.fillStyle = PALETTE.hoodieDark;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 7.6, 8.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.hoodie;
    ctx.beginPath();
    ctx.ellipse(hx, hy - 0.6, 6.8, 7.4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hoodieDark;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 7.6);
    ctx.lineTo(hx, hy + 6);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.phones;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(hx, hy, 7.8, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = PALETTE.phones;
    ctx.beginPath();
    ctx.ellipse(hx - 7.8, hy + 0.5, 2, 3, 0, 0, TAU);
    ctx.ellipse(hx + 7.8, hy + 0.5, 2, 3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.accent;
    ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(time * 6);
    ctx.fillRect(hx - 8.4, hy - 0.5, 1.2, 2);
    ctx.fillRect(hx + 7.2, hy - 0.5, 1.2, 2);
  };

  const runnerAlpha = () => {
    if (game.invuln > 0 && game.crashT < 0) {
      return reduceMotion || Math.floor(game.invuln * 12) % 2 === 0 ? 0.6 : 0.25;
    }
    return 1;
  };

  const drawDizzy = (x, y, time) => {
    ctx.fillStyle = PALETTE.high;
    for (let index = 0; index < 3; index += 1) {
      const angle = time * 5 + (index * TAU) / 3;
      ctx.fillRect(x + Math.cos(angle) * 12 * RS - 1.5 * RS, y + Math.sin(angle) * 4 * RS - 1.5 * RS, 3 * RS, 3 * RS);
    }
  };

  const drawRunner = (time) => {
    const s = FOCAL / RUNNER_Z;
    const baseX = px(game.x, RUNNER_Z);
    const groundY = py(0, RUNNER_Z);
    const shadowK = RS / (1 + game.y * 0.8);
    ctx.fillStyle = "rgba(10, 4, 20, 0.45)";
    ctx.beginPath();
    ctx.ellipse(baseX, groundY, 15 * shadowK, 3.6 * shadowK, 0, 0, TAU);
    ctx.fill();

    const crash = game.crashT >= 0 ? Math.min(1, game.crashT / 0.35) : 0;
    const wobble = game.stumble > 0 ? Math.sin(game.stumble * 40) * 0.2 * (game.stumble / STUMBLE_TIME) : 0;
    ctx.save();
    ctx.globalAlpha = runnerAlpha();
    ctx.translate(baseX, groundY - game.y * s);
    ctx.scale(RS, RS);
    ctx.rotate(game.lean + wobble + crash * 0.25);
    ctx.scale(game.sx * (1 + crash * 0.15), game.sy * (1 - crash * 0.55));

    const moving = game.speed > 0.5;
    const airborne = !game.grounded;
    const cheer = game.finishT >= 0;
    if (game.slideT > 0) {
      ctx.strokeStyle = PALETTE.pants;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-5, -9);
      ctx.lineTo(-7, -3);
      ctx.moveTo(5, -9);
      ctx.lineTo(7, -3);
      ctx.stroke();
      ctx.fillStyle = PALETTE.shoe;
      ctx.beginPath();
      ctx.ellipse(-7.5, -2, 4, 2.6, 0, 0, TAU);
      ctx.ellipse(7.5, -2, 4, 2.6, 0, 0, TAU);
      ctx.fill();
      drawArm(-1, -0.4, -26, 0, false);
      drawArm(1, -0.4, -26, 0, false);
      drawUpper(-7, -27, 0, time);
    } else {
      const p = game.run;
      const sw = moving ? Math.sin(p) : 0;
      const bob = moving && !airborne ? -Math.abs(Math.cos(p)) * 2.4 : 0;
      const sway = moving && !airborne ? sw * 1.2 : 0;
      const top = -50 + bob;
      drawLegBack(-5 + sway, -26 + bob, airborne ? 0.75 : Math.max(0, sw));
      drawLegBack(5 + sway, -26 + bob, airborne ? 0.55 : Math.max(0, -sw));
      const flail = game.stumble > 0 ? Math.sin(time * 30) : 0;
      drawArm(-1, airborne ? 1 : sw + flail, top, sway, cheer || airborne);
      drawArm(1, airborne ? 1 : -sw - flail, top, sway, cheer || airborne);
      drawUpper(-25 + bob, top, sway, time);
    }
    ctx.restore();

    if (game.crashT >= 0) {
      drawDizzy(baseX, groundY - 40 * RS, time);
    }
  };

  const drawObjects = (base, time) => {
    const list = game.drawList;
    list.length = 0;
    game.obstacles.forEach((o) => {
      const z0 = o.wz - base;
      if (z0 + o.len < NEAR_Z || z0 > FAR_Z || (o.kind !== "train" && z0 < NEAR_Z)) {
        return;
      }
      // A car alongside the runner sorts just behind them so the runner never vanishes into it.
      o.key = o.kind === "train" && z0 < RUNNER_Z && z0 + o.len > RUNNER_Z ? RUNNER_Z + 0.01 : z0;
      list.push(o);
    });
    game.coins.forEach((coin) => {
      const z = coin.wz - base;
      if (!coin.taken && z > NEAR_Z && z < FAR_Z) {
        coin.key = z;
        list.push(coin);
      }
    });
    if (game.finish) {
      const z = game.finish.wz - base;
      if (z > NEAR_Z && z < FAR_Z) {
        game.finish.key = z;
        list.push(game.finish);
      }
    }
    drawShadows(list);
    list.push(RUNNER);
    list.sort((a, b) => b.key - a.key);
    list.forEach((item) => {
      if (item.kind === "runner") {
        drawRunner(time);
      } else if (item.kind === "coin") {
        drawCoin(item, item.key, time);
      } else if (item.kind === "train") {
        drawTrain(item, item.wz - base);
      } else if (item.kind === "finish") {
        drawFinish(item.key);
      } else {
        drawBarrier(item, item.key);
      }
    });
  };

  const drawStreaks = () => {
    if (!game.streaks.length) {
      return;
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    const len = 22 * (SIDE ? 0.7 : VIEW.fx);
    game.streaks.forEach((streak) => {
      const dir = streakDir(streak);
      ctx.globalAlpha = (1 - streak.age / streak.life) * 0.45;
      ctx.beginPath();
      ctx.moveTo(streak.x, streak.y);
      ctx.lineTo(streak.x - dir.x * len, streak.y - dir.y * len);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  };

  // Progress bar along the top of the play area (the strip runs it along the bottom).
  const drawProgress = () => {
    const k = clamp(game.dist / CONFIG.goal, 0, 1);
    const x0 = SAFE.x + 10;
    const w = SAFE.w - 20;
    const y = SIDE ? HEIGHT - 2.5 : SAFE.y + 3.5;
    const t = SIDE ? 1.6 : 3;
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(x0, y - t / 2, w, t);
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(x0, y - t / 2, w * k, t);
    ctx.fillStyle = "#ffffff";
    for (let index = 0; index < 4; index += 1) {
      ctx.fillRect(x0 + w - 4 + (index % 2) * 2, y - 2 + Math.floor(index / 2) * 2 + (index % 2) * 2 - 1, 2, 2);
    }
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.arc(x0 + w * k, y, t + 0.2, 0, TAU);
    ctx.fill();
  };

  const HINT = {
    popup: { text: "SWIPE OR ARROWS TO DODGE", y: 128, size: 10, icon: true },
    rail: { text: "SWIPE TO DODGE", y: SAFE.y + 46, size: 7, icon: false },
    strip: { text: "SWIPE UP/DOWN TO SWITCH · TAP TO JUMP", y: 8, size: 7.5, icon: false }
  }[FORMAT];

  const drawHint = () => {
    if (game.playT > HINT_TIME) {
      return;
    }
    const mid = SAFE.x + SAFE.w / 2;
    ctx.globalAlpha = Math.min(1, (HINT_TIME - game.playT) / 0.5);
    ctx.font = `900 ${HINT.size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const icon = HINT.icon ? 18 : 0;
    const w = Math.min(SAFE.w - 6, ctx.measureText(HINT.text).width + HINT.size * 2 + icon);
    const r = HINT.size * 1.1;
    const left = mid - w / 2;
    ctx.fillStyle = "rgba(20, 10, 42, 0.62)";
    ctx.beginPath();
    ctx.arc(left + r, HINT.y, r, Math.PI / 2, Math.PI * 1.5);
    ctx.arc(left + w - r, HINT.y, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    if (HINT.icon) {
      const cx = left + 16;
      const cy = HINT.y;
      ctx.fillStyle = PALETTE.accent;
      quad(cx, cy - 7, cx + 3, cy - 3, cx - 3, cy - 3, cx, cy - 7);
      quad(cx, cy + 7, cx + 3, cy + 3, cx - 3, cy + 3, cx, cy + 7);
      quad(cx - 7, cy, cx - 3, cy - 3, cx - 3, cy + 3, cx - 7, cy);
      quad(cx + 7, cy, cx + 3, cy - 3, cx + 3, cy + 3, cx + 7, cy);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(HINT.text, mid + icon / 2, HINT.y + 0.5);
    ctx.globalAlpha = 1;
  };

  /* ---- strip: side view, lanes stacked top (far) to bottom (near) */

  const oval = (x, y, rx, ry) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  };

  const limb = (x1, y1, x2, y2, x3, y3, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  };

  const drawSideScenery = () => {
    const ppm = SIDE.ppm;
    ctx.drawImage(ART.backdrop, -20, 0, WIDTH + 40, HEIGHT);
    // Lamp posts drift behind the wall a little slower than the track.
    ctx.fillStyle = PALETTE.gantry;
    const drift = game.dist * 0.7;
    for (let k = Math.floor((drift - 20) / 16); SIDE.runnerX + (k * 16 - drift) * ppm < WIDTH + 4; k += 1) {
      const x = SIDE.runnerX + (k * 16 - drift) * ppm;
      ctx.fillRect(x, 1, 1.2, 12);
      ctx.fillRect(x - 1, 1, 3.4, 1.4);
    }
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(0, 12, WIDTH, 5);
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(0, 12, WIDTH, 1);
    ctx.fillStyle = PALETTE.ballast;
    SIDE.laneY.forEach((y) => ctx.fillRect(0, y - 1, WIDTH, 4));
    ctx.fillStyle = PALETTE.sleeper;
    ctx.beginPath();
    for (let k = Math.floor((game.dist - SIDE.runnerX / ppm) / SLEEPER_GAP); sideX(k * SLEEPER_GAP) < WIDTH + 2; k += 1) {
      const x = sideX(k * SLEEPER_GAP);
      SIDE.laneY.forEach((y) => ctx.rect(x - 1.1, y, 2.2, 3));
      if (k % 4 === 0) {
        ctx.rect(x, 13, 0.8, 4);
      }
    }
    ctx.fill();
    ctx.fillStyle = PALETTE.rail;
    SIDE.laneY.forEach((y) => ctx.fillRect(0, y - 0.6, WIDTH, 1.2));
    ctx.fillStyle = PALETTE.railShine;
    SIDE.laneY.forEach((y) => ctx.fillRect(0, y - 0.6, WIDTH, 0.4));
  };

  const drawSideTrain = (o, feet) => {
    const x0 = sideX(o.wz);
    const x1 = sideX(o.wz + o.len);
    if (x1 < 0 || x0 > WIDTH) {
      return;
    }
    const style = TRAIN_STYLES[o.style];
    const top = feet - 11.5;
    const w = x1 - x0;
    ctx.fillStyle = "rgba(10, 4, 20, 0.35)";
    ctx.fillRect(x0 - 1, feet - 0.5, w + 2, 2.5);
    ctx.fillStyle = style.side;
    ctx.fillRect(x0, top + 1, w, 9);
    ctx.fillStyle = style.roof;
    ctx.fillRect(x0 + 1, top, w - 2, 1.5);
    ctx.fillStyle = style.glass;
    ctx.fillRect(x0 + 3, top + 2.6, w - 6, 3);
    ctx.fillStyle = style.side;
    for (let x = x0 + 9; x < x1 - 4; x += 7) {
      ctx.fillRect(x, top + 2.6, 1, 3);
    }
    ctx.fillStyle = style.stripe;
    ctx.fillRect(x0, top + 6.6, w, 1.2);
    ctx.fillStyle = style.bodyDark;
    ctx.fillRect(x0, top + 1, 2.4, 9);
    ctx.fillStyle = "#fff6d2";
    ctx.fillRect(x0 - 0.4, top + 7.6, 1.4, 1.4);
    ctx.fillStyle = "#141020";
    ctx.fillRect(x0 + 1, top + 10, w - 2, 1.5);
    [6, 14, w - 14, w - 6].forEach((dx) => oval(x0 + dx, feet - 1, 1.5, 1.5));
  };

  const drawSideBarrier = (o, feet) => {
    const x = sideX(o.wz);
    if (x < -6 || x > WIDTH + 6) {
      return;
    }
    const h = 0.95 * SIDE.ppmY;
    ctx.fillStyle = "rgba(10, 4, 20, 0.35)";
    oval(x, feet + 0.6, 5, 1.2);
    if (o.hit) {
      ctx.fillStyle = PALETTE.barrier;
      ctx.fillRect(x - 4, feet - 2, 8, 2);
      return;
    }
    ctx.fillStyle = PALETTE.post;
    ctx.fillRect(x - 3.4, feet - h, 1.2, h);
    ctx.fillRect(x + 2.2, feet - h, 1.2, h);
    ctx.fillStyle = PALETTE.barrier;
    ctx.fillRect(x - 4.2, feet - h, 8.4, 3.4);
    ctx.fillStyle = PALETTE.barrierLight;
    ctx.fillRect(x - 2.4, feet - h, 1.4, 3.4);
    ctx.fillRect(x + 1, feet - h, 1.4, 3.4);
    ctx.fillStyle = PALETTE.lamp;
    oval(x - 2.8, feet - h - 0.8, 0.9, 0.9);
  };

  const drawSideCoin = (coin, feet, time) => {
    const x = sideX(coin.wz);
    if (x < -4 || x > WIDTH + 4) {
      return;
    }
    const y = feet - (coin.y + 0.3) * SIDE.ppmY;
    const spin = Math.abs(Math.cos(time * 5 + coin.phase));
    ctx.fillStyle = PALETTE.coinDark;
    oval(x, y, Math.max(0.5, 2.4 * spin), 2.4);
    ctx.fillStyle = PALETTE.coin;
    oval(x, y, Math.max(0.3, 1.8 * spin), 1.8);
  };

  const drawSideFinish = () => {
    const x = sideX(game.finish.wz);
    if (x < -30 || x > WIDTH + 30) {
      return;
    }
    ctx.fillStyle = "#ffffff";
    for (let row = 0; 9 + row * 2 < HEIGHT - 3; row += 1) {
      ctx.fillRect(x - 2 + (row % 2) * 2, 9 + row * 2, 2, 2);
    }
    ctx.fillStyle = "#16112a";
    ctx.fillRect(x - 21, 0.5, 42, 8.5);
    ctx.fillStyle = PALETTE.accent;
    ctx.font = "italic 900 7px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("FINISH", x, 5);
  };

  // Profile of the same hooded runner, facing right, authored ~60 units tall.
  const drawSideRunner = (time) => {
    const feet = laneFeet(game.x / LANE_W);
    const k = 1 / (1 + game.y * 0.8);
    ctx.fillStyle = "rgba(10, 4, 20, 0.45)";
    oval(SIDE.runnerX, feet + 0.5, 6 * k, 1.4 * k);
    const crash = game.crashT >= 0 ? Math.min(1, game.crashT / 0.35) : 0;
    const wobble = game.stumble > 0 ? Math.sin(game.stumble * 40) * 0.25 * (game.stumble / STUMBLE_TIME) : 0;
    ctx.save();
    ctx.globalAlpha = runnerAlpha();
    ctx.translate(SIDE.runnerX, feet - game.y * SIDE.ppmY);
    ctx.scale(RS, RS);
    ctx.rotate(0.12 + wobble + crash * 1.25);
    ctx.scale(game.sx, game.sy);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const moving = game.speed > 0.5 && crash === 0;
    const air = !game.grounded;
    const sw = moving && !air ? Math.sin(game.run) : 0;
    const bob = moving && !air ? -Math.abs(Math.cos(game.run)) * 2.4 : 0;
    const cheer = game.finishT >= 0;
    const hipY = -27 + bob;
    const leg = (a, color) => {
      const kx = Math.sin(a) * 13;
      const ky = hipY + Math.cos(a) * 13;
      const shin = a < 0 ? a - 0.3 + a * 1.2 : a * 0.3;
      const fx = kx + Math.sin(shin) * 13;
      const fy = ky + Math.cos(shin) * 13;
      limb(0, hipY, kx, ky, fx, fy, color, 7);
      ctx.fillStyle = PALETTE.shoe;
      oval(fx + 3, fy, 5.5, 2.8);
      ctx.fillStyle = PALETTE.sole;
      ctx.fillRect(fx - 2.5, fy + 1.4, 11, 1.6);
    };
    const arm = (b, color) => {
      const sy = -46 + bob;
      const ex = 2 + Math.sin(b) * 10;
      const ey = sy + Math.cos(b) * 10;
      const fore = cheer ? b : b + 1.3;
      const hx = ex + Math.sin(fore) * 9;
      const hy = ey + Math.cos(fore) * 9;
      limb(2, sy, ex, ey, hx, hy, color, 5.5);
      ctx.fillStyle = PALETTE.skin;
      oval(hx, hy, 2.4, 2.4);
    };
    const front = air ? 1 : sw * 0.9;
    const back = air ? -0.6 : -sw * 0.9;
    arm(cheer ? 2.7 : (air ? -1.1 : sw), PALETTE.hoodieDark);
    leg(back, "#1a2036");
    ctx.fillStyle = PALETTE.hoodie;
    ctx.beginPath();
    ctx.ellipse(1, -37 + bob, 8.5, 11.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.packDark;
    rrect(ctx, -13, -47 + bob, 9.5, 17, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.pack;
    rrect(ctx, -12.2, -45 + bob, 7.8, 14, 2.5);
    ctx.fill();
    ctx.fillStyle = "#eaffff";
    ctx.fillRect(-12.2, -38 + bob, 7.8, 1.6);
    ctx.fillStyle = PALETTE.hoodieDark;
    oval(3.4, -55 + bob, 7.8, 8);
    ctx.fillStyle = PALETTE.skin;
    oval(7.6, -54 + bob, 3.6, 4.6);
    ctx.fillStyle = "#1c1830";
    oval(9.2, -55.6 + bob, 0.9, 1.1);
    ctx.fillStyle = PALETTE.phones;
    oval(2, -54.6 + bob, 2.6, 3.4);
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(1.4, -56 + bob, 1.2, 2.6);
    leg(front, PALETTE.pants);
    arm(cheer ? 2.4 : (air ? 2.2 : -sw), PALETTE.hoodie);
    ctx.restore();
    if (game.crashT >= 0) {
      drawDizzy(SIDE.runnerX, feet - 10, time);
    }
  };

  const drawSide = (time) => {
    drawSideScenery();
    const runnerLane = Math.round(game.x / LANE_W);
    for (let lane = -1; lane <= 1; lane += 1) {
      const feet = SIDE.laneY[lane + 1];
      game.obstacles.forEach((o) => {
        if (o.lane === lane) {
          if (o.kind === "train") {
            drawSideTrain(o, feet);
          } else {
            drawSideBarrier(o, feet);
          }
        }
      });
      game.coins.forEach((coin) => {
        if (!coin.taken && Math.round(coin.x / LANE_W) === lane) {
          drawSideCoin(coin, feet, time);
        }
      });
      if (lane === runnerLane) {
        drawSideRunner(time);
      }
    }
    if (game.finish) {
      drawSideFinish();
    }
  };

  const draw = (time) => {
    if (SIDE) {
      drawSide(time);
    } else {
      viewX = game.camX;
      const base = game.dist - RUNNER_Z;
      ctx.drawImage(ART.backdrop, -20 - viewX * 4 * VIEW.fx, 0, WIDTH + 40, HEIGHT);
      drawBuildings(base);
      drawTrack(base);
      drawGantries(base);
      ctx.fillStyle = FOG_BAND;
      ctx.fillRect(0, FOG.top, WIDTH, FOG.h);
      drawObjects(base, time);
    }
    drawFx();
    drawStreaks();
    if (game.flash > 0) {
      ctx.globalAlpha = game.flash / 0.35;
      ctx.fillStyle = VIGNETTE;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    }
    if (Shell.phase === "play") {
      drawProgress();
      drawHint();
    }
  };

  const act = (action) => {
    if (action === "left") {
      moveLane(-1);
    } else if (action === "right") {
      moveLane(1);
    } else if (action === "jump") {
      jump();
    } else if (action === "slide") {
      slide();
    }
  };

  // Strip: vertical swipes switch rows (up = toward the top row), anything sideways jumps.
  const swipeAction = (dx, dy) => {
    if (SIDE) {
      return Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? "left" : "right") : "jump";
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? "left" : "right";
    }
    return dy < 0 ? "jump" : "slide";
  };

  const onPointerDown = (point, event) => {
    swipes.set(event ? event.pointerId : 0, { x: point.x, y: point.y, fired: false });
  };

  // Swipes fire as soon as they pass the threshold, so the runner reacts mid-gesture.
  const onPointerMove = (point, event) => {
    const swipe = swipes.get(event ? event.pointerId : 0);
    if (!swipe || swipe.fired) {
      return;
    }
    const dx = point.x - swipe.x;
    const dy = point.y - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_MIN) {
      swipe.fired = true;
      act(swipeAction(dx, dy));
    }
  };

  // A release without a swipe is a tap: left or right half of the stage
  // switches lanes (strip: a tap jumps).
  const onPointerUp = (point, event) => {
    const id = event ? event.pointerId : 0;
    const swipe = swipes.get(id);
    swipes.delete(id);
    if (!swipe || swipe.fired || (event && event.type === "pointercancel")) {
      return;
    }
    const dx = point.x - swipe.x;
    const dy = point.y - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_MIN * 0.6) {
      act(swipeAction(dx, dy));
    } else if (SIDE) {
      act("jump");
    } else {
      act(swipe.x < WIDTH / 2 ? "left" : "right");
    }
  };

  const onKey = (key, down, event) => {
    const action = KEYMAP[key];
    if (!action) {
      return false;
    }
    if (down && !(event && event.repeat)) {
      act(action);
    }
    return true;
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
    endEyebrow.textContent = `${CONFIG.scoreLabel} ${Shell.score}${CONFIG.scoreUnit}`;
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

  // A gesture interrupted by focus loss never sends its pointerup; forget it.
  ad.addEventListener("blur", releaseInput);

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
    // Compact HUDs drop the space so three items fit.
    goalValue.textContent = `/${FORMAT === "popup" ? " " : ""}${CONFIG.goal}${CONFIG.scoreUnit}`;
  }
  if (offerValue) {
    offerValue.textContent = CONFIG.offer;
  }
  resetGame();
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
