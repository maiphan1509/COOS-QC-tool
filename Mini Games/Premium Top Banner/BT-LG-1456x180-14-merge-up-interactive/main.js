(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-merge-up",           // CustomEvent namespace
    api: "mgMergeUp",                     // window.<api> handle
    campaign: "lumen-s3",
    offer: "−25%",
    winTitle: "128 reached!",
    loseTitle: "Board full!",
    goal: 128,                            // tile value that counts as a win
    maxPlayMs: 60000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#2a1150",
    skyBottom: "#0d0620",
    board: "#1b0f36",
    boardEdge: "rgba(196, 155, 255, 0.35)",
    slot: "rgba(255, 255, 255, 0.07)",
    // value: [face top, face bottom, digits]
    tiles: {
      2: ["#fff3d9", "#ffd9a0", "#6b3a12"],
      4: ["#ffd88f", "#ffb04f", "#5a2a06"],
      8: ["#ffab78", "#ff7a45", "#ffffff"],
      16: ["#ff8590", "#ff4766", "#ffffff"],
      32: ["#ff7cc4", "#e23d93", "#ffffff"],
      64: ["#c39bff", "#8a4dff", "#ffffff"],
      128: ["#7fd8ff", "#1e90ff", "#ffffff"],
      256: ["#7dffd6", "#14c18f", "#ffffff"]
    },
    accent: "#7fd8ff",
    text: "#f4eaff",
    dim: "rgba(236, 222, 255, 0.6)"
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

  const particles = [];
  const floaters = [];

  const burst = (x, y, color, count = 12, speed = 90) => {
    if (reduceMotion) {
      count = Math.ceil(count / 3);
    }
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

  // The strip is too short for a 4x4 board, so it plays on a 2x8 one.
  const GRIDS = {
    popup: { rows: 4, cols: 4, cell: 44, gap: 6 },
    rail: { rows: 4, cols: 4, cell: 20, gap: 3 },
    strip: { rows: 2, cols: 8, cell: 22, gap: 3 }
  };

  const ROWS = GRIDS[FORMAT].rows;
  const COLS = GRIDS[FORMAT].cols;
  const CELL = GRIDS[FORMAT].cell;
  const GAP = GRIDS[FORMAT].gap;
  const COMPACT = FORMAT !== "popup";
  const BOARD = { w: COLS * CELL + (COLS + 1) * GAP, h: ROWS * CELL + (ROWS + 1) * GAP };
  Object.assign(BOARD, {
    popup: { x: 10, y: 34 },
    rail: { x: (WIDTH - BOARD.w) / 2, y: SAFE.y + 4 },
    strip: { x: SAFE.x + 4, y: (HEIGHT - BOARD.h) / 2 }
  }[FORMAT]);

  // Goal tile, progress, points and the swipe hint: a column beside the board
  // in the popup, stacked under it in the rail, in a row after it in the strip.
  const PANEL = (() => {
    if (FORMAT === "popup") {
      const x = BOARD.x + BOARD.w + 8;
      const cx = x + (WIDTH - x - 8) / 2;
      return {
        goalLabel: { x: cx, y: 42 }, goal: { x: cx, y: 70, size: 40 },
        bar: { x: x + 4, y: 97, w: WIDTH - x - 16 },
        pointsLabel: { x: cx, y: 124 }, points: { x: cx, y: 140 },
        hint: { x: cx, y: 186, arm: 16, scale: 1 }, hintLabel: { x: cx, y: 220 }
      };
    }
    if (FORMAT === "rail") {
      const top = BOARD.y + BOARD.h;
      return {
        goalLabel: { x: 50, y: top + 11 }, goal: { x: 50, y: top + 31, size: 26 },
        bar: { x: 22, y: top + 50, w: 56 },
        pointsLabel: { x: 30, y: top + 67 }, points: { x: 30, y: top + 80 },
        hint: { x: 72, y: top + 74, arm: 9, scale: 0.7 }, hintLabel: null
      };
    }
    const x = BOARD.x + BOARD.w + 10;
    return {
      goalLabel: { x: x + 14, y: 8 }, goal: { x: x + 14, y: 27, size: 24 },
      bar: { x: x + 2, y: 44, w: 24 },
      pointsLabel: { x: x + 56, y: 19 }, points: { x: x + 56, y: 33 },
      hint: { x: x + 104, y: 27, arm: 10, scale: 0.75 }, hintLabel: null
    };
  })();

  const FONT = { label: COMPACT ? 7 : 9, points: COMPACT ? 11 : 16 };

  const SLIDE_TIME = 0.11;
  const POP_TIME = 0.2;
  const SWIPE_MIN = COMPACT ? 12 : 18;   // px before a drag counts as a swipe
  const FOUR_CHANCE = 0.25;
  const WIN_PAUSE = 0.55;     // let the winning merge pop before the end card
  const LOSE_PAUSE = 0.9;
  const DEMO_EVERY = 0.55;

  // A head start so 128 is ~30 moves away instead of ~60: the board opens
  // with a 32, an 8, a 4 and two 2s. The 2x8 strip board merges more slowly,
  // so it also starts with a 16.
  const SEED_TILES = FORMAT === "strip" ? [32, 16, 8, 2, 2] : [32, 8, 4, 2, 2];

  const DIRS = {
    left: { dr: 0, dc: -1 },
    right: { dr: 0, dc: 1 },
    up: { dr: -1, dc: 0 },
    down: { dr: 1, dc: 0 }
  };
  const DIR_NAMES = Object.keys(DIRS);
  const KEY_DIRS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down"
  };

  const game = {
    grid: [],
    tiles: [],          // drawn this frame, including merge sources still sliding
    nextId: 1,
    clock: 0,
    movedAt: -1,
    best: 0,
    points: 0,
    swipe: null,
    bumpAt: -1,
    bumpDir: "left",
    winAt: -1,
    overAt: -1,
    demoTimer: 0
  };

  const makeTile = (value, row, col, bornAt) => {
    const tile = {
      id: game.nextId, value, row, col, fromRow: row, fromCol: col, bornAt, merged: false, dying: false
    };
    game.nextId += 1;
    game.tiles.push(tile);
    game.grid[row][col] = tile;
    return tile;
  };

  const emptyCells = () => {
    const cells = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (!game.grid[row][col]) {
          cells.push([row, col]);
        }
      }
    }
    return cells;
  };

  const spawnTile = (value, delay = SLIDE_TIME) => {
    const cells = emptyCells();
    if (!cells.length) {
      return null;
    }
    const [row, col] = cells[Math.floor(Math.random() * cells.length)];
    return makeTile(value || (Math.random() < FOUR_CHANCE ? 4 : 2), row, col, game.clock + delay);
  };

  const refreshBest = () => {
    game.best = 0;
    game.grid.forEach((line) => line.forEach((tile) => {
      if (tile && tile.value > game.best) {
        game.best = tile.value;
      }
    }));
  };

  const newBoard = (seeded) => {
    game.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    game.tiles = [];
    game.movedAt = -1;
    (seeded ? SEED_TILES : [2, 2]).forEach((value, index) => spawnTile(value, 0.08 * index));
    refreshBest();
  };

  const canMove = () => {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const tile = game.grid[row][col];
        if (!tile) {
          return true;
        }
        const right = col + 1 < COLS && game.grid[row][col + 1];
        const below = row + 1 < ROWS && game.grid[row + 1][col];
        if ((right && right.value === tile.value) || (below && below.value === tile.value)) {
          return true;
        }
      }
    }
    return false;
  };

  // Slides every tile toward `name`; equal neighbours fuse once per move.
  // Returns the points gained, or -1 when nothing moved.
  const move = (name) => {
    const { dr, dc } = DIRS[name];
    game.tiles = game.tiles.filter((tile) => !tile.dying);
    game.tiles.forEach((tile) => {
      tile.fromRow = tile.row;
      tile.fromCol = tile.col;
    });

    const rowOrder = Array.from({ length: ROWS }, (_, index) => index);
    const colOrder = Array.from({ length: COLS }, (_, index) => index);
    const rows = dr === 1 ? rowOrder.reverse() : rowOrder;
    const cols = dc === 1 ? colOrder.reverse() : colOrder;
    const fused = new Set();
    let moved = false;
    let gained = 0;

    rows.forEach((startRow) => cols.forEach((startCol) => {
      const tile = game.grid[startRow][startCol];
      if (!tile) {
        return;
      }
      let row = startRow;
      let col = startCol;
      for (;;) {
        const nextRow = row + dr;
        const nextCol = col + dc;
        if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
          break;
        }
        const other = game.grid[nextRow][nextCol];
        if (!other) {
          row = nextRow;
          col = nextCol;
          continue;
        }
        if (other.value === tile.value && !fused.has(other)) {
          game.grid[startRow][startCol] = null;
          game.grid[nextRow][nextCol] = null;
          tile.row = nextRow;
          tile.col = nextCol;
          tile.dying = true;
          other.dying = true;
          const result = makeTile(tile.value * 2, nextRow, nextCol, game.clock + SLIDE_TIME);
          result.merged = true;
          fused.add(result);
          gained += result.value;
          moved = true;
          return;
        }
        break;
      }
      if (row !== startRow || col !== startCol) {
        game.grid[startRow][startCol] = null;
        game.grid[row][col] = tile;
        tile.row = row;
        tile.col = col;
        moved = true;
      }
    }));

    if (!moved) {
      return -1;
    }
    game.movedAt = game.clock;
    spawnTile();
    refreshBest();
    return gained;
  };

  const tileOrigin = (row, col) => ({
    x: BOARD.x + GAP + col * (CELL + GAP),
    y: BOARD.y + GAP + row * (CELL + GAP)
  });

  const act = (name) => {
    if (game.winAt >= 0 || game.overAt >= 0) {
      return;
    }
    const before = game.best;
    const gained = move(name);
    if (gained < 0) {
      game.bumpAt = game.clock;
      game.bumpDir = name;
      return;
    }
    game.points += gained;
    if (gained >= 16) {
      const best = game.tiles.find((tile) => tile.merged && tile.bornAt > game.clock && tile.value === game.best);
      if (best) {
        const at = tileOrigin(best.row, best.col);
        floatText(at.x + CELL / 2, at.y + 6, `+${gained}`, PALETTE.tiles[best.value][0]);
      }
    }
    if (game.best > before && game.best >= 32) {
      const top = game.tiles.find((tile) => !tile.dying && tile.value === game.best);
      if (top) {
        const at = tileOrigin(top.row, top.col);
        burst(at.x + CELL / 2, at.y + CELL / 2, PALETTE.tiles[game.best][1], 16, 110);
      }
    }
    if (game.best >= CONFIG.goal) {
      game.winAt = game.clock + WIN_PAUSE;
      return;
    }
    if (!canMove()) {
      game.overAt = game.clock + LOSE_PAUSE;
      shake();
    }
  };

  const resetGame = () => {
    newBoard(true);
    game.points = 0;
    game.swipe = null;
    game.bumpAt = -1;
    game.winAt = -1;
    game.overAt = -1;
  };

  const tickClock = (dt) => {
    game.clock += dt;
    if (game.movedAt >= 0 && game.clock - game.movedAt > SLIDE_TIME) {
      game.tiles = game.tiles.filter((tile) => !tile.dying);
    }
  };

  // Runs only in the play phase.
  const update = (dt) => {
    tickClock(dt);
    if (Shell.score !== game.best) {
      setScore(game.best);
    }
    if (game.winAt >= 0 && game.clock >= game.winAt) {
      endGame(true);
    } else if (game.overAt >= 0 && game.clock >= game.overAt) {
      endGame(false);
    }
  };

  // Attract mode: the board plays itself behind the intro card.
  const idle = (dt) => {
    tickClock(dt);
    if (Shell.phase !== "intro") {
      return;
    }
    game.demoTimer -= dt;
    if (game.demoTimer > 0) {
      return;
    }
    game.demoTimer = DEMO_EVERY;
    const order = DIR_NAMES.slice().sort(() => Math.random() - 0.5);
    const moved = order.some((name) => move(name) >= 0);
    if (!moved || game.best >= 64) {
      newBoard(false);
    }
  };

  /* -------------------------------------------------------------- RENDERING */

  const roundRect = (g, x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  const easeOutBack = (t) => {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  const BACKDROP = (() => {
    const layer = document.createElement("canvas");
    layer.width = Math.round(WIDTH * DPR);
    layer.height = Math.round(HEIGHT * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sky = g.createLinearGradient(0, 0, WIDTH, HEIGHT);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    for (let index = 0; index < (WIDTH * HEIGHT) / 1900; index += 1) {
      g.fillStyle = `rgba(255, 255, 255, ${0.05 + Math.random() * 0.12})`;
      g.beginPath();
      g.arc(Math.random() * WIDTH, Math.random() * HEIGHT, Math.random() * 1.3 + 0.3, 0, Math.PI * 2);
      g.fill();
    }
    roundRect(g, BOARD.x, BOARD.y, BOARD.w, BOARD.h, Math.max(4, CELL * 0.22));
    g.fillStyle = PALETTE.board;
    g.fill();
    g.strokeStyle = PALETTE.boardEdge;
    g.lineWidth = 1;
    g.stroke();
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const at = tileOrigin(row, col);
        roundRect(g, at.x, at.y, CELL, CELL, CELL * 0.16);
        g.fillStyle = PALETTE.slot;
        g.fill();
      }
    }
    return layer;
  })();

  const tileSprites = {};

  const tileSprite = (value) => {
    if (tileSprites[value]) {
      return tileSprites[value];
    }
    const colors = PALETTE.tiles[value] || PALETTE.tiles[256];
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(CELL * DPR);
    layer.height = Math.ceil(CELL * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const radius = CELL * 0.16;
    const lip = Math.max(1.5, CELL * 0.07);
    roundRect(g, 0, lip, CELL, CELL - lip, radius);
    g.fillStyle = "rgba(0, 0, 0, 0.35)";
    g.fill();
    const face = g.createLinearGradient(0, 0, 0, CELL);
    face.addColorStop(0, colors[0]);
    face.addColorStop(1, colors[1]);
    roundRect(g, 0, 0, CELL, CELL - lip * 1.5, radius);
    g.fillStyle = face;
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.4)";
    roundRect(g, CELL * 0.12, CELL * 0.07, CELL * 0.76, CELL * 0.09, CELL * 0.045);
    g.fill();
    const digits = String(value).length;
    g.font = `900 ${Math.round(CELL * (digits >= 3 ? 0.36 : 0.45))}px Arial, Helvetica, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(0, 0, 0, 0.18)";
    g.fillText(String(value), CELL / 2, CELL / 2 + 1);
    g.fillStyle = colors[2];
    g.fillText(String(value), CELL / 2, CELL / 2 - 1);
    tileSprites[value] = layer;
    return layer;
  };

  const drawTile = (tile, slide) => {
    if (game.clock < tile.bornAt || (tile.dying && slide >= 1)) {
      return;
    }
    const row = tile.fromRow + (tile.row - tile.fromRow) * slide;
    const col = tile.fromCol + (tile.col - tile.fromCol) * slide;
    const at = tileOrigin(row, col);
    const age = game.clock - tile.bornAt;
    let scale = 1;
    if (age < POP_TIME) {
      scale = tile.merged ? 1 + 0.2 * Math.sin((age / POP_TIME) * Math.PI) : Math.max(0.05, easeOutBack(age / POP_TIME));
    }
    if (tile.value >= CONFIG.goal) {
      const glow = ctx.createRadialGradient(at.x + CELL / 2, at.y + CELL / 2, 4, at.x + CELL / 2, at.y + CELL / 2, CELL);
      glow.addColorStop(0, "rgba(127, 216, 255, 0.55)");
      glow.addColorStop(1, "rgba(127, 216, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(at.x - CELL / 2, at.y - CELL / 2, CELL * 2, CELL * 2);
    }
    const size = CELL * scale;
    ctx.drawImage(tileSprite(tile.value), at.x + (CELL - size) / 2, at.y + (CELL - size) / 2, size, size);
  };

  const drawArrow = (x, y, angle, lit, scale) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = lit ? PALETTE.accent : "rgba(236, 222, 255, 0.25)";
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-3, -5);
    ctx.lineTo(-3, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawPanel = () => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.dim;
    ctx.font = `800 ${FONT.label}px Arial, Helvetica, sans-serif`;
    ctx.fillText("GOAL", PANEL.goalLabel.x, PANEL.goalLabel.y);

    const pulse = 1 + Math.sin(game.clock * 4) * 0.04;
    const goalSize = PANEL.goal.size * pulse;
    ctx.drawImage(tileSprite(CONFIG.goal), PANEL.goal.x - goalSize / 2, PANEL.goal.y - goalSize / 2, goalSize, goalSize);

    // Progress in doublings: 2 -> 128 is six steps.
    const steps = Math.log2(CONFIG.goal) - 1;
    const progress = clamp((Math.log2(Math.max(2, game.best)) - 1) / steps, 0, 1);
    const bar = PANEL.bar;
    const barH = COMPACT ? 4 : 6;
    roundRect(ctx, bar.x, bar.y, bar.w, barH, barH / 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fill();
    if (progress > 0) {
      roundRect(ctx, bar.x, bar.y, Math.max(barH, bar.w * progress), barH, barH / 2);
      ctx.fillStyle = PALETTE.accent;
      ctx.fill();
    }

    ctx.fillStyle = PALETTE.dim;
    ctx.font = `800 ${FONT.label}px Arial, Helvetica, sans-serif`;
    ctx.fillText("POINTS", PANEL.pointsLabel.x, PANEL.pointsLabel.y);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 ${FONT.points}px Arial, Helvetica, sans-serif`;
    ctx.fillText(String(game.points), PANEL.points.x, PANEL.points.y);

    const hint = PANEL.hint;
    const lit = Math.floor(game.clock * 2.5) % 4;
    drawArrow(hint.x, hint.y - hint.arm, -Math.PI / 2, lit === 0, hint.scale);
    drawArrow(hint.x + hint.arm, hint.y, 0, lit === 1, hint.scale);
    drawArrow(hint.x, hint.y + hint.arm, Math.PI / 2, lit === 2, hint.scale);
    drawArrow(hint.x - hint.arm, hint.y, Math.PI, lit === 3, hint.scale);
    ctx.fillStyle = "rgba(236, 222, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(hint.x, hint.y, 4 * hint.scale, 0, Math.PI * 2);
    ctx.fill();
    if (PANEL.hintLabel) {
      ctx.fillStyle = PALETTE.dim;
      ctx.font = `800 ${FONT.label}px Arial, Helvetica, sans-serif`;
      ctx.fillText("SWIPE", PANEL.hintLabel.x, PANEL.hintLabel.y);
    }
  };

  const draw = () => {
    ctx.drawImage(BACKDROP, 0, 0, WIDTH, HEIGHT);

    const slideRaw = game.movedAt < 0 ? 1 : clamp((game.clock - game.movedAt) / SLIDE_TIME, 0, 1);
    const slide = 1 - Math.pow(1 - slideRaw, 3);

    // Blocked move: the board nudges toward the swipe and springs back.
    let nudgeX = 0;
    let nudgeY = 0;
    const bumpT = game.bumpAt < 0 ? 1 : (game.clock - game.bumpAt) / 0.22;
    if (bumpT < 1 && !reduceMotion) {
      const amount = Math.sin(bumpT * Math.PI) * CELL * 0.09;
      nudgeX = DIRS[game.bumpDir].dc * amount;
      nudgeY = DIRS[game.bumpDir].dr * amount;
    }

    ctx.save();
    ctx.translate(nudgeX, nudgeY);
    game.tiles.forEach((tile) => {
      if (tile.dying) {
        drawTile(tile, slide);
      }
    });
    game.tiles.forEach((tile) => {
      if (!tile.dying) {
        drawTile(tile, slide);
      }
    });
    ctx.restore();

    if (game.overAt >= 0) {
      ctx.fillStyle = "rgba(13, 6, 32, 0.45)";
      ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
    }

    drawPanel();
    drawFx();
  };

  /* --------------------------------------------------------------- GAME INPUT */

  const swipeDir = (dx, dy) => {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) {
      return null;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    }
    return dy > 0 ? "down" : "up";
  };

  const onPointerDown = (point) => {
    game.swipe = { x: point.x, y: point.y, done: false };
  };

  const onPointerMove = (point) => {
    const swipe = game.swipe;
    if (!swipe || swipe.done) {
      return;
    }
    const name = swipeDir(point.x - swipe.x, point.y - swipe.y);
    if (name) {
      swipe.done = true;
      act(name);
    }
  };

  const onPointerUp = (point) => {
    const swipe = game.swipe;
    game.swipe = null;
    if (swipe && !swipe.done) {
      const name = swipeDir(point.x - swipe.x, point.y - swipe.y);
      if (name) {
        act(name);
      }
    }
  };

  const onKey = (key, down) => {
    const name = KEY_DIRS[key];
    if (!name) {
      return false;
    }
    if (down) {
      act(name);
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
    endEyebrow.textContent = won ? `Best tile ${game.best} · ${game.points} pts` : `Best tile ${game.best} of ${CONFIG.goal}`;
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
  newBoard(false);
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
