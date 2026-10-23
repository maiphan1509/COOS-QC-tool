(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-snake",              // CustomEvent namespace
    api: "mgSnake",                       // window.<api> handle
    campaign: "volta-v2",
    offer: "−30%",
    winTitle: "Feast mode!",
    loseTitle: "So close!",
    goal: 12,                             // food eaten that counts as a win
    maxPlayMs: 50000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    bgTop: "#071713",
    bgBottom: "#020605",
    board: "rgba(18, 56, 46, 0.32)",
    checker: "rgba(255, 255, 255, 0.022)",
    dot: "rgba(57, 255, 159, 0.16)",
    border: "#39ff9f",
    borderGlow: "rgba(57, 255, 159, 0.16)",
    snakeGlow: "#39ffb0",
    eyeWhite: "#f4fff9",
    pupil: "#04130e",
    tongue: "#ff3b7a",
    food: "#ff3bd4",
    foodCore: "#ffd9f7",
    foodGlow: "rgba(255, 59, 212, 0.22)",
    leaf: "#39ff9f",
    bonus: "#ffd23f",
    bonusGlow: "rgba(255, 210, 63, 0.24)",
    dead: "#ff4d6d",
    hintBg: "rgba(3, 11, 9, 0.66)",
    text: "#eafff4"
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

  // Per-format board: popup 20x15, a tall 9x19 column for the rail and a wide
  // 36x5 corridor for the strip. Step times are s per cell (faster per bite).
  const LAYOUT = {
    popup: {
      cell: 14, cols: 20, rows: 15, start: { x: 6, y: 7, dir: "right" },
      step: { start: 0.16, min: 0.095, drop: 0.005 }, swipe: 16,
      hint: "SWIPE · ARROWS · TAP A SIDE TO TURN", hintFont: 9
    },
    rail: {
      cell: 10, cols: 9, rows: 19, start: { x: 4, y: 13, dir: "up" },
      step: { start: 0.17, min: 0.1, drop: 0.005 }, swipe: 12,
      hint: "SWIPE TO TURN", hintFont: 7.5
    },
    strip: {
      cell: 9, cols: 36, rows: 5, start: { x: 6, y: 2, dir: "right" },
      step: { start: 0.13, min: 0.08, drop: 0.004 }, swipe: 10,
      hint: "SWIPE · ARROWS · TAP ABOVE / BELOW", hintFont: 7.5
    }
  }[FORMAT];

  const TAU = Math.PI * 2;
  const CELL = LAYOUT.cell;
  const COLS = LAYOUT.cols;
  const ROWS = LAYOUT.rows;
  const SC = CELL / 14;                     // art is authored for 14 px cells
  const BOARD = {
    x: SAFE.x + (SAFE.w - COLS * CELL) / 2,
    y: SAFE.y + (SAFE.h - ROWS * CELL) / 2
  };
  const START = { x: LAYOUT.start.x, y: LAYOUT.start.y, dir: LAYOUT.start.dir, length: 4 };
  const STEP = LAYOUT.step;
  const START_DELAY = 0.6;                  // s before the first move
  const QUEUE_MAX = 2;                      // buffered turns, so quick double swipes land
  const SWIPE_MIN = LAYOUT.swipe;           // px of drag before a swipe commits
  const BONUS = { life: 5, every: 3, chance: 0.7, value: 2 };
  const HEAD_W = 11 * SC;
  const TAIL_W = 3.5 * SC;
  const GULP_W = 4 * SC;
  const DEATH_HOLD = 0.22;                  // s the crash pose holds before dissolving
  const DISSOLVE = 0.7;
  const DEATH_TIME = 1.25;
  const WIN_DELAY = 0.45;
  const DEMO_MAX = 20;
  const HINT_MS = 6000;
  const FX = Math.max(0.6, SC);             // particle speed scale

  const DIRS = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }
  };
  const DIR_NAMES = ["up", "right", "down", "left"];
  const KEY_DIRS = {
    ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left",
    w: "up", d: "right", s: "down", a: "left",
    W: "up", D: "right", S: "down", A: "left"
  };

  const makeCanvas = (w, h, paint) => {
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(w * DPR);
    layer.height = Math.ceil(h * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    paint(g, w, h);
    return layer;
  };

  const roundPath = (g, x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  const boardPath = (g, pad) => {
    roundPath(g, BOARD.x - pad, BOARD.y - pad, COLS * CELL + pad * 2, ROWS * CELL + pad * 2, 5 * SC + pad);
  };

  const boardLayer = makeCanvas(WIDTH, HEIGHT, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, PALETTE.bgTop);
    bg.addColorStop(1, PALETTE.bgBottom);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    g.fillStyle = PALETTE.board;
    boardPath(g, 2);
    g.fill();
    g.fillStyle = PALETTE.checker;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = (row % 2); col < COLS; col += 2) {
        g.fillRect(BOARD.x + col * CELL, BOARD.y + row * CELL, CELL, CELL);
      }
    }
    const dot = Math.max(0.8, 1.2 * SC);
    g.fillStyle = PALETTE.dot;
    for (let row = 1; row < ROWS; row += 1) {
      for (let col = 1; col < COLS; col += 1) {
        g.fillRect(BOARD.x + col * CELL - dot / 2, BOARD.y + row * CELL - dot / 2, dot, dot);
      }
    }

    const reach = Math.max(w, h) * 0.67;
    const vignette = g.createRadialGradient(w / 2, h / 2, reach * 0.3, w / 2, h / 2, reach);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
    g.fillStyle = vignette;
    g.fillRect(0, 0, w, h);

    g.strokeStyle = PALETTE.borderGlow;
    g.lineWidth = 8 * SC;
    boardPath(g, 2);
    g.stroke();
    g.lineWidth = 4 * SC;
    g.stroke();
    g.strokeStyle = PALETTE.border;
    g.lineWidth = Math.max(1, 1.6 * SC);
    g.stroke();
  });

  const game = {
    mode: "demo",     // demo | run | dead | won
    t: 0,
    cells: [],        // grid cells, head first
    prev: [],         // cells before the last step, for interpolation
    dir: START.dir,
    queue: [],
    grow: 0,
    stepT: 0,
    p: 0,             // progress between the last step and the next (0..1)
    eaten: 0,
    food: null,
    bonus: null,
    gulps: [],
    deadT: 0,
    popped: 0,
    endT: 0,
    flash: 0,
    blink: 0,
    blinkIn: 2,
    tongue: 0,
    tongueIn: 1.5,
    turned: false,
    pointer: { active: false, id: null, x: 0, y: 0, swiped: false }
  };

  const cellX = (col) => BOARD.x + col * CELL + CELL / 2;
  const cellY = (row) => BOARD.y + row * CELL + CELL / 2;
  const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

  const stepInterval = () => Math.max(STEP.min, STEP.start - game.eaten * STEP.drop);

  const textAt = (x, y, text, color) => {
    floatText(clamp(x, SAFE.x + 24, SAFE.x + SAFE.w - 24), Math.max(SAFE.y + 10, y), text, color);
  };

  const isBlocked = (x, y, ignoreTail) => {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) {
      return true;
    }
    const end = ignoreTail ? game.cells.length - 1 : game.cells.length;
    for (let index = 0; index < end; index += 1) {
      if (game.cells[index].x === x && game.cells[index].y === y) {
        return true;
      }
    }
    return false;
  };

  // Random cell that is not snake, food or bonus.
  const freeCell = () => {
    const taken = new Set(game.cells.map((c) => c.y * COLS + c.x));
    [game.food, game.bonus].forEach((item) => {
      if (item) {
        taken.add(item.y * COLS + item.x);
      }
    });
    const free = [];
    for (let index = 0; index < COLS * ROWS; index += 1) {
      if (!taken.has(index)) {
        free.push(index);
      }
    }
    if (!free.length) {
      return null;
    }
    const pick = free[Math.floor(Math.random() * free.length)];
    return { x: pick % COLS, y: Math.floor(pick / COLS), born: game.t };
  };

  const resetSnake = () => {
    const back = DIRS[START.dir];
    game.cells = [];
    for (let index = 0; index < START.length; index += 1) {
      game.cells.push({ x: START.x - back.x * index, y: START.y - back.y * index });
    }
    game.prev = game.cells.map((c) => ({ x: c.x, y: c.y }));
    game.dir = START.dir;
    game.queue.length = 0;
    game.grow = 0;
    game.stepT = -START_DELAY;
    game.p = 0;
    game.eaten = 0;
    game.food = null;
    game.bonus = null;
    game.gulps.length = 0;
    game.deadT = 0;
    game.popped = 0;
    game.endT = 0;
    game.flash = 0;
    game.turned = false;
    game.pointer.active = false;
    game.food = freeCell();
  };

  const startDemo = () => {
    game.mode = "demo";
    resetSnake();
    game.stepT = 0;
  };

  const resetGame = () => {
    game.mode = "run";
    resetSnake();
  };

  const queueTurn = (name) => {
    if (game.mode !== "run") {
      return;
    }
    const last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir;
    const d = DIRS[name];
    const l = DIRS[last];
    if (name === last || (d.x === -l.x && d.y === -l.y) || game.queue.length >= QUEUE_MAX) {
      return;
    }
    game.queue.push(name);
    game.turned = true;
  };

  // Greedy autopilot for the attract loop: closer to the target, never boxed in.
  const aiDir = () => {
    const head = game.cells[0];
    const target = game.bonus || game.food || head;
    const cur = DIRS[game.dir];
    let best = game.dir;
    let bestScore = -Infinity;
    DIR_NAMES.forEach((name) => {
      const d = DIRS[name];
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if ((d.x === -cur.x && d.y === -cur.y) || isBlocked(nx, ny, game.grow === 0)) {
        return;
      }
      let exits = 0;
      DIR_NAMES.forEach((other) => {
        if (!isBlocked(nx + DIRS[other].x, ny + DIRS[other].y, false)) {
          exits += 1;
        }
      });
      const score = -(Math.abs(target.x - nx) + Math.abs(target.y - ny))
        + (exits === 0 ? -100 : exits * 0.3)
        + (name === game.dir ? 0.2 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = name;
      }
    });
    return best;
  };

  const win = () => {
    game.mode = "won";
    game.endT = 0;
    // Called mid-step: finish gliding into the last cell instead of jumping ahead.
    game.p = clamp(game.stepT / stepInterval(), 0, 1);
    game.cells.forEach((c, index) => {
      if (index % 3 === 0) {
        burst(cellX(c.x), cellY(c.y), index % 2 ? PALETTE.bonus : PALETTE.snakeGlow, 5, 80 * FX);
      }
    });
  };

  const die = () => {
    const head = game.cells[0];
    game.mode = "dead";
    game.deadT = 0;
    game.popped = 0;
    game.p = 1;
    game.flash = 1;
    burst(cellX(head.x), cellY(head.y), PALETTE.dead, 14, 100 * FX);
    textAt(cellX(head.x), cellY(head.y) - CELL, "OUCH!", PALETTE.dead);
    shake();
  };

  const eat = (isBonus, auto) => {
    const item = isBonus ? game.bonus : game.food;
    const x = cellX(item.x);
    const y = cellY(item.y);
    burst(x, y, isBonus ? PALETTE.bonus : PALETTE.food, isBonus ? 16 : 12, 90 * FX);
    game.grow += isBonus ? BONUS.value : 1;
    game.eaten += 1;
    game.gulps.push(0);
    if (isBonus) {
      game.bonus = null;
    } else {
      game.food = null;
      game.food = freeCell();
      if (!game.bonus && game.eaten % BONUS.every === 0 && Math.random() < BONUS.chance) {
        game.bonus = freeCell();
        if (game.bonus) {
          game.bonus.life = BONUS.life;
        }
      }
    }
    if (auto) {
      return;
    }
    textAt(x, y - CELL * 0.85, isBonus ? `+${BONUS.value}` : "+1", isBonus ? PALETTE.bonus : PALETTE.foodCore);
    setScore(Shell.score + (isBonus ? BONUS.value : 1));
    if (Shell.score >= CONFIG.goal) {
      win();
    }
  };

  const step = (auto) => {
    if (auto) {
      game.dir = aiDir();
    } else if (game.queue.length) {
      game.dir = game.queue.shift();
    }
    const d = DIRS[game.dir];
    const head = game.cells[0];
    const nx = head.x + d.x;
    const ny = head.y + d.y;
    // The tail cell is free to enter unless the snake is about to grow.
    if (isBlocked(nx, ny, game.grow === 0)) {
      if (auto) {
        burst(cellX(head.x), cellY(head.y), PALETTE.snakeGlow, 10, 80 * FX);
        startDemo();
      } else {
        die();
      }
      return;
    }
    game.prev = game.cells.map((c) => ({ x: c.x, y: c.y }));
    game.cells.unshift({ x: nx, y: ny });
    if (game.grow > 0) {
      game.grow -= 1;
    } else {
      game.cells.pop();
    }
    for (let index = game.gulps.length - 1; index >= 0; index -= 1) {
      game.gulps[index] += 2;
      if (game.gulps[index] > game.cells.length + 1) {
        game.gulps.splice(index, 1);
      }
    }
    if (game.food && game.food.x === nx && game.food.y === ny) {
      eat(false, auto);
    } else if (game.bonus && game.bonus.x === nx && game.bonus.y === ny) {
      eat(true, auto);
    }
    if (auto && game.cells.length >= DEMO_MAX) {
      startDemo();
    }
  };

  const advance = (dt, auto) => {
    const interval = stepInterval();
    game.stepT += dt;
    while (game.stepT >= interval && (game.mode === "run" || game.mode === "demo")) {
      game.stepT -= interval;
      step(auto);
    }
    if (game.mode === "run" || game.mode === "demo") {
      game.p = clamp(game.stepT / stepInterval(), 0, 1);
    }
  };

  const animate = (dt) => {
    game.flash = Math.max(0, game.flash - dt * 2.5);
    game.blinkIn -= dt;
    if (game.blinkIn <= 0) {
      game.blink = 0.14;
      game.blinkIn = rand(1.8, 3.8);
    }
    game.blink = Math.max(0, game.blink - dt);
    game.tongueIn -= dt;
    if (game.tongueIn <= 0) {
      game.tongue = 0.28;
      game.tongueIn = rand(1.4, 3.2);
    }
    game.tongue = Math.max(0, game.tongue - dt);
    if (game.bonus && game.mode !== "won") {
      game.bonus.life -= dt;
      if (game.bonus.life <= 0) {
        burst(cellX(game.bonus.x), cellY(game.bonus.y), PALETTE.bonus, 6, 40 * FX);
        game.bonus = null;
      }
    }
    if (game.mode === "won") {
      game.p = Math.min(1, game.p + dt / stepInterval());
    }
    if (game.mode === "dead") {
      game.deadT += dt;
      const target = Math.floor(clamp((game.deadT - DEATH_HOLD) / DISSOLVE, 0, 1) * (game.cells.length + 1));
      while (game.popped < target && game.popped < game.cells.length) {
        const c = game.cells[game.popped];
        burst(cellX(c.x), cellY(c.y), game.popped === 0 ? PALETTE.dead : PALETTE.snakeGlow, 3, 60 * FX);
        game.popped += 1;
      }
    }
  };

  // Runs only in the play phase.
  const update = (dt) => {
    game.t += dt;
    animate(dt);
    if (game.mode === "run") {
      advance(dt, false);
    } else if (game.mode === "dead" && game.deadT >= DEATH_TIME) {
      endGame(false);
    } else if (game.mode === "won") {
      game.endT += dt;
      if (game.endT >= WIN_DELAY) {
        endGame(true);
      }
    }
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    game.t += dt;
    animate(dt);
    if (game.mode === "demo") {
      advance(dt, true);
    }
  };

  const lerpPoint = (a, b, t) => ({ x: cellX(a.x + (b.x - a.x) * t), y: cellY(a.y + (b.y - a.y) * t) });

  // Smooth body: interpolated head, the cell centers in between, interpolated tail.
  const bodyPath = () => {
    const cells = game.cells;
    const prev = game.prev;
    const last = cells.length - 1;
    const pts = [lerpPoint(prev[0] || cells[0], cells[0], game.p)];
    for (let index = 1; index <= last; index += 1) {
      pts.push({ x: cellX(cells[index].x), y: cellY(cells[index].y) });
    }
    pts.push(lerpPoint(prev[last] || cells[last], cells[last], game.p));
    return pts;
  };

  const segmentColor = (index, count) => {
    if (game.mode === "dead") {
      return PALETTE.dead;
    }
    if (game.mode === "won" || (Shell.phase === "end" && Shell.won)) {
      const hue = (((150 + index * 22 - game.t * 300) % 360) + 360) % 360;
      return `hsl(${hue.toFixed(0)}, 100%, 62%)`;
    }
    return `hsl(${(150 + (index / Math.max(1, count)) * 38).toFixed(0)}, 100%, ${(60 - (index / Math.max(1, count)) * 8).toFixed(0)}%)`;
  };

  const tracePath = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let index = 1; index < pts.length; index += 1) {
      ctx.lineTo(pts[index].x, pts[index].y);
    }
  };

  // Head art is authored for a 14 px cell and scaled by SC.
  const drawHead = (pt) => {
    const d = DIRS[game.dir];
    const px = -d.y;
    const py = d.x;
    const r = 11 / 2 + 1.4;
    const target = game.bonus || game.food;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.scale(SC, SC);
    ctx.fillStyle = segmentColor(0, game.cells.length);
    ctx.beginPath();
    ctx.arc(d.x * 1.5, d.y * 1.5, r, 0, TAU);
    ctx.fill();

    if (game.tongue > 0 && game.mode !== "dead") {
      const len = 4 + Math.sin((game.tongue / 0.28) * Math.PI) * 4;
      const tx = d.x * (r + 1);
      const ty = d.y * (r + 1);
      ctx.strokeStyle = PALETTE.tongue;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + d.x * len, ty + d.y * len);
      ctx.lineTo(tx + d.x * (len + 2) + px * 1.6, ty + d.y * (len + 2) + py * 1.6);
      ctx.moveTo(tx + d.x * len, ty + d.y * len);
      ctx.lineTo(tx + d.x * (len + 2) - px * 1.6, ty + d.y * (len + 2) - py * 1.6);
      ctx.stroke();
    }

    [-1, 1].forEach((side) => {
      const ex = d.x * 2.6 + px * 3.3 * side;
      const ey = d.y * 2.6 + py * 3.3 * side;
      ctx.fillStyle = PALETTE.eyeWhite;
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = PALETTE.pupil;
      ctx.fillStyle = PALETTE.pupil;
      if (game.mode === "dead") {
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(ex - 1.4, ey - 1.4);
        ctx.lineTo(ex + 1.4, ey + 1.4);
        ctx.moveTo(ex + 1.4, ey - 1.4);
        ctx.lineTo(ex - 1.4, ey + 1.4);
        ctx.stroke();
      } else if (game.blink > 0) {
        ctx.fillRect(ex - 2.2, ey - 0.5, 4.4, 1);
      } else {
        // pupils glance toward the food
        let lx = d.x;
        let ly = d.y;
        if (target) {
          const vx = cellX(target.x) - (pt.x + ex * SC);
          const vy = cellY(target.y) - (pt.y + ey * SC);
          const len = Math.hypot(vx, vy) || 1;
          lx = vx / len;
          ly = vy / len;
        }
        ctx.beginPath();
        ctx.arc(ex + lx * 1.1, ey + ly * 1.1, 1.35, 0, TAU);
        ctx.fill();
      }
    });
    ctx.restore();
  };

  const drawSnake = () => {
    const all = bodyPath();
    const start = game.mode === "dead" ? game.popped : 0;
    const pts = start ? all.slice(start) : all;
    if (pts.length < 2) {
      return;
    }
    const count = all.length - 1;
    const gulpAt = game.gulps.map((g) => g + 2 * game.p);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    tracePath(pts);
    ctx.strokeStyle = game.mode === "dead" ? PALETTE.dead : PALETTE.snakeGlow;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = HEAD_W + 9 * SC;
    ctx.stroke();
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = HEAD_W + 3 * SC;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Tapered core: a quad per segment plus a round joint, so the width eases
    // smoothly toward the tail (round-capped strokes would step at each joint).
    const widthAt = (body) => {
      let width = HEAD_W + (TAIL_W - HEAD_W) * (body / Math.max(1, count));
      gulpAt.forEach((g) => {
        width += GULP_W * Math.max(0, 1 - Math.abs(body - g));
      });
      return width / 2;
    };
    for (let index = 0; index < pts.length - 1; index += 1) {
      const body = index + start;
      const a = pts[index];
      const b = pts[index + 1];
      const ra = widthAt(body);
      const rb = widthAt(body + 1);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      ctx.fillStyle = segmentColor(body, count);
      ctx.beginPath();
      ctx.moveTo(a.x + nx * ra, a.y + ny * ra);
      ctx.lineTo(b.x + nx * rb, b.y + ny * rb);
      ctx.lineTo(b.x - nx * rb, b.y - ny * rb);
      ctx.lineTo(a.x - nx * ra, a.y - ny * ra);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(b.x, b.y, rb, 0, TAU);
      ctx.fill();
      if (index === 0) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, ra, 0, TAU);
        ctx.fill();
      }
    }

    tracePath(pts);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = Math.max(0.7, 1.4 * SC);
    ctx.stroke();

    if (start === 0) {
      drawHead(pts[0]);
    }
  };

  const drawFood = (f) => {
    const age = game.t - f.born;
    const pop = age < 0.3 ? Math.max(0, easeOutBack(age / 0.3)) : 1;
    const pulse = 1 + Math.sin(game.t * 6) * 0.1;
    const r = 4.8 * pop * pulse;
    ctx.save();
    ctx.translate(cellX(f.x), cellY(f.y));
    ctx.scale(SC, SC);
    ctx.fillStyle = PALETTE.foodGlow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.food;
    ctx.beginPath();
    ctx.arc(0, 0.5, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.foodCore;
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.25, r * 0.32, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.leaf;
    ctx.beginPath();
    ctx.ellipse(1.6 * pop, -r - 0.6, 2.6 * pop, 1.2 * pop, -0.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  const drawBonus = (b) => {
    const frac = clamp(b.life / BONUS.life, 0, 1);
    const age = game.t - b.born;
    const pop = age < 0.3 ? Math.max(0, easeOutBack(age / 0.3)) : 1;
    ctx.save();
    ctx.translate(cellX(b.x), cellY(b.y));
    ctx.scale(SC, SC);
    // blink when about to expire
    ctx.globalAlpha = frac < 0.3 && Math.floor(game.t * 8) % 2 === 0 ? 0.4 : 1;
    ctx.fillStyle = PALETTE.bonusGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 10 * pop, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.bonus;
    ctx.beginPath();
    for (let k = 0; k < 10; k += 1) {
      const a = game.t * 1.5 + (k * Math.PI) / 5 - Math.PI / 2;
      const r = (k % 2 ? 2.8 : 6.4) * pop;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.bonus;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 9 * pop, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  const drawHint = () => {
    const size = LAYOUT.hintFont;
    ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(LAYOUT.hint).width + size * 2;
    const h = size * 2;
    const x = BOARD.x + (COLS * CELL) / 2;
    const y = BOARD.y + ROWS * CELL - h / 2 - Math.min(8, CELL * 0.4);
    ctx.globalAlpha = 0.75 + Math.sin(game.t * 5) * 0.2;
    ctx.fillStyle = PALETTE.hintBg;
    roundPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(LAYOUT.hint, x, y + size * 0.05);
  };

  const draw = () => {
    ctx.drawImage(boardLayer, 0, 0, WIDTH, HEIGHT);
    if (game.flash > 0) {
      ctx.globalAlpha = game.flash;
      ctx.strokeStyle = PALETTE.dead;
      ctx.lineWidth = Math.max(1.5, 3 * SC);
      boardPath(ctx, 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Under the snake so it never hides the action; gone after the first turn.
    if (Shell.phase === "play" && game.mode === "run" && !game.turned && Shell.elapsed < HINT_MS) {
      drawHint();
    }
    if (game.food) {
      drawFood(game.food);
    }
    if (game.bonus) {
      drawBonus(game.bonus);
    }
    drawSnake();
    drawFx();
  };

  const onPointerDown = (point, event) => {
    const ptr = game.pointer;
    ptr.active = true;
    ptr.id = event ? event.pointerId : null;
    ptr.x = point.x;
    ptr.y = point.y;
    ptr.swiped = false;
  };

  const onPointerMove = (point, event) => {
    const ptr = game.pointer;
    if (!ptr.active || (event && ptr.id !== null && event.pointerId !== ptr.id)) {
      return;
    }
    // A mouse released outside the ad never sent pointerup: drop the stale drag.
    if (event && event.buttons === 0) {
      ptr.active = false;
      return;
    }
    const dx = point.x - ptr.x;
    const dy = point.y - ptr.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) {
      return;
    }
    queueTurn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    // Re-anchor so one continuous drag can chain a second turn.
    ptr.x = point.x;
    ptr.y = point.y;
    ptr.swiped = true;
  };

  const onPointerUp = (point, event) => {
    const ptr = game.pointer;
    if (!ptr.active || (event && ptr.id !== null && event.pointerId !== ptr.id)) {
      return;
    }
    ptr.active = false;
    if (ptr.swiped || (event && event.type === "pointercancel") || game.mode !== "run") {
      return;
    }
    // Tap fallback: turn toward the side of the head that was tapped.
    const head = bodyPath()[0];
    const heading = DIRS[game.queue.length ? game.queue[game.queue.length - 1] : game.dir];
    const deadZone = CELL * 0.3;
    if (heading.x !== 0) {
      if (Math.abs(point.y - head.y) > deadZone) {
        queueTurn(point.y < head.y ? "up" : "down");
      }
    } else if (Math.abs(point.x - head.x) > deadZone) {
      queueTurn(point.x < head.x ? "left" : "right");
    }
  };

  // Return true to swallow the key.
  const onKey = (key, down, event) => {
    const name = KEY_DIRS[key];
    if (!name) {
      return false;
    }
    if (down && !(event && event.repeat)) {
      queueTurn(name);
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
