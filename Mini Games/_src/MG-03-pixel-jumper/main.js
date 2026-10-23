(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-pixel-jumper",           // CustomEvent namespace
    api: "mgPixelJumper",                     // window.<api> handle
    campaign: "lumo-pad-7",
    offer: "−20%",
    winTitle: "Gate cleared!",
    loseTitle: "So close!",
    scoreLabel: "Coins",                      // end-card eyebrow reads "<label> <score>"
    goal: 1,                                  // gates to reach; the win is decided in update(), score counts coins
    maxPlayMs: 60000,                         // hard stop: a session never runs past this (strip: 45s)
    idleStopMs: 30000                         // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#3d9cf5",
    skyMid: "#8ad3ff",
    skyLow: "#ffeac4",
    farTop: "#97b4ee",
    farLow: "#cddff8",
    nearTop: "#5cc46a",
    nearLow: "#2f8f4e",
    tree: "#2b8748",
    treeLight: "#55bd62",
    trunk: "#7a4a2a",
    cloud: "#ffffff",
    cloudShade: "#cfe4fa",
    grass: "#72d94e",
    grassDark: "#3c9f3a",
    grassLight: "#c6f68e",
    dirt: "#c47a44",
    dirtDark: "#97552c",
    dirtLight: "#e3a067",
    stone: "#b7c0d4",
    stoneDark: "#6e7895",
    stoneLight: "#e8eef8",
    brick: "#dc6a3c",
    brickDark: "#a3401f",
    brickLight: "#ffa070",
    mortar: "#6e2814",
    crate: "#e9a64c",
    crateDark: "#8f5a22",
    crateLight: "#ffd38f",
    used: "#9b7a58",
    usedDark: "#5e4632",
    plank: "#bb7a40",
    plankDark: "#774620",
    plankLight: "#e6a868",
    star: "#fff16a",
    coin: "#ffd23f",
    coinDark: "#d38a10",
    coinLight: "#fff7c2",
    fox: "#ff8a2a",
    foxDark: "#d65f17",
    cream: "#fff3df",
    ink: "#2a1a12",
    scarf: "#1fc8b6",
    scarfDark: "#11968a",
    bug: "#8a63ff",
    bugDark: "#4d33b8",
    bugBelly: "#2d1d6e",
    bugSpot: "#ffe066",
    lift: "#5b6b8c",
    liftDark: "#2c3550",
    flame: "#ffb02e",
    flag: "#ff5d7a",
    accent: "#ffb52e",
    dust: "#f6e7c8",
    text: "#ffffff"
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

  // Tile maps. # ground  X stone  B brick  S star crate  - plank (one-way)
  // o coin  e critter  M moving lift  C checkpoint  G goal gate  P start
  const LEVELS = {
    // Popup and rail: ten rows, the bottom three are ground.
    long: [
      "..................................oo..............................................................................oo..................................",
      ".................................----............................................................................----.................................",
      "..........S..BSB.....................................BBSBB...............................SB.................................BSB.......................",
      ".............................oo.................o...............oo.............................oo..oo..................o................o.............",
      "......................oo....----...............o.o.............----................oo.............e.........----......o.o...............X.............",
      ".....ooo.............o..o...............X..................................oooo...............########.................................XX..ooo........",
      "...P...........................e.......XX...e...............e......e....C.....................########......e.....................e...XXX.......G.....",
      "######################..#######################...################################M...################################...#############################",
      "######################..#######################...################################....################################...#############################",
      "######################..#######################...################################....################################...#############################"
    ],
    // Strip: four rows, one of ground. The hero runs by itself and taps jump.
    short: [
      "................BSB............oo....oo..............ooo..BSB............................o.........ooo...............oo...ooo................o.....BSB..........",
      "............ooo.....................----.....X................................oooo................########..........----.....................X...ooo............",
      "........P.................e.............e...XX......................e......e......C...............########...........e...............e......XX..........G.......",
      "###############################..####################...################################M..###############################...###################################"
    ]
  };

  // tile: served px per 16px design tile (art and physics scale with it).
  // groundY: screen y of the ground line. anchor: hero x from SAFE.x while running right.
  // bg: scale of the hills and clouds. jump: jump-speed factor (the strip has little headroom).
  const LAYOUT = {
    popup: {
      tile: 16, level: "long", groundY: 202, anchor: 104, bg: 1, jump: 1, autoRun: false,
      sun: [236, 58, 11], clouds: [40, 66, 34, 58, 44],
      pads: { left: { x: 30, y: 224, r: 20 }, right: { x: 78, y: 224, r: 20 }, jump: { x: 266, y: 220, r: 24 } },
      zone: { top: 168, split: 54, right: 120 },
      hint: { text: "REACH THE GOAL GATE", y: 42, size: 10 }
    },
    rail: {
      tile: 12, level: "long", groundY: 204, anchor: 22, bg: 0.75, jump: 1, autoRun: false,
      sun: [72, 70, 9], clouds: [56, 84, 48, 76, 64],
      pads: { left: { x: 15, y: 223, r: 12 }, right: { x: 43, y: 223, r: 12 }, jump: { x: 82, y: 221, r: 15 } },
      zone: { top: 196, split: 29, right: 58 },
      hint: { text: "REACH THE GATE", y: SAFE.y + 12, size: 7 }
    },
    strip: {
      tile: 10, level: "short", groundY: 45, anchor: 70, bg: 0.32, jump: 0.87, autoRun: true,
      sun: [SAFE.x + SAFE.w - 70, 13, 6], clouds: [4, 10, 2, 8, 5],
      pads: null,
      zone: null,
      hint: { text: "TAP TO JUMP · REACH THE GATE", y: 7, size: 7.5 }
    }
  }[FORMAT];

  if (FORMAT === "strip") {
    CONFIG.maxPlayMs = 45000;
  }

  const MAP = LEVELS[LAYOUT.level];
  const ROWS = MAP.length;
  const COLS = MAP[0].length;
  const GROUND_ROW = LAYOUT.level === "long" ? ROWS - 3 : ROWS - 1;
  const TILE = LAYOUT.tile;
  const S = TILE / 16;
  const BG = LAYOUT.bg;
  const MAP_TOP = LAYOUT.groundY - GROUND_ROW * TILE;   // world y of map row 0
  const MAP_BOTTOM = MAP_TOP + ROWS * TILE;
  const LEVEL_W = COLS * TILE;
  const VIEW_MID = SAFE.x + SAFE.w / 2;
  const LOOKAHEAD = SAFE.w / 2 - LAYOUT.anchor;

  const SUBSTEP = 1 / 120;         // physics substep, so collisions feel the same at any refresh rate
  const MAX_SPEED = 110 * S;
  const RUN_ACCEL = 720 * S;
  const AIR_ACCEL = 520 * S;
  const TURN_BOOST = 1.7;
  const GROUND_FRICTION = 900 * S;
  const AIR_DRAG = 180 * S;
  const GRAVITY = 980 * S;         // rising while jump is held
  const RELEASE_GRAVITY = 2500 * S; // rising after jump is let go: short hops
  const FALL_GRAVITY = 1150 * S;
  const MAX_FALL = 430 * S;
  const JUMP_SPEED = 370 * S * LAYOUT.jump;   // ~4.4 tiles apex (strip ~3.3), ~5 tiles across at full run
  const COYOTE_TIME = 0.08;
  const JUMP_BUFFER = 0.1;
  const CORNER_NUDGE = 3 * S;
  const STOMP_BOUNCE = 250 * S * LAYOUT.jump;
  const STOMP_BOUNCE_HELD = 340 * S * LAYOUT.jump;
  const HERO_W = 10 * S;
  const HERO_H = 17 * S;
  const START_LIVES = 3;
  const INVULN_TIME = 1.6;
  const RESPAWN_DELAY = 0.9;
  const ENEMY_SPEED = 26 * S;
  const ENEMY_W = 14 * S;
  const ENEMY_H = 11 * S;
  const SQUASH_TIME = 0.55;
  const LIFT_PERIOD = 2.8;
  const CELEBRATE_TIME = 1.4;
  const MAX_DEBRIS = 40;
  const HINT_TIME = 2.6;

  // Hills and clouds sit relative to the ground line; strips tile every STRIP_W.
  const STRIP_W = 600 * BG;
  const FAR_TOP = LAYOUT.groundY - 106 * BG;
  const NEAR_TOP = LAYOUT.groundY - 62 * BG;
  const CLOUDS = [[60, 1], [250, 0.7], [430, 0.85], [610, 0.6], [780, 0.9]].map(([x, s], index) => ({ x: x * BG, y: LAYOUT.clouds[index], s: s * BG }));

  const TAU = Math.PI * 2;
  const NO_INPUT = { x: 0, jump: false };
  const KEYMAP = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    " ": "jump", Spacebar: "jump", ArrowUp: "jump", w: "jump", W: "jump"
  };

  const keys = { left: false, right: false, jump: false };
  const touches = new Map();   // pointerId -> "left" | "right" | "jump" | "" (slid off the arrows)

  const game = {
    grid: [],
    coins: [],
    enemies: [],
    lifts: [],
    pops: [],
    debris: [],
    bumps: [],
    start: { x: 0, y: 0 },
    checkpoint: { x: 0, y: 0, active: false, raise: 0 },
    gate: { x: 0, y: 0 },
    hero: {},
    bot: { hold: 0, bestX: 0, stuckT: 0, input: { x: 1, jump: false } },
    input: { x: 0, jump: false, left: false, right: false },
    lives: START_LIVES,
    camX: 0,
    camY: 0,
    look: LOOKAHEAD,
    jumpBuffer: 0,
    winT: -1,
    fireworkT: 0,
    quake: 0,
    playT: 0
  };

  const approach = (value, target, delta) => (value < target ? Math.min(value + delta, target) : Math.max(value - delta, target));
  const colAt = (x) => Math.floor(x / TILE);
  const rowAt = (y) => Math.floor((y - MAP_TOP) / TILE);
  const rowTop = (r) => MAP_TOP + r * TILE;

  const isSolid = (c, r) => {
    if (r < 0 || r >= ROWS) {
      return false;
    }
    if (c < 0 || c >= COLS) {
      return true;
    }
    const tile = game.grid[r][c];
    return tile === "#" || tile === "X" || tile === "B" || tile === "S" || tile === "U";
  };

  const isPlank = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < COLS && game.grid[r][c] === "-";

  const floorAt = (c, r, prevFeet) => isSolid(c, r) || (isPlank(c, r) && prevFeet <= rowTop(r) + 0.5);

  const hasFloorBelow = (c, r) => {
    for (let row = Math.max(0, r); row < ROWS; row += 1) {
      if (isSolid(c, row) || isPlank(c, row)) {
        return true;
      }
    }
    return false;
  };

  /* ---- art, painted once into offscreen canvases */

  // Painters work in design units (16px tiles); `scale` maps them to served px.
  const makeLayer = (w, h, paint, scale = 1) => {
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(w * DPR);
    layer.height = Math.ceil(h * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR * scale, 0, 0, DPR * scale, 0, 0);
    paint(g, w / scale, h / scale);
    return layer;
  };

  const D = 16;   // design tile

  const blob = (g, x, y, r) => {
    g.moveTo(x + r, y);
    g.arc(x, y, r, 0, TAU);
  };

  const starPath = (g, x, y, outer, inner) => {
    g.beginPath();
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const radius = index % 2 === 0 ? outer : inner;
      g.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    g.closePath();
  };

  const paintSky = (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyLow);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const [sx, sy, sr] = LAYOUT.sun;
    const sun = g.createRadialGradient(sx, sy, sr * 0.36, sx, sy, sr * 6.7);
    sun.addColorStop(0, "rgba(255, 252, 222, 0.95)");
    sun.addColorStop(0.2, "rgba(255, 240, 182, 0.55)");
    sun.addColorStop(1, "rgba(255, 240, 182, 0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fffbe8";
    g.beginPath();
    g.arc(sx, sy, sr, 0, TAU);
    g.fill();
  };

  // Ridge lines use whole periods across STRIP_W so the strips tile seamlessly.
  const paintFar = (g, w, h) => {
    const ridge = (x) => 52 - 20 * Math.sin((x / w) * TAU * 2 + 0.6) - 11 * Math.sin((x / w) * TAU * 5 + 1.9) - 5 * Math.sin((x / w) * TAU * 11);
    const fill = g.createLinearGradient(0, 10, 0, h);
    fill.addColorStop(0, PALETTE.farTop);
    fill.addColorStop(1, PALETTE.farLow);
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      g.lineTo(x, ridge(x));
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255, 255, 255, 0.4)";
    g.lineWidth = 1.2;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) {
      g.lineTo(x, ridge(x) + 0.6);
    }
    g.stroke();
  };

  const paintTree = (g, x, y, s) => {
    g.fillStyle = PALETTE.trunk;
    g.fillRect(x - s, y - 6 * s, 2 * s, 7 * s);
    g.fillStyle = PALETTE.tree;
    g.beginPath();
    blob(g, x - 3.6 * s, y - 8 * s, 4.4 * s);
    blob(g, x + 3.6 * s, y - 8.5 * s, 4.4 * s);
    blob(g, x, y - 12.5 * s, 5.4 * s);
    g.fill();
    g.fillStyle = PALETTE.treeLight;
    g.beginPath();
    blob(g, x - 1.6 * s, y - 14.2 * s, 2.3 * s);
    g.fill();
  };

  const paintNear = (g, w, h) => {
    const ridge = (x) => 46 - 13 * Math.sin((x / w) * TAU * 3 + 2) - 7 * Math.sin((x / w) * TAU * 7 + 0.4);
    for (let index = 0; index < 9; index += 1) {
      const tx = index * (w / 9) + 18 * Math.sin(index * 3.1);
      const scale = 0.8 + 0.3 * Math.abs(Math.sin(index * 1.7));
      [tx - w, tx, tx + w].forEach((x) => paintTree(g, x, ridge(((x % w) + w) % w) + 3, scale));
    }
    const fill = g.createLinearGradient(0, 20, 0, h);
    fill.addColorStop(0, PALETTE.nearTop);
    fill.addColorStop(1, PALETTE.nearLow);
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      g.lineTo(x, ridge(x));
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(210, 255, 170, 0.5)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) {
      g.lineTo(x, ridge(x) + 0.5);
    }
    g.stroke();
  };

  const paintCloud = (g) => {
    const puff = (dy, color) => {
      g.fillStyle = color;
      g.beginPath();
      blob(g, 16, 19 + dy, 9);
      blob(g, 29, 13 + dy, 11);
      blob(g, 43, 16 + dy, 9.5);
      blob(g, 53, 20 + dy, 7);
      g.rect(14, 18 + dy, 40, 9);
      g.fill();
    };
    puff(2, PALETTE.cloudShade);
    puff(0, PALETTE.cloud);
  };

  const paintGround = (g, grassy) => {
    g.fillStyle = PALETTE.dirt;
    g.fillRect(0, 0, D, D);
    g.fillStyle = PALETTE.dirtDark;
    [[3, 9, 2], [11, 12, 2], [7, 14, 1], [13, 4, 1], [2, 2, 1], [8, 6, 1]].forEach(([x, y, s]) => g.fillRect(x, y, s, s));
    g.fillStyle = PALETTE.dirtLight;
    [[9, 9], [5, 12], [14, 15], [12, 2]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
    if (!grassy) {
      return;
    }
    g.fillStyle = PALETTE.grassDark;
    g.fillRect(0, 0, D, 5);
    for (let x = 2; x < D; x += 4) {
      g.beginPath();
      g.arc(x, 5, 2, 0, Math.PI);
      g.fill();
    }
    g.fillStyle = PALETTE.grass;
    g.fillRect(0, 0, D, 3.5);
    for (let x = 0; x <= D; x += 4) {
      g.beginPath();
      g.arc(x, 3.5, 1.6, 0, Math.PI);
      g.fill();
    }
    g.fillStyle = PALETTE.grassLight;
    g.fillRect(0, 0, D, 1);
    g.fillRect(3, 1, 2, 1);
    g.fillRect(10, 1, 3, 1);
  };

  const paintStone = (g) => {
    g.fillStyle = PALETTE.stoneDark;
    g.fillRect(0, 0, D, D);
    g.fillStyle = PALETTE.stone;
    g.fillRect(1, 1, 14, 14);
    g.fillStyle = PALETTE.stoneLight;
    g.fillRect(1, 1, 14, 2);
    g.fillRect(1, 3, 2, 12);
    g.fillStyle = "rgba(60, 70, 100, 0.35)";
    g.fillRect(3, 13, 12, 2);
    g.fillRect(13, 3, 2, 10);
    g.fillStyle = PALETTE.stoneDark;
    g.fillRect(6, 6, 2, 2);
    g.fillRect(9, 9, 1, 1);
  };

  const paintBrick = (g) => {
    g.fillStyle = PALETTE.mortar;
    g.fillRect(0, 0, D, D);
    const brick = (x, y, w) => {
      g.fillStyle = PALETTE.brick;
      g.fillRect(x, y, w, 7);
      g.fillStyle = PALETTE.brickLight;
      g.fillRect(x, y, w, 1);
      g.fillStyle = PALETTE.brickDark;
      g.fillRect(x, y + 6, w, 1);
    };
    brick(0, 0, 7);
    brick(8, 0, 8);
    brick(0, 8, 3);
    brick(4, 8, 7);
    brick(12, 8, 4);
  };

  const paintCrate = (g, used) => {
    g.fillStyle = used ? PALETTE.usedDark : PALETTE.crateDark;
    g.fillRect(0, 0, D, D);
    g.fillStyle = used ? PALETTE.used : PALETTE.crate;
    g.fillRect(1, 1, 14, 14);
    g.fillStyle = used ? "rgba(255, 255, 255, 0.12)" : PALETTE.crateLight;
    g.fillRect(1, 1, 14, 1);
    g.fillRect(1, 1, 1, 14);
    g.fillStyle = used ? PALETTE.usedDark : PALETTE.crateDark;
    [[2, 2], [12, 2], [2, 12], [12, 12]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
    if (used) {
      g.fillRect(4, 7, 8, 2);
    }
  };

  const paintPlank = (g) => {
    g.fillStyle = PALETTE.plankDark;
    g.fillRect(0, 0, D, 6);
    g.fillStyle = PALETTE.plank;
    g.fillRect(0, 0, D, 4);
    g.fillStyle = PALETTE.plankLight;
    g.fillRect(0, 0, D, 1);
    g.fillStyle = PALETTE.plankDark;
    g.fillRect(7, 1, 1, 3);
    g.fillRect(15, 1, 1, 3);
    g.fillRect(3, 6, 2, 2);
    g.fillRect(11, 6, 2, 2);
  };

  const ART = {
    sky: makeLayer(WIDTH, HEIGHT, paintSky),
    far: makeLayer(STRIP_W, HEIGHT - FAR_TOP, paintFar, BG),
    near: makeLayer(STRIP_W, HEIGHT - NEAR_TOP, paintNear, BG),
    cloud: makeLayer(64, 30, paintCloud),
    grass: makeLayer(TILE, TILE, (g) => paintGround(g, true), S),
    dirt: makeLayer(TILE, TILE, (g) => paintGround(g, false), S),
    stone: makeLayer(TILE, TILE, paintStone, S),
    brick: makeLayer(TILE, TILE, paintBrick, S),
    crate: makeLayer(TILE, TILE, (g) => paintCrate(g, false), S),
    used: makeLayer(TILE, TILE, (g) => paintCrate(g, true), S),
    plank: makeLayer(TILE, 8 * S, paintPlank, S)
  };

  const PIT_FADE = ctx.createLinearGradient(0, rowTop(GROUND_ROW) - 6 * S, 0, MAP_BOTTOM);
  PIT_FADE.addColorStop(0, "rgba(16, 40, 72, 0)");
  PIT_FADE.addColorStop(1, "rgba(10, 22, 44, 0.85)");

  /* ---- state */

  const showLives = () => {
    if (livesValue) {
      livesValue.dataset.lives = String(Math.max(0, game.lives));
    }
  };

  const resetHero = (spot) => {
    Object.assign(game.hero, {
      x: spot.x,
      y: spot.y,
      vx: 0,
      vy: 0,
      face: 1,
      grounded: true,
      coyote: 0,
      ride: null,
      sx: 1,
      sy: 1,
      run: 0,
      blink: 2,
      invuln: 0,
      dead: false,
      deadT: 0,
      spin: 0
    });
  };

  const releaseInput = () => {
    keys.left = false;
    keys.right = false;
    keys.jump = false;
    touches.clear();
  };

  const resetGame = () => {
    game.grid = MAP.map((row) => row.split(""));
    game.coins = [];
    game.enemies = [];
    game.lifts = [];
    game.pops = [];
    game.debris = [];
    game.bumps = [];
    game.grid.forEach((row, r) => {
      row.forEach((tile, c) => {
        const cx = c * TILE + TILE / 2;
        const feet = rowTop(r + 1);
        if (tile === "o") {
          game.coins.push({ x: cx, y: rowTop(r) + TILE / 2, taken: false, phase: c * 0.7 });
        } else if (tile === "e") {
          game.enemies.push({ x: cx, y: feet, vx: -ENEMY_SPEED, vy: 0, grounded: true, awake: false, state: "walk", t: 0, walk: c });
        } else if (tile === "M") {
          // The two-tile lift shuttles across whatever is left of the pit it sits in.
          let gap = 0;
          while (c + gap < COLS && MAP[ROWS - 1][c + gap] !== "#") {
            gap += 1;
          }
          game.lifts.push({ x0: c * TILE, x: c * TILE, y: rowTop(r), w: TILE * 2, range: Math.max(0, gap - 2) * TILE, t: 0, dx: 0 });
        } else if (tile === "C") {
          Object.assign(game.checkpoint, { x: cx, y: feet, active: false, raise: 0 });
        } else if (tile === "G") {
          Object.assign(game.gate, { x: cx, y: feet });
        } else if (tile === "P") {
          Object.assign(game.start, { x: cx, y: feet });
        } else {
          return;
        }
        row[c] = ".";
      });
    });
    resetHero(game.start);
    game.lives = START_LIVES;
    showLives();
    game.camX = 0;
    game.camY = 0;
    game.look = LOOKAHEAD;
    game.jumpBuffer = 0;
    game.winT = -1;
    game.fireworkT = 0;
    game.quake = 0;
    game.playT = 0;
    game.bot.hold = 0;
    game.bot.bestX = 0;
    game.bot.stuckT = 0;
    releaseInput();
  };

  /* ---- rules */

  const stretch = (sx, sy) => {
    const k = reduceMotion ? 0.4 : 1;
    game.hero.sx = 1 + (sx - 1) * k;
    game.hero.sy = 1 + (sy - 1) * k;
  };

  const addCoins = (count, x, y) => {
    if (Shell.phase === "play") {
      setScore(Shell.score + count);
    }
    floatText(x, y, `+${count}`, PALETTE.coin);
  };

  // Particle speeds are authored for 16px tiles too.
  const spark = (x, y, color, count, speed) => burst(x, y, color, count, speed * S);

  const knockCritter = (e) => {
    e.state = "knocked";
    e.vy = -230 * S;
    e.vx = (Math.random() < 0.5 ? -1 : 1) * 45 * S;
    spark(e.x, e.y - 6 * S, PALETTE.bug, 8, 70);
    addCoins(1, e.x, e.y - 18 * S);
  };

  // Bumping a block from below also hits whatever stands or sits on it.
  const hitAbove = (c, r) => {
    const cx = c * TILE + TILE / 2;
    const top = rowTop(r);
    game.enemies.forEach((e) => {
      if (e.state === "walk" && e.grounded && Math.abs(e.y - top) < 1.5 * S && Math.abs(e.x - cx) < 14 * S) {
        knockCritter(e);
      }
    });
    game.coins.forEach((coin) => {
      if (!coin.taken && Math.abs(coin.x - cx) < 4 * S && Math.abs(coin.y - (top - TILE / 2)) < 4 * S) {
        coin.taken = true;
        game.pops.push({ x: coin.x, y: coin.y, vy: -200 * S, t: 0 });
        addCoins(1, coin.x, coin.y - 12 * S);
      }
    });
  };

  const bumpTile = (c, r) => {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) {
      return;
    }
    const tile = game.grid[r][c];
    const x = c * TILE + TILE / 2;
    const y = rowTop(r);
    hitAbove(c, r);
    if (tile === "B") {
      game.grid[r][c] = ".";
      for (let index = 0; index < 4 && game.debris.length < MAX_DEBRIS; index += 1) {
        const side = index % 2 ? 1 : -1;
        const upper = index < 2;
        game.debris.push({
          x: x + side * 4 * S,
          y: y + (upper ? 4 : 12) * S,
          vx: side * rand(40, 85) * S,
          vy: (upper ? -rand(260, 320) : -rand(150, 200)) * S,
          rot: 0,
          vr: rand(-12, 12),
          age: 0
        });
      }
      spark(x, y + 8 * S, PALETTE.brickLight, 8, 70);
      game.quake = 0.12;
    } else if (tile === "S") {
      game.grid[r][c] = "U";
      game.bumps.push({ c, r, t: 0 });
      game.pops.push({ x, y: y - 4 * S, vy: -240 * S, t: 0 });
      addCoins(1, x, y - 20 * S);
      spark(x, y, PALETTE.star, 10, 80);
    } else {
      if (tile === "U") {
        game.bumps.push({ c, r, t: 0 });
      }
      spark(x, y + TILE, PALETTE.dust, 4, 40);
    }
  };

  const hurtHero = (fell) => {
    const hero = game.hero;
    if (hero.dead || game.winT >= 0) {
      return;
    }
    hero.dead = true;
    hero.deadT = 0;
    hero.ride = null;
    hero.vx = 0;
    hero.vy = fell ? 0 : -260 * S;
    if (Shell.phase === "play") {
      game.lives -= 1;
      showLives();
      shake();
    }
    if (!fell) {
      spark(hero.x, hero.y - 8 * S, PALETTE.flag, 12, 90);
    }
  };

  const respawn = () => {
    const spot = game.checkpoint.active ? game.checkpoint : game.start;
    resetHero(spot);
    game.hero.invuln = INVULN_TIME;
    game.look = LOOKAHEAD;
    game.camX = clamp(spot.x - VIEW_MID + game.look, 0, LEVEL_W - WIDTH);
    game.camY = 0;
    game.jumpBuffer = 0;
    spark(spot.x, spot.y - 10 * S, PALETTE.star, 14, 70);
  };

  const stomp = (e, held) => {
    const hero = game.hero;
    e.state = "squash";
    e.t = 0;
    hero.y = e.y - ENEMY_H;
    hero.vy = -(held ? STOMP_BOUNCE_HELD : STOMP_BOUNCE);
    hero.coyote = 0;
    stretch(0.8, 1.22);
    spark(e.x, e.y - 5 * S, PALETTE.bug, 10, 80);
    addCoins(1, e.x, e.y - 20 * S);
    game.quake = 0.1;
  };

  const reachGate = () => {
    const gate = game.gate;
    game.winT = 0;
    game.fireworkT = 0;
    spark(gate.x, gate.y - 30 * S, PALETTE.star, 24, 120);
    floatText(gate.x, Math.max(gate.y - 64 * S, SAFE.y + 8), "GOAL!", PALETTE.star);
  };

  /* ---- physics */

  const pushOutX = (dx) => {
    const hero = game.hero;
    if (dx === 0) {
      return;
    }
    const r0 = rowAt(hero.y - HERO_H + 1);
    const r1 = rowAt(hero.y - 1);
    const c = colAt(dx > 0 ? hero.x + HERO_W / 2 : hero.x - HERO_W / 2);
    for (let r = r0; r <= r1; r += 1) {
      if (isSolid(c, r)) {
        hero.x = dx > 0 ? c * TILE - HERO_W / 2 - 0.01 : (c + 1) * TILE + HERO_W / 2 + 0.01;
        hero.vx = 0;
        return;
      }
    }
  };

  const landHero = (prevFeet, wasGrounded) => {
    const hero = game.hero;
    const r = rowAt(hero.y);
    const c0 = colAt(hero.x - HERO_W / 2 + 1);
    const c1 = colAt(hero.x + HERO_W / 2 - 1);
    let floor = null;
    for (let c = c0; c <= c1; c += 1) {
      if (floorAt(c, r, prevFeet)) {
        floor = rowTop(r);
      }
    }
    if (floor === null) {
      game.lifts.forEach((lift) => {
        if (hero.x + HERO_W / 2 - 1 > lift.x && hero.x - HERO_W / 2 + 1 < lift.x + lift.w && prevFeet <= lift.y + 0.5 && hero.y >= lift.y) {
          floor = lift.y;
          hero.ride = lift;
        }
      });
    }
    if (floor === null) {
      return;
    }
    if (!wasGrounded && hero.vy > 140 * S) {
      const impact = Math.min(1, hero.vy / MAX_FALL);
      stretch(1 + impact * 0.32, 1 - impact * 0.3);
      spark(hero.x, floor, PALETTE.dust, 4, 36);
    }
    hero.y = floor;
    hero.vy = 0;
    hero.grounded = true;
  };

  const bonkHead = () => {
    const hero = game.hero;
    const r = rowAt(hero.y - HERO_H);
    const left = hero.x - HERO_W / 2 + 1;
    const right = hero.x + HERO_W / 2 - 1;
    const cl = colAt(left);
    const cr = colAt(right);
    const hitL = isSolid(cl, r);
    const hitR = isSolid(cr, r);
    if (!hitL && !hitR) {
      return;
    }
    // Clipping a block's corner by a few pixels slides past it instead of stopping the jump.
    if (cl !== cr && hitL !== hitR) {
      const overlap = hitL ? (cl + 1) * TILE - left : right - cr * TILE;
      if (overlap <= CORNER_NUDGE) {
        hero.x += hitL ? overlap : -overlap;
        return;
      }
    }
    hero.y = rowTop(r + 1) + HERO_H;
    hero.vy = 0;
    const mid = colAt(hero.x);
    bumpTile(isSolid(mid, r) ? mid : (hitL ? cl : cr), r);
  };

  const touchEnemies = (prevFeet, held) => {
    const hero = game.hero;
    for (let index = 0; index < game.enemies.length; index += 1) {
      const e = game.enemies[index];
      if (hero.dead) {
        return;
      }
      if (e.state !== "walk" || !e.awake) {
        continue;
      }
      if (Math.abs(hero.x - e.x) >= (HERO_W + ENEMY_W) / 2 - 1 || hero.y <= e.y - ENEMY_H || hero.y - HERO_H >= e.y) {
        continue;
      }
      if (hero.vy > 0 && prevFeet <= e.y - ENEMY_H + 5 * S) {
        stomp(e, held);
      } else if (Shell.phase === "play" && hero.invuln <= 0 && game.winT < 0) {
        hurtHero(false);
      }
    }
  };

  const collectCoins = () => {
    const hero = game.hero;
    if (hero.dead) {
      return;
    }
    game.coins.forEach((coin) => {
      if (!coin.taken && Math.abs(coin.x - hero.x) < HERO_W / 2 + 5 * S && coin.y + 5 * S > hero.y - HERO_H && coin.y - 5 * S < hero.y) {
        coin.taken = true;
        addCoins(1, coin.x, coin.y - 8 * S);
        spark(coin.x, coin.y, PALETTE.coinLight, 6, 50);
      }
    });
  };

  const stepLifts = (h) => {
    game.lifts.forEach((lift) => {
      lift.t += h;
      const next = lift.x0 + ((1 - Math.cos((lift.t / LIFT_PERIOD) * TAU)) / 2) * lift.range;
      lift.dx = next - lift.x;
      lift.x = next;
    });
  };

  const stepHero = (h, input) => {
    const hero = game.hero;
    if (hero.dead) {
      hero.vy = Math.min(hero.vy + FALL_GRAVITY * h, MAX_FALL);
      hero.y += hero.vy * h;
      hero.spin += h * 7;
      return;
    }
    const locked = game.winT >= 0;
    const dir = locked ? 0 : input.x;
    const held = !locked && input.jump;

    if (dir !== 0) {
      const turning = hero.vx * dir < 0;
      const accel = (hero.grounded ? RUN_ACCEL : AIR_ACCEL) * (turning ? TURN_BOOST : 1);
      hero.vx = approach(hero.vx, dir * MAX_SPEED, accel * h);
      hero.face = dir;
    } else {
      hero.vx = approach(hero.vx, 0, (hero.grounded ? GROUND_FRICTION : AIR_DRAG) * h);
    }
    const dx = hero.vx * h + (hero.ride ? hero.ride.dx : 0);
    hero.x += dx;
    pushOutX(dx);

    hero.coyote = hero.grounded ? COYOTE_TIME : hero.coyote - h;
    game.jumpBuffer -= h;
    if (game.jumpBuffer > 0 && hero.coyote > 0 && !locked) {
      hero.vy = -JUMP_SPEED;
      hero.coyote = 0;
      game.jumpBuffer = 0;
      hero.grounded = false;
      stretch(0.76, 1.26);
      spark(hero.x, hero.y, PALETTE.dust, 5, 40);
    }

    const gravity = hero.vy < 0 ? (held ? GRAVITY : RELEASE_GRAVITY) : FALL_GRAVITY;
    hero.vy = Math.min(hero.vy + gravity * h, MAX_FALL);
    const prevFeet = hero.y;
    const wasGrounded = hero.grounded;
    hero.y += hero.vy * h;
    hero.grounded = false;
    hero.ride = null;
    if (hero.vy >= 0) {
      landHero(prevFeet, wasGrounded);
    } else {
      bonkHead();
    }
    touchEnemies(prevFeet, held);
    if (hero.y > MAP_BOTTOM + 20 * S) {
      hurtHero(true);
    }
  };

  const stepEnemies = (h) => {
    // Critters wake a fixed distance ahead of the hero (not of the view), so
    // encounters play out the same in every format.
    const wake = game.hero.x + 220 * S;
    game.enemies.forEach((e) => {
      if (e.state === "knocked") {
        e.vy += FALL_GRAVITY * h;
        e.x += e.vx * h;
        e.y += e.vy * h;
        if (e.y > MAP_BOTTOM + 30 * S) {
          e.state = "gone";
        }
        return;
      }
      if (e.state !== "walk") {
        return;
      }
      if (!e.awake) {
        if (e.x > wake) {
          return;
        }
        e.awake = true;
      }
      e.vy = Math.min(e.vy + FALL_GRAVITY * h, MAX_FALL);
      const prevFeet = e.y;
      e.y += e.vy * h;
      e.grounded = false;
      const r = rowAt(e.y);
      if (floorAt(colAt(e.x - 5 * S), r, prevFeet) || floorAt(colAt(e.x + 5 * S), r, prevFeet)) {
        e.y = rowTop(r);
        e.vy = 0;
        e.grounded = true;
      }
      e.x += e.vx * h;
      const front = colAt(e.x + (e.vx < 0 ? -1 : 1) * (ENEMY_W / 2));
      const below = rowAt(e.y + 1);
      const wall = isSolid(front, rowAt(e.y - 4 * S));
      const ledge = e.grounded && !isSolid(front, below) && !isPlank(front, below);
      if (wall || ledge) {
        e.x -= e.vx * h;
        e.vx = -e.vx;
      }
      if (e.y > MAP_BOTTOM + 30 * S) {
        e.state = "gone";
      }
    });
    // Critters sharing a stretch of ground turn back when they meet instead of overlapping.
    for (let i = 0; i < game.enemies.length; i += 1) {
      const a = game.enemies[i];
      for (let j = i + 1; j < game.enemies.length && a.state === "walk"; j += 1) {
        const b = game.enemies[j];
        if (b.state === "walk" && Math.abs(a.x - b.x) < ENEMY_W && Math.abs(a.y - b.y) < 4 * S && (b.x - a.x) * (a.vx - b.vx) > 0) {
          a.vx = -a.vx;
          b.vx = -b.vx;
        }
      }
    }
  };

  const stepEffects = (dt) => {
    const hero = game.hero;
    const ease = Math.min(1, dt * 12);
    hero.sx += (1 - hero.sx) * ease;
    hero.sy += (1 - hero.sy) * ease;
    if (hero.grounded) {
      hero.run += Math.abs(hero.vx) * dt * 0.21;
    }
    hero.blink -= dt;
    if (hero.blink < -0.12) {
      hero.blink = rand(1.8, 3.8);
    }
    hero.invuln = Math.max(0, hero.invuln - dt);
    if (hero.dead) {
      hero.deadT += dt;
    }

    game.enemies.forEach((e) => {
      e.walk += Math.abs(e.vx) * dt * 0.5;
      if (e.state === "squash") {
        e.t += dt;
        if (e.t > SQUASH_TIME) {
          e.state = "gone";
        }
      }
    });
    for (let index = game.bumps.length - 1; index >= 0; index -= 1) {
      game.bumps[index].t += dt;
      if (game.bumps[index].t > 0.18) {
        game.bumps.splice(index, 1);
      }
    }
    for (let index = game.pops.length - 1; index >= 0; index -= 1) {
      const pop = game.pops[index];
      pop.t += dt;
      pop.y += pop.vy * dt;
      pop.vy += 700 * S * dt;
      if (pop.t > 0.5) {
        spark(pop.x, pop.y, PALETTE.coinLight, 5, 40);
        game.pops.splice(index, 1);
      }
    }
    for (let index = game.debris.length - 1; index >= 0; index -= 1) {
      const d = game.debris[index];
      d.age += dt;
      d.vy += 900 * S * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      if (d.y > MAP_BOTTOM + 20 * S || d.age > 1.4) {
        game.debris.splice(index, 1);
      }
    }
    if (game.checkpoint.active) {
      game.checkpoint.raise = Math.min(1, game.checkpoint.raise + dt * 3);
    }
    game.quake = Math.max(0, game.quake - dt);

    if (game.winT >= 0) {
      game.winT += dt;
      game.fireworkT -= dt;
      if (game.fireworkT <= 0) {
        const colors = [PALETTE.star, PALETTE.flag, PALETTE.scarf, PALETTE.coin];
        game.fireworkT = 0.24;
        const x = game.camX + rand(SAFE.x + 20 * S, SAFE.x + SAFE.w - 20 * S);
        const y = game.camY + rand(SAFE.y + 10 * S, SAFE.y + SAFE.h * 0.45);
        spark(x, y, colors[Math.floor(Math.random() * colors.length)], 18, 110);
      }
      if (hero.grounded && !hero.dead && game.winT > 0.25) {
        hero.vy = -210 * S * LAYOUT.jump;
        hero.grounded = false;
        stretch(0.85, 1.18);
      }
    }
  };

  const stepCamera = (dt) => {
    const hero = game.hero;
    if (hero.dead) {
      return;
    }
    const lead = game.winT >= 0 ? 0 : hero.face * LOOKAHEAD;
    game.look += (lead - game.look) * Math.min(1, dt * 2.5);
    const target = clamp(hero.x - VIEW_MID + game.look, 0, LEVEL_W - WIDTH);
    game.camX += (target - game.camX) * Math.min(1, dt * 7);
    // The view only rises when the hero's head would leave the top of the play area.
    const lift = Math.min(0, hero.y - HERO_H - (SAFE.y + 4 * S));
    game.camY += (lift - game.camY) * Math.min(1, dt * 10);
  };

  const stepWorld = (dt, input) => {
    const hero = game.hero;
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
    const h = dt / steps;
    for (let index = 0; index < steps; index += 1) {
      stepLifts(h);
      stepHero(h, input);
      stepEnemies(h);
      collectCoins();
    }
    if (!hero.dead) {
      const cp = game.checkpoint;
      if (!cp.active && hero.x >= cp.x) {
        cp.active = true;
        spark(cp.x + 6 * S, cp.y - 28 * S, PALETTE.flag, 14, 80);
        floatText(cp.x, Math.max(cp.y - 44 * S, SAFE.y + 8), "CHECKPOINT", PALETTE.text);
      }
      if (game.winT < 0 && hero.x >= game.gate.x - 2) {
        reachGate();
      }
    }
    stepEffects(dt);
    stepCamera(dt);
  };

  const readInput = () => {
    let left = keys.left;
    let right = keys.right;
    let jump = keys.jump;
    touches.forEach((zone) => {
      if (zone === "left") {
        left = true;
      } else if (zone === "right") {
        right = true;
      } else if (zone === "jump") {
        jump = true;
      }
    });
    const input = game.input;
    input.left = left;
    input.right = right;
    input.jump = jump;
    // The strip runs by itself; holding left only brakes.
    input.x = LAYOUT.autoRun ? (left ? 0 : 1) : (right ? 1 : 0) - (left ? 1 : 0);
    return input;
  };

  // Attract-mode pilot: runs right and hops pits, walls and critters.
  const botInput = (dt) => {
    const hero = game.hero;
    const bot = game.bot;
    if (hero.dead || game.winT >= 0) {
      return NO_INPUT;
    }
    if (hero.x > bot.bestX + 1) {
      bot.bestX = hero.x;
      bot.stuckT = 0;
    } else {
      bot.stuckT += dt;
    }
    if (hero.grounded && bot.hold <= 0) {
      const probe = colAt(hero.x + HERO_W / 2 + 6 * S);
      const pit = !hasFloorBelow(colAt(hero.x + 2 * S), rowAt(hero.y + 1));
      const wall = isSolid(probe, rowAt(hero.y - 3 * S)) || isSolid(probe, rowAt(hero.y - HERO_H + 2 * S));
      const critter = game.enemies.some((e) => e.state === "walk" && e.x > hero.x && e.x - hero.x < 44 * S && Math.abs(e.y - hero.y) < 20 * S);
      if (pit || wall || critter || bot.stuckT > 1) {
        game.jumpBuffer = JUMP_BUFFER;
        bot.hold = 0.34;
      }
    }
    bot.hold -= dt;
    bot.input.jump = bot.hold > 0;
    return bot.input;
  };

  // Runs only in the play phase.
  const update = (dt) => {
    // The shell's own time-out compares score to goal; here the win is the gate, so decide first.
    if (Shell.elapsed >= CONFIG.maxPlayMs) {
      endGame(game.winT >= 0);
      return;
    }
    game.playT += dt;
    stepWorld(dt, readInput());
    const hero = game.hero;
    if (hero.dead && hero.deadT >= RESPAWN_DELAY) {
      if (game.lives <= 0) {
        endGame(false);
      } else {
        respawn();
      }
    } else if (game.winT >= CELEBRATE_TIME) {
      endGame(true);
    }
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    if (Shell.phase !== "intro") {
      stepWorld(dt, NO_INPUT);
      return;
    }
    stepWorld(dt, botInput(dt));
    const hero = game.hero;
    if ((hero.dead && hero.deadT >= RESPAWN_DELAY) || game.winT >= CELEBRATE_TIME || game.bot.stuckT > 5) {
      resetGame();
    }
  };

  /* ---- drawing */

  const tri = (x1, y1, x2, y2, x3, y3) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  };

  const dot = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };

  const oval = (x, y, rx, ry, rot = 0) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
  };

  const pill = (x, y, w, h) => {
    const r = h / 2;
    ctx.beginPath();
    ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
  };

  // Layers keep their painted height; a raised view (camY < 0) pushes them down.
  const drawStrip = (layer, offset, top, height) => {
    for (let x = -(((offset % STRIP_W) + STRIP_W) % STRIP_W); x < WIDTH; x += STRIP_W) {
      ctx.drawImage(layer, x, top, STRIP_W, height);
    }
  };

  const drawBackdrop = (cam, time) => {
    ctx.drawImage(ART.sky, 0, 0, WIDTH, HEIGHT);
    drawStrip(ART.far, cam * 0.15, FAR_TOP - game.camY * 0.3, HEIGHT - FAR_TOP);
    const loop = 900 * BG;
    CLOUDS.forEach((cloud) => {
      const x = ((((cloud.x - cam * 0.3 - time * 5 * BG) % loop) + loop) % loop) - 120 * BG;
      if (x < WIDTH) {
        ctx.drawImage(ART.cloud, x, cloud.y - game.camY * 0.15, 64 * cloud.s, 30 * cloud.s);
      }
    });
    drawStrip(ART.near, cam * 0.45, NEAR_TOP - game.camY * 0.5, HEIGHT - NEAR_TOP);
  };

  const bumpLift = (c, r) => {
    for (let index = 0; index < game.bumps.length; index += 1) {
      const bump = game.bumps[index];
      if (bump.c === c && bump.r === r) {
        return Math.sin(Math.min(1, bump.t / 0.18) * Math.PI) * 4 * S;
      }
    }
    return 0;
  };

  const drawTiles = (cam, time) => {
    const c0 = Math.max(0, colAt(cam));
    const c1 = Math.min(COLS - 1, colAt(cam + WIDTH));
    const glow = 0.75 + Math.sin(time * 5) * 0.25;
    const bottom = game.grid[ROWS - 1];
    const pitTop = rowTop(GROUND_ROW) - 6 * S;
    ctx.fillStyle = PIT_FADE;
    for (let c = c0; c <= c1; c += 1) {
      if (bottom[c] === ".") {
        ctx.fillRect(c * TILE - cam, pitTop, TILE, MAP_BOTTOM - pitTop);
      }
    }
    const edge = 2 * S;
    const lip = 4 * S;
    for (let r = 0; r < ROWS; r += 1) {
      const row = game.grid[r];
      const y = rowTop(r);
      for (let c = c0; c <= c1; c += 1) {
        const tile = row[c];
        if (tile === ".") {
          continue;
        }
        const x = c * TILE - cam;
        if (tile === "#") {
          const top = r === 0 || game.grid[r - 1][c] !== "#";
          ctx.drawImage(top ? ART.grass : ART.dirt, x, y, TILE, TILE);
          ctx.fillStyle = "rgba(70, 30, 8, 0.4)";
          if (c > 0 && row[c - 1] !== "#") {
            ctx.fillRect(x, y + (top ? lip : 0), edge, TILE - (top ? lip : 0));
          }
          if (c < COLS - 1 && row[c + 1] !== "#") {
            ctx.fillRect(x + TILE - edge, y + (top ? lip : 0), edge, TILE - (top ? lip : 0));
          }
        } else if (tile === "-") {
          ctx.drawImage(ART.plank, x, y, TILE, 8 * S);
        } else {
          const by = y - bumpLift(c, r);
          if (tile === "X") {
            ctx.drawImage(ART.stone, x, by, TILE, TILE);
          } else if (tile === "B") {
            ctx.drawImage(ART.brick, x, by, TILE, TILE);
          } else if (tile === "U") {
            ctx.drawImage(ART.used, x, by, TILE, TILE);
          } else if (tile === "S") {
            ctx.drawImage(ART.crate, x, by, TILE, TILE);
            ctx.globalAlpha = glow;
            ctx.fillStyle = PALETTE.star;
            starPath(ctx, x + 8 * S, by + 8.4 * S, 5.2 * S, 2.3 * S);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = PALETTE.crateDark;
            ctx.lineWidth = 0.8 * S;
            ctx.stroke();
          }
        }
      }
    }
  };

  // Props below are drawn in design units around their base point.
  const drawCheckpoint = (cam, time) => {
    const cp = game.checkpoint;
    const sx = cp.x - cam;
    if (sx < -20 * S || sx > WIDTH + 20 * S) {
      return;
    }
    ctx.save();
    ctx.translate(sx, cp.y);
    ctx.scale(S, S);
    const x = 0;
    const y = 0;
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(x - 4, y - 3, 8, 3);
    ctx.fillStyle = "#eef2f9";
    ctx.fillRect(x - 1, y - 34, 2, 31);
    ctx.fillStyle = cp.active ? PALETTE.star : "#c3cad8";
    dot(x, y - 35, 2.2);
    const fy = y - 13 - cp.raise * 18;
    const wave = Math.sin(time * 7) * (cp.active ? 1.6 : 0.4);
    ctx.fillStyle = cp.active ? PALETTE.flag : "#9aa3b5";
    ctx.beginPath();
    ctx.moveTo(x + 1, fy);
    ctx.quadraticCurveTo(x + 7, fy + wave, x + 14, fy + 4 + wave);
    ctx.quadraticCurveTo(x + 7, fy + 7 - wave, x + 1, fy + 9);
    ctx.closePath();
    ctx.fill();
    if (cp.active) {
      ctx.fillStyle = PALETTE.star;
      starPath(ctx, x + 6, fy + 4.4, 2.4, 1);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawGate = (cam, time) => {
    const gate = game.gate;
    const sx = gate.x - cam;
    if (sx < -60 * S || sx > WIDTH + 60 * S) {
      return;
    }
    ctx.save();
    ctx.translate(sx, gate.y);
    ctx.scale(S, S);
    const x = 0;
    const y = 0;
    const pulse = 0.85 + Math.sin(time * 4) * 0.15;
    const glow = ctx.createRadialGradient(x, y - 26, 2, x, y - 26, 32);
    glow.addColorStop(0, "rgba(255, 252, 214, 0.95)");
    glow.addColorStop(0.5, `rgba(255, 214, 90, ${0.55 * pulse})`);
    glow.addColorStop(1, "rgba(255, 214, 90, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x - 13, y - 33);
    ctx.arc(x, y - 33, 13, Math.PI, 0);
    ctx.lineTo(x + 13, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    for (let index = 0; index < 6; index += 1) {
      const angle = time * 2 + index * 1.05;
      const px = x + Math.cos(angle) * 8;
      const py = y - 24 + Math.sin(angle * 1.3) * 12;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 6 + index);
      ctx.fillRect(px - 0.8, py - 0.8, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    [-1, 1].forEach((side) => {
      const px = x + side * 17;
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(px - 4.5, y - 35, 9, 35);
      ctx.fillStyle = PALETTE.stone;
      ctx.fillRect(px - 3.5, y - 35, 7, 35);
      ctx.fillStyle = PALETTE.stoneLight;
      ctx.fillRect(px - 3.5, y - 35, 2, 35);
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(px - 6, y - 38, 12, 4);
      ctx.fillRect(px - 5.5, y - 4, 11, 4);
    });
    ctx.lineCap = "butt";
    ctx.strokeStyle = PALETTE.stoneDark;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y - 36, 17, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.stone;
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ctx.translate(x, y - 55);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = PALETTE.star;
    starPath(ctx, 0, 0, 7, 3);
    ctx.fill();
    ctx.strokeStyle = PALETTE.coinDark;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  const drawCoin = (sx, sy, time, phase) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(S, S);
    const x = 0;
    const y = 0;
    const spin = Math.abs(Math.cos(time * 3.2 + phase));
    const rx = Math.max(0.8, 5 * spin);
    ctx.fillStyle = PALETTE.coinDark;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, 5.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.coin;
    ctx.beginPath();
    ctx.ellipse(x - spin * 0.4, y - 0.3, Math.max(0.5, rx - 1.3), 4.3, 0, 0, TAU);
    ctx.fill();
    if (spin > 0.35) {
      ctx.fillStyle = PALETTE.coinLight;
      ctx.fillRect(x - rx * 0.45, y - 3, Math.max(0.6, rx * 0.3), 4.5);
    }
    ctx.restore();
  };

  const drawCoins = (cam, time) => {
    game.coins.forEach((coin) => {
      const x = coin.x - cam;
      if (!coin.taken && x > -8 * S && x < WIDTH + 8 * S) {
        drawCoin(x, coin.y + Math.sin(time * 3 + coin.phase) * 1.2 * S, time, coin.phase);
      }
    });
    game.pops.forEach((pop) => {
      ctx.globalAlpha = clamp(1 - (pop.t - 0.3) / 0.2, 0, 1);
      drawCoin(pop.x - cam, pop.y, time * 3, 0);
    });
    ctx.globalAlpha = 1;
  };

  const drawLifts = (cam, time) => {
    game.lifts.forEach((lift) => {
      const sx = lift.x - cam;
      if (sx < -lift.w - 8 * S || sx > WIDTH + 8 * S) {
        return;
      }
      ctx.save();
      ctx.translate(sx, lift.y);
      ctx.scale(S, S);
      const w = lift.w / S;
      const flick = 3 + Math.sin(time * 38) * 1.2;
      [8, w - 8].forEach((fx) => {
        ctx.fillStyle = PALETTE.flame;
        tri(fx - 3, 7, fx, 7 + flick * 1.6, fx + 3, 7);
        ctx.fillStyle = PALETTE.star;
        tri(fx - 1.5, 7, fx, 7 + flick * 0.8, fx + 1.5, 7);
      });
      ctx.fillStyle = PALETTE.liftDark;
      ctx.fillRect(0, 0, w, 7);
      ctx.fillStyle = PALETTE.lift;
      ctx.fillRect(1, 0, w - 2, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(1, 0, w - 2, 1);
      ctx.fillStyle = PALETTE.accent;
      for (let index = 0; index < 4; index += 1) {
        ctx.fillRect(4 + index * 7, 4.5, 3, 1.5);
      }
      ctx.restore();
    });
  };

  const drawCritter = (e, cam, time) => {
    const x = e.x - cam;
    if (e.state === "gone" || x < -20 * S || x > WIDTH + 20 * S) {
      return;
    }
    ctx.save();
    ctx.translate(x, e.y);
    ctx.scale(S, S);
    if (e.state === "squash") {
      ctx.globalAlpha = clamp(1 - (e.t - 0.25) / (SQUASH_TIME - 0.25), 0, 1);
      ctx.fillStyle = PALETTE.bugDark;
      oval(0, -2, 9, 2.8);
      ctx.fillStyle = PALETTE.bug;
      oval(0, -2.7, 8, 1.9);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      [-2.6, 2.6].forEach((ex) => {
        ctx.moveTo(ex - 1.1, -3.8);
        ctx.lineTo(ex + 1.1, -1.6);
        ctx.moveTo(ex + 1.1, -3.8);
        ctx.lineTo(ex - 1.1, -1.6);
      });
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (e.state === "knocked") {
      ctx.translate(0, -6);
      ctx.scale(1, -1);
      ctx.translate(0, 6);
    } else {
      ctx.fillStyle = "rgba(30, 20, 10, 0.22)";
      oval(0, 0, 7.5, 1.6);
    }
    ctx.scale(e.vx < 0 ? -1 : 1, 1);
    const bob = -Math.abs(Math.sin(e.walk)) * 0.8;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    [[-4.5, 0], [0, Math.PI], [4.5, 0]].forEach(([lx, phase]) => {
      const step = Math.sin(e.walk + phase) * 1.6;
      ctx.moveTo(lx, -3);
      ctx.lineTo(lx + step, -0.4);
    });
    ctx.stroke();
    ctx.fillStyle = PALETTE.bugDark;
    ctx.beginPath();
    ctx.ellipse(0, -3 + bob, 8, 8.5, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.bug;
    ctx.beginPath();
    ctx.ellipse(-0.6, -3.6 + bob, 6.9, 7.4, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.bugBelly;
    ctx.fillRect(-7.6, -4 + bob, 15.2, 2.4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    oval(-3, -8.6 + bob, 2.6, 1.3, -0.5);
    ctx.fillStyle = PALETTE.bugSpot;
    ctx.beginPath();
    blob(ctx, 1.2, -8.4 + bob, 1.2);
    blob(ctx, -4.4, -5.4 + bob, 1);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    blob(ctx, 3.6, -6.4 + bob, 1.9);
    blob(ctx, 6.6, -6 + bob, 1.6);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    blob(ctx, 4.2, -6.2 + bob, 0.9);
    blob(ctx, 7, -5.8 + bob, 0.8);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, -9 + bob);
    ctx.lineTo(5, -7.9 + bob);
    ctx.moveTo(5.6, -8 + bob);
    ctx.lineTo(8, -8.6 + bob);
    ctx.moveTo(2.6, -10.6 + bob);
    ctx.quadraticCurveTo(3.4, -14 + bob, 6.4, -14.4 + Math.sin(time * 9 + e.walk) * 0.6 + bob);
    ctx.stroke();
    ctx.fillStyle = PALETTE.bugSpot;
    dot(6.4, -14.4 + Math.sin(time * 9 + e.walk) * 0.6 + bob, 1.1);
    ctx.restore();
  };

  const drawLeg = (hipX, bob, angle, color) => {
    const footX = hipX + Math.sin(angle) * 4.2;
    const footY = -4 + Math.cos(angle) * 4.2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hipX, -4.2 + bob);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    oval(footX + 0.7, footY, 1.6, 1);
  };

  const drawShadow = (x, feet, cam) => {
    const c = colAt(x);
    const reach = 70 * S;
    for (let r = Math.max(0, rowAt(feet)); r < ROWS; r += 1) {
      if (isSolid(c, r) || isPlank(c, r)) {
        const gap = rowTop(r) - feet;
        if (gap > reach) {
          return;
        }
        const k = 1 - Math.max(0, gap) / reach;
        ctx.globalAlpha = 0.28 * k;
        ctx.fillStyle = "#1e140a";
        ctx.beginPath();
        ctx.ellipse(x - cam, rowTop(r), 6.5 * S * (0.5 + 0.5 * k), 1.8 * S * (0.5 + 0.5 * k), 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        return;
      }
    }
  };

  const drawHero = (cam, time) => {
    const hero = game.hero;
    if (hero.y > MAP_BOTTOM + 60 * S) {
      return;
    }
    if (!hero.dead) {
      drawShadow(hero.x, hero.y, cam);
    }
    let alpha = 1;
    if (hero.invuln > 0) {
      alpha = reduceMotion || Math.floor(hero.invuln * 14) % 2 === 0 ? 0.55 : 0.2;
    }
    const speed = Math.min(1, Math.abs(hero.vx) / MAX_SPEED);
    const air = !hero.grounded && !hero.dead;
    const swing = hero.grounded ? Math.sin(hero.run) * 0.95 * speed : 0;
    const bob = hero.grounded ? -Math.abs(Math.sin(hero.run)) * 1.3 * speed + Math.sin(time * 2.6) * 0.35 * (1 - speed) : 0;
    const cheer = game.winT >= 0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(hero.x - cam, hero.y);
    ctx.scale(S, S);
    if (hero.dead) {
      ctx.translate(0, -9);
      ctx.rotate(hero.spin * hero.face);
      ctx.translate(0, 9);
    }
    ctx.scale(hero.face * hero.sx, hero.sy);

    const sway = Math.sin(time * 7 + hero.run * 0.5) * (1 + speed * 1.6);
    ctx.fillStyle = PALETTE.fox;
    ctx.beginPath();
    ctx.moveTo(-3, -4.5 + bob);
    ctx.quadraticCurveTo(-10.5, -3.5 + bob, -12, -10.5 + sway + bob);
    ctx.quadraticCurveTo(-7, -10.5 + bob, -2.5, -8 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.cream;
    dot(-11.4, -10.2 + sway + bob, 2);

    const backAngle = air ? (hero.vy < 0 ? 0.8 : 0.4) : swing;
    const frontAngle = air ? (hero.vy < 0 ? -1 : -0.45) : -swing;
    drawLeg(-1.6, bob, backAngle, PALETTE.foxDark);
    ctx.fillStyle = PALETTE.fox;
    oval(0.4, -6.6 + bob, 5, 4.3);
    ctx.fillStyle = PALETTE.cream;
    oval(2.1, -5.9 + bob, 2.7, 2.6);
    drawLeg(2, bob, frontAngle, PALETTE.fox);

    const armAngle = cheer || (air && hero.vy < 0) ? 2.4 : (air ? 1.2 : -frontAngle * 0.8 + 0.15);
    const armX = 2.6 + Math.sin(armAngle) * 3.4;
    const armY = -8.2 + bob + Math.cos(armAngle) * 3.4;
    ctx.strokeStyle = PALETTE.foxDark;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(2.6, -8.2 + bob);
    ctx.lineTo(armX, armY);
    ctx.stroke();
    ctx.fillStyle = PALETTE.cream;
    dot(armX, armY, 1);

    const flap = Math.sin(time * 15) * (0.6 + speed * 1.3);
    ctx.fillStyle = PALETTE.scarfDark;
    ctx.beginPath();
    ctx.moveTo(-1.4, -10.3 + bob);
    ctx.quadraticCurveTo(-5, -10.6 + flap + bob, -8.5 - speed * 2, -8.6 + flap * 1.5 + bob);
    ctx.lineTo(-7.4 - speed * 2, -6.8 + flap + bob);
    ctx.quadraticCurveTo(-4.4, -8.2 + bob, -1, -8.4 + bob);
    ctx.closePath();
    ctx.fill();

    const hy = -13 + bob;
    ctx.fillStyle = PALETTE.foxDark;
    tri(-0.6, hy - 2.6, -1.4, hy - 8, 2.6, hy - 3.8);
    ctx.fillStyle = PALETTE.fox;
    dot(2.6, hy, 4.4);
    tri(3, hy - 3.6, 5.2, hy - 8.4, 6.6, hy - 2.6);
    ctx.fillStyle = PALETTE.ink;
    tri(4, hy - 3.8, 5.2, hy - 6.8, 6, hy - 3.2);
    ctx.fillStyle = PALETTE.cream;
    ctx.beginPath();
    ctx.moveTo(3.4, hy - 0.4);
    ctx.quadraticCurveTo(6.8, hy - 1.8, 9.2, hy + 0.8);
    ctx.quadraticCurveTo(6.6, hy + 3.4, 2.6, hy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    dot(9, hy + 0.6, 1);
    ctx.fillStyle = "rgba(255, 110, 110, 0.45)";
    oval(4.2, hy + 1.8, 1.2, 0.7);
    if (hero.dead) {
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(4.2, hy - 2.6);
      ctx.lineTo(6.2, hy - 0.6);
      ctx.moveTo(6.2, hy - 2.6);
      ctx.lineTo(4.2, hy - 0.6);
      ctx.stroke();
    } else if (hero.blink < 0) {
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(4.2, hy - 1.3);
      ctx.lineTo(6.4, hy - 1.3);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffffff";
      oval(5.2, hy - 1.5, 1.3, 1.6);
      ctx.fillStyle = PALETTE.ink;
      dot(5.6, hy - 1.4, 0.85);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(5.7, hy - 2.3, 0.6, 0.6);
    }
    ctx.fillStyle = PALETTE.scarf;
    oval(1.4, -8.9 + bob, 4.3, 1.5, -0.12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fillRect(-1.2, -10 + bob, 4, 0.7);
    ctx.restore();
  };

  const drawDebris = (cam) => {
    game.debris.forEach((d) => {
      ctx.save();
      ctx.translate(d.x - cam, d.y);
      ctx.rotate(d.rot);
      ctx.scale(S, S);
      ctx.fillStyle = PALETTE.brick;
      ctx.fillRect(-3, -2.5, 6, 5);
      ctx.fillStyle = PALETTE.brickLight;
      ctx.fillRect(-3, -2.5, 6, 1);
      ctx.restore();
    });
  };

  const drawHint = () => {
    if (game.playT > HINT_TIME) {
      return;
    }
    const hint = LAYOUT.hint;
    ctx.globalAlpha = Math.min(1, (HINT_TIME - game.playT) / 0.5);
    ctx.font = `900 ${hint.size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = Math.min(SAFE.w - 8, ctx.measureText(hint.text).width + hint.size * 2);
    const h = hint.size * 1.8;
    ctx.fillStyle = "rgba(9, 26, 52, 0.6)";
    pill(VIEW_MID - w / 2, hint.y - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(hint.text, VIEW_MID, hint.y + 0.5);
    ctx.globalAlpha = 1;
  };

  // Buttons are drawn at radius 20 design units and scaled to the format's pad size.
  const drawPad = (pad, pressed, kind) => {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    const s = (pressed ? 0.9 : 1) * (pad.r / 20);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(10, 20, 40, 0.3)";
    ctx.beginPath();
    ctx.arc(0, 1.5, 20, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pressed ? "rgba(255, 196, 90, 0.62)" : "rgba(255, 255, 255, 0.24)";
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pressed ? PALETTE.accent : "rgba(255, 255, 255, 0.65)";
    ctx.stroke();
    ctx.fillStyle = pressed ? "#3a1800" : "rgba(255, 255, 255, 0.95)";
    if (kind === "jump") {
      tri(0, -11, 8, -2, -8, -2);
      // Keep the label at least 7 served px tall however small the button is.
      ctx.font = `900 ${Math.max(7.5, 7 / s)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("JUMP", 0, 8);
    } else {
      const d = kind === "left" ? -1 : 1;
      tri(7 * d, 0, -5 * d, -8, -5 * d, 8);
    }
    ctx.restore();
  };

  const draw = (time) => {
    const cam = Math.round(game.camX * DPR) / DPR;
    const camY = Math.round(game.camY * DPR) / DPR;
    let qx = 0;
    let qy = 0;
    if (game.quake > 0 && !reduceMotion) {
      qx = Math.round(rand(-1.5, 1.5) * S * DPR) / DPR;
      qy = Math.round(rand(-1.5, 1.5) * S * DPR) / DPR;
    }
    drawBackdrop(cam, time);
    ctx.save();
    ctx.translate(qx, qy - camY);
    drawTiles(cam, time);
    drawCheckpoint(cam, time);
    drawGate(cam, time);
    drawCoins(cam, time);
    drawLifts(cam, time);
    game.enemies.forEach((e) => drawCritter(e, cam, time));
    drawHero(cam, time);
    drawDebris(cam);
    ctx.translate(-cam, 0);
    drawFx();
    ctx.restore();
    if (Shell.phase === "play") {
      drawHint();
      const pads = LAYOUT.pads;
      if (pads) {
        const input = game.input;
        drawPad(pads.left, input.left, "left");
        drawPad(pads.right, input.right, "right");
        drawPad(pads.jump, input.jump, "jump");
      }
    }
  };

  // Touch zones are larger than the drawn buttons so thumbs never miss; the
  // strip has no arrows, so every touch there is a jump.
  const zoneAt = (point) => {
    const zone = LAYOUT.zone;
    if (zone && point.y >= zone.top && point.x < zone.split) {
      return "left";
    }
    if (zone && point.y >= zone.top && point.x < zone.right) {
      return "right";
    }
    return "jump";
  };

  const onPointerDown = (point, event) => {
    const zone = zoneAt(point);
    touches.set(event ? event.pointerId : 0, zone);
    if (zone === "jump") {
      game.jumpBuffer = JUMP_BUFFER;
    }
  };

  // A thumb sliding between the arrows switches direction; it never turns into a jump.
  const onPointerMove = (point, event) => {
    const id = event ? event.pointerId : 0;
    const zone = touches.get(id);
    if (zone === undefined || zone === "jump") {
      return;
    }
    const next = zoneAt(point);
    touches.set(id, next === "jump" ? "" : next);
  };

  const onPointerUp = (point, event) => {
    touches.delete(event ? event.pointerId : 0);
  };

  const onKey = (key, down) => {
    const action = KEYMAP[key];
    if (!action) {
      return false;
    }
    if (action === "jump" && down && !keys.jump) {
      game.jumpBuffer = JUMP_BUFFER;
    }
    keys[action] = down;
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
    endEyebrow.textContent = `${CONFIG.scoreLabel} ${Shell.score}`;
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

  // Keys released while the ad is unfocused never arrive; drop held input so the hero doesn't run on.
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
    goalValue.textContent = `/ ${CONFIG.goal}`;
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
