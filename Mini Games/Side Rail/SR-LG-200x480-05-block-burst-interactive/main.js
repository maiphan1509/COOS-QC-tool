(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-block-burst",        // CustomEvent namespace
    api: "mgBlockBurst",                  // window.<api> handle
    campaign: "kovra-pad-11",
    offer: "−20%",
    winTitle: "Block master!",
    loseTitle: "So close!",
    goal: 120,                            // score that counts as a win; set per format below
    maxPlayMs: 50000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    bgTop: "#16245e",
    bgBottom: "#070b24",
    glow: "rgba(255, 122, 69, 0.14)",
    frameTop: "#4057b8",
    frameBottom: "#1a2563",
    board: "#0a1133",
    socket: "#141f4d",
    socketLip: "rgba(130, 160, 255, 0.12)",
    tray: "rgba(12, 19, 58, 0.88)",
    trayWell: "rgba(60, 84, 180, 0.16)",
    trayEdge: "rgba(118, 146, 255, 0.38)",
    blocks: ["#ff5470", "#ff8a3d", "#ffd23f", "#3ddc84", "#22c7e8", "#4f7bff", "#a463ff", "#ff6fcf"],
    accent: "#ff7a45",
    gold: "#ffd23f",
    text: "#f2f5ff",
    bad: "#ff4d5e"
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

  const floatText = (x, y, text, color = PALETTE.text, size = FORMAT === "popup" ? 12 : 9) => {
    floaters.push({ x, y, text, color, size, age: 0, life: size > 12 ? 1.1 : 0.8 });
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
    floaters.forEach((f) => {
      ctx.font = `900 ${f.size}px Arial, Helvetica, sans-serif`;
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

  // Board, piece limits, drag lift and win target per format. The strip's
  // three rows make column clears cheap (so its goal sits higher) and jam
  // easily, so it deals only pieces of four cells or fewer.
  const LAYOUT = {
    popup: { cols: 8, rows: 8, cell: 25, maxLen: 5, maxCells: 9, trayCell: 12, lift: 34, liftZone: 64, clamp: "bottom", goal: 120, time: 50000 },
    rail: { cols: 6, rows: 7, cell: 15, maxLen: 4, maxCells: 9, trayCell: 7, lift: 14, liftZone: 40, clamp: "none", goal: 120, time: 45000 },
    strip: { cols: 12, rows: 3, cell: 16, maxLen: 5, maxCells: 4, trayCell: 8, lift: 8, liftZone: HEIGHT, clamp: "both", goal: 450, time: 45000 }
  }[FORMAT];

  CONFIG.goal = LAYOUT.goal;
  CONFIG.maxPlayMs = LAYOUT.time;

  const COLS = LAYOUT.cols;
  const ROWS = LAYOUT.rows;
  const CELL = LAYOUT.cell;
  const COMPACT = FORMAT !== "popup";

  const BOARD = {
    popup: { x: 8, y: 36 },
    rail: { x: (WIDTH - COLS * CELL) / 2, y: SAFE.y + 5 },
    strip: { x: SAFE.x + 5, y: (HEIGHT - ROWS * CELL) / 2 }
  }[FORMAT];
  BOARD.w = COLS * CELL;
  BOARD.h = ROWS * CELL;

  // Three piece slots: stacked beside the board in the popup, side by side
  // under it in the rail and after it in the strip.
  const TRAY = {
    popup: { x: 214, y: 32, w: 80, h: 207, stacked: true },
    rail: { x: 3, y: BOARD.y + BOARD.h + 7, w: WIDTH - 6, h: HEIGHT - (BOARD.y + BOARD.h + 7) - 4, stacked: false },
    strip: { x: BOARD.x + BOARD.w + 8, y: 2, w: SAFE.x + SAFE.w - (BOARD.x + BOARD.w + 8) - 3, h: HEIGHT - 4, stacked: false }
  }[FORMAT];

  const FONT = {
    points: COMPACT ? 9 : 12,
    callout: COMPACT ? 12 : 20,
    combo: COMPACT ? 10 : 15
  };

  const FRAME = COMPACT ? 2.5 : 5;
  const BAR_Y = 26;             // popup goal bar under the HUD
  const PICK_S = 0.1;
  const RETURN_S = 0.18;
  const LAND_S = 0.08;
  const POP_S = 0.16;
  const DEAL_S = 0.34;
  const FLASH_S = 0.36;
  const CLEAR_S = 0.26;
  const SWEEP_S = 0.03;         // clear sweep delay per cell of distance from the drop
  const WIN_DELAY_S = 0.5;
  const OVER_DELAY_S = 1;
  const HELP_CHANCE = 0.6;      // chance a deal slips in a piece that can finish a line
  const LINE_POINTS = [0, 10, 30, 60, 100, 150, 210];
  const CALLOUTS = ["", "", "Double!", "Triple!", "Mega!"];
  const DEMO_THINK_S = 0.45;
  const DEMO_MOVE_S = 0.62;
  const DEMO_MAX_FILL = Math.round(COLS * ROWS * 0.62);

  const BASE_SHAPES = [
    { rows: ["#"], weight: 1 },
    { rows: ["##"], weight: 2 },
    { rows: ["###"], weight: 2 },
    { rows: ["####"], weight: 2 },
    { rows: ["#####"], weight: 1.2 },
    { rows: ["##", "##"], weight: 2 },
    { rows: ["###", "###", "###"], weight: 1 },
    { rows: ["#.", "#.", "##"], weight: 1.5 },
    { rows: [".#", ".#", "##"], weight: 1.5 },
    { rows: ["###", ".#."], weight: 1.5 },
    { rows: [".##", "##."], weight: 1 },
    { rows: ["##.", ".##"], weight: 1 },
    { rows: ["#.", "##"], weight: 2 },
    { rows: ["#..", "#..", "###"], weight: 1.2 }
  ];

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
  const easeOutBack = (t) => {
    const u = t - 1;
    return 1 + u * u * (2.70158 * u + 1.70158);
  };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const shuffle = (list) => {
    for (let index = list.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [list[index], list[other]] = [list[other], list[index]];
    }
    return list;
  };

  const shade = (hex, amount) => {
    const value = parseInt(hex.slice(1), 16);
    const target = amount < 0 ? 0 : 255;
    const t = Math.abs(amount);
    const channel = (shift) => Math.round(lerp((value >> shift) & 255, target, t));
    return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
  };

  const roundRect = (g, x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + radius, y);
    g.arcTo(x + w, y, x + w, y + h, radius);
    g.arcTo(x + w, y + h, x, y + h, radius);
    g.arcTo(x, y + h, x, y, radius);
    g.arcTo(x, y, x + w, y, radius);
    g.closePath();
  };

  // Offscreen layer at device resolution, painted once in served units.
  const makeLayer = (w, h, paint) => {
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(w * DPR);
    layer.height = Math.ceil(h * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    paint(g);
    return layer;
  };

  /* Shapes */

  const normalize = (cells) => {
    const minC = Math.min(...cells.map(([c]) => c));
    const minR = Math.min(...cells.map(([, r]) => r));
    return cells.map(([c, r]) => [c - minC, r - minR]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  };

  const makeShape = (cells) => {
    const own = new Set(cells.map((cell) => cell.join(",")));
    const rim = [];
    cells.forEach(([c, r]) => {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dc, dr]) => {
        if (!own.has(`${c + dc},${r + dr}`)) {
          rim.push([c + dc, r + dr]);
        }
      });
    });
    return {
      cells,
      rim,
      w: Math.max(...cells.map(([c]) => c)) + 1,
      h: Math.max(...cells.map(([, r]) => r)) + 1
    };
  };

  // Every distinct rotation of every base shape that fits this format's board,
  // grouped so weights stay per shape.
  const SHAPE_SETS = BASE_SHAPES.map((base) => {
    let cells = [];
    base.rows.forEach((line, r) => {
      for (let c = 0; c < line.length; c += 1) {
        if (line[c] === "#") {
          cells.push([c, r]);
        }
      }
    });
    const seen = new Set();
    const variants = [];
    for (let turn = 0; turn < 4; turn += 1) {
      cells = normalize(cells);
      const key = cells.join(";");
      const shape = makeShape(cells);
      const fits = shape.w <= COLS && shape.h <= ROWS && Math.max(shape.w, shape.h) <= LAYOUT.maxLen && cells.length <= LAYOUT.maxCells;
      if (!seen.has(key) && fits) {
        variants.push(shape);
      }
      seen.add(key);
      cells = cells.map(([c, r]) => [-r, c]);
    }
    return { weight: base.weight, variants };
  }).filter((set) => set.variants.length);

  const TOTAL_WEIGHT = SHAPE_SETS.reduce((sum, set) => sum + set.weight, 0);
  const SINGLE = SHAPE_SETS[0].variants[0];

  const randomShape = () => {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (let index = 0; index < SHAPE_SETS.length; index += 1) {
      roll -= SHAPE_SETS[index].weight;
      if (roll <= 0) {
        return pick(SHAPE_SETS[index].variants);
      }
    }
    return SINGLE;
  };

  /* Board rules (pure: they only read the board they are given) */

  const canPlace = (board, shape, col, row) => {
    if (col < 0 || row < 0 || col + shape.w > COLS || row + shape.h > ROWS) {
      return false;
    }
    return shape.cells.every(([c, r]) => board[(row + r) * COLS + col + c] < 0);
  };

  const fitsAnywhere = (board, shape) => {
    for (let row = 0; row <= ROWS - shape.h; row += 1) {
      for (let col = 0; col <= COLS - shape.w; col += 1) {
        if (canPlace(board, shape, col, row)) {
          return true;
        }
      }
    }
    return false;
  };

  const withPiece = (board, shape, col, row) => {
    const next = board.slice();
    shape.cells.forEach(([c, r]) => {
      next[(row + r) * COLS + col + c] = 0;
    });
    return next;
  };

  const findFull = (board) => {
    const rows = [];
    const cols = [];
    for (let r = 0; r < ROWS; r += 1) {
      let full = true;
      for (let c = 0; c < COLS && full; c += 1) {
        full = board[r * COLS + c] >= 0;
      }
      if (full) {
        rows.push(r);
      }
    }
    for (let c = 0; c < COLS; c += 1) {
      let full = true;
      for (let r = 0; r < ROWS && full; r += 1) {
        full = board[r * COLS + c] >= 0;
      }
      if (full) {
        cols.push(c);
      }
    }
    return { rows, cols };
  };

  // Neighbours that are wall or filled: higher means a snugger fit.
  const contact = (board, shape, col, row) => {
    let touching = 0;
    shape.rim.forEach(([c, r]) => {
      const x = col + c;
      const y = row + r;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS || board[y * COLS + x] >= 0) {
        touching += 1;
      }
    });
    return touching;
  };

  // Best spot for a shape: most lines first, then the snuggest fit. null if it fits nowhere.
  const bestSpot = (board, shape) => {
    let best = null;
    for (let row = 0; row <= ROWS - shape.h; row += 1) {
      for (let col = 0; col <= COLS - shape.w; col += 1) {
        if (!canPlace(board, shape, col, row)) {
          continue;
        }
        const full = findFull(withPiece(board, shape, col, row));
        const lines = full.rows.length + full.cols.length;
        const value = lines * 20 + contact(board, shape, col, row) + Math.random();
        if (!best || value > best.value) {
          best = { col, row, lines, value };
        }
      }
    }
    return best;
  };

  // Fair dealer: at least one of the three always fits, and often one can finish a line.
  const dealShapes = (board) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const shapes = [randomShape(), randomShape(), randomShape()];
      if (Math.random() < HELP_CHANCE) {
        for (let tries = 0; tries < 16; tries += 1) {
          const shape = randomShape();
          const spot = bestSpot(board, shape);
          if (spot && spot.lines > 0) {
            shapes[Math.floor(Math.random() * 3)] = shape;
            break;
          }
        }
      }
      if (shapes.some((shape) => fitsAnywhere(board, shape))) {
        return shapes;
      }
    }
    return [SINGLE, SINGLE, SINGLE];
  };

  /* Art */

  const paintBlock = (g, s, color) => {
    const r = s * 0.22;
    roundRect(g, 0.5, 0.5, s - 1, s - 1, r);
    g.fillStyle = shade(color, -0.5);
    g.fill();

    const body = g.createLinearGradient(0, 0, 0, s);
    body.addColorStop(0, shade(color, 0.4));
    body.addColorStop(0.45, color);
    body.addColorStop(1, shade(color, -0.22));
    roundRect(g, 1.2, 1, s - 2.4, s - 3.2, r);
    g.fillStyle = body;
    g.fill();

    const face = g.createLinearGradient(0, s * 0.22, 0, s * 0.74);
    face.addColorStop(0, shade(color, 0.12));
    face.addColorStop(1, shade(color, -0.1));
    roundRect(g, s * 0.21, s * 0.23, s * 0.58, s * 0.5, r * 0.55);
    g.fillStyle = face;
    g.fill();

    roundRect(g, s * 0.15, s * 0.08, s * 0.7, s * 0.18, s * 0.09);
    g.fillStyle = "rgba(255, 255, 255, 0.45)";
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    g.beginPath();
    g.arc(s * 0.25, s * 0.17, s * 0.045, 0, Math.PI * 2);
    g.fill();
  };

  const BLOCK_SPRITES = PALETTE.blocks.map((color) => makeLayer(CELL, CELL, (g) => paintBlock(g, CELL, color)));

  const slotRect = (slot) => (TRAY.stacked
    ? { x: TRAY.x, y: TRAY.y + (slot * TRAY.h) / 3, w: TRAY.w, h: TRAY.h / 3 }
    : { x: TRAY.x + (slot * TRAY.w) / 3, y: TRAY.y, w: TRAY.w / 3, h: TRAY.h });

  const BACKGROUND = makeLayer(WIDTH, HEIGHT, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, PALETTE.bgTop);
    sky.addColorStop(1, PALETTE.bgBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, WIDTH, HEIGHT);

    const cx = BOARD.x + BOARD.w / 2;
    const cy = BOARD.y + BOARD.h / 2;
    const glow = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(BOARD.w, BOARD.h) * 0.9);
    glow.addColorStop(0, PALETTE.glow);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, WIDTH, HEIGHT);

    g.strokeStyle = "rgba(255, 255, 255, 0.025)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = -HEIGHT; x < WIDTH; x += 9) {
      g.moveTo(x, HEIGHT);
      g.lineTo(x + HEIGHT, 0);
    }
    g.stroke();

    if (FORMAT === "popup") {
      roundRect(g, 8, BAR_Y, WIDTH - 16, 4, 2);
      g.fillStyle = "rgba(255, 255, 255, 0.1)";
      g.fill();
    }

    // Bevelled bezel, then the recessed well and its sockets.
    const frame = g.createLinearGradient(0, BOARD.y - FRAME, 0, BOARD.y + BOARD.h + FRAME);
    frame.addColorStop(0, PALETTE.frameTop);
    frame.addColorStop(1, PALETTE.frameBottom);
    roundRect(g, BOARD.x - FRAME, BOARD.y - FRAME, BOARD.w + FRAME * 2, BOARD.h + FRAME * 2, FRAME + 4);
    g.fillStyle = frame;
    g.fill();
    roundRect(g, BOARD.x - 1.5, BOARD.y - 1.5, BOARD.w + 3, BOARD.h + 3, FRAME + 1);
    g.fillStyle = PALETTE.board;
    g.fill();
    const inset = CELL * 0.06;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const x = BOARD.x + col * CELL;
        const y = BOARD.y + row * CELL;
        roundRect(g, x + inset, y + inset, CELL - inset * 2, CELL - inset * 2, CELL * 0.2);
        g.fillStyle = PALETTE.socket;
        g.fill();
        g.fillStyle = PALETTE.socketLip;
        g.fillRect(x + CELL * 0.2, y + CELL - inset - 2, CELL * 0.6, 1);
      }
    }

    roundRect(g, TRAY.x, TRAY.y, TRAY.w, TRAY.h, COMPACT ? 6 : 10);
    g.fillStyle = PALETTE.tray;
    g.fill();
    g.strokeStyle = PALETTE.trayEdge;
    g.stroke();
    const pad = COMPACT ? 2.5 : 4;
    for (let slot = 0; slot < 3; slot += 1) {
      const rect = slotRect(slot);
      roundRect(g, rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2, COMPACT ? 5 : 8);
      g.fillStyle = PALETTE.trayWell;
      g.fill();
    }
  });

  /* State */

  const game = {
    clock: 0,
    board: [],          // COLS * ROWS palette indexes, -1 = empty
    bornAt: [],         // when each filled cell finishes landing (drives the pop)
    tray: [null, null, null],
    trayAnim: [null, null, null],
    drag: null,
    kb: { active: false, slot: 0, col: 0, row: 0, badAt: -1 },
    landing: [],
    clearing: [],
    flashes: [],
    streak: 0,
    dead: false,
    ending: null,
    demo: { wait: DEMO_THINK_S, move: null }
  };

  // A half-built bottom row (plus a half-built side column on taller boards)
  // so the first clears come within a move or two.
  const seedBoard = () => {
    const [rowColor, colColor] = shuffle(PALETTE.blocks.map((_, index) => index));
    const tall = ROWS >= 6;
    const row = ROWS - 1 - (tall ? Math.floor(Math.random() * 2) : 0);
    const rowGap = 1 + Math.floor(Math.random() * (COLS - 3));
    const fill = (r, c, color, order) => {
      game.board[r * COLS + c] = color;
      game.bornAt[r * COLS + c] = game.clock + 0.15 + order * 0.025;
    };
    for (let c = 0; c < COLS; c += 1) {
      if (c !== rowGap && c !== rowGap + 1) {
        fill(row, c, rowColor, c);
      }
    }
    if (tall) {
      const col = Math.random() < 0.5 ? 0 : COLS - 1;
      const colGap = Math.floor(Math.random() * 3);
      for (let r = 0; r < ROWS; r += 1) {
        if ((r < colGap || r > colGap + 2) && r !== row) {
          fill(r, col, colColor, r);
        }
      }
    }
  };

  const dealTray = () => {
    const shapes = dealShapes(game.board);
    const colors = shuffle(PALETTE.blocks.map((_, index) => index));
    game.tray = shapes.map((shape, index) => ({ shape, color: colors[index], dealAt: game.clock + index * 0.07 }));
    game.trayAnim = [null, null, null];
  };

  const resetGame = () => {
    game.board = new Array(COLS * ROWS).fill(-1);
    game.bornAt = new Array(COLS * ROWS).fill(0);
    seedBoard();
    game.drag = null;
    game.kb.active = false;
    game.kb.badAt = -1;
    game.kb.col = Math.floor(COLS / 2) - 1;
    game.kb.row = Math.floor(ROWS / 2) - 1;
    game.landing = [];
    game.clearing = [];
    game.flashes = [];
    game.streak = 0;
    game.dead = false;
    game.ending = null;
    game.demo.wait = DEMO_THINK_S;
    game.demo.move = null;
    dealTray();
  };

  /* Poses: where a piece is drawn ({ left, top, cell }) */

  const restPose = (slot, shape) => {
    const rect = slotRect(slot);
    const cell = Math.min(LAYOUT.trayCell, Math.floor((rect.w - 10) / shape.w), Math.floor((rect.h - 10) / shape.h));
    return { left: rect.x + (rect.w - shape.w * cell) / 2, top: rect.y + (rect.h - shape.h * cell) / 2, cell, alpha: 1 };
  };

  const trayPose = (slot) => {
    const piece = game.tray[slot];
    const rest = restPose(slot, piece.shape);
    const anim = game.trayAnim[slot];
    if (anim) {
      const e = easeOut(clamp((game.clock - anim.t0) / RETURN_S, 0, 1));
      return { left: lerp(anim.left, rest.left, e), top: lerp(anim.top, rest.top, e), cell: lerp(anim.cell, rest.cell, e), alpha: 1 };
    }
    const t = clamp((game.clock - piece.dealAt) / DEAL_S, 0, 1);
    const slide = (1 - easeOutBack(t)) * (COMPACT ? 24 : 56);
    return {
      left: rest.left + (TRAY.stacked || FORMAT === "strip" ? slide : 0),
      top: rest.top + (FORMAT === "rail" ? slide : 0),
      cell: rest.cell,
      alpha: Math.min(1, t * 2)
    };
  };

  const boardPose = (col, row) => ({ left: BOARD.x + col * CELL, top: BOARD.y + row * CELL, cell: CELL, alpha: 1 });

  // Where the finger wants the piece: lifted above a fingertip (less near the
  // bottom edge so the last row stays reachable), centred on a mouse.
  const dragTarget = (drag, shape) => {
    const w = shape.w * CELL;
    const h = shape.h * CELL;
    let top = drag.y - h / 2;
    if (drag.touch) {
      top = drag.y - LAYOUT.lift * clamp((HEIGHT - drag.y) / LAYOUT.liftZone, 0, 1) - h;
    }
    if (LAYOUT.clamp === "both" || (LAYOUT.clamp === "bottom" && drag.touch)) {
      top = Math.min(top, BOARD.y + BOARD.h - h + CELL * 0.4);
    }
    if (LAYOUT.clamp === "both") {
      top = Math.max(top, BOARD.y - CELL * 0.4);
    }
    return { left: drag.x - w / 2, top, cell: CELL, alpha: 1 };
  };

  const dragPose = (drag) => {
    const target = dragTarget(drag, game.tray[drag.slot].shape);
    const e = easeOut(clamp((game.clock - drag.t0) / PICK_S, 0, 1));
    return {
      left: lerp(drag.from.left, target.left, e),
      top: lerp(drag.from.top, target.top, e),
      cell: lerp(drag.from.cell, CELL, e),
      alpha: 1
    };
  };

  const snapSpot = (shape, pose) => {
    const col = Math.round((pose.left - BOARD.x) / CELL);
    const row = Math.round((pose.top - BOARD.y) / CELL);
    return canPlace(game.board, shape, col, row) ? { col, row } : null;
  };

  const demoPose = (move) => {
    const t = easeInOut(clamp((game.clock - move.t0) / DEMO_MOVE_S, 0, 1));
    const to = boardPose(move.col, move.row);
    return {
      left: lerp(move.from.left, to.left, t),
      top: lerp(move.from.top, to.top, t) - Math.sin(t * Math.PI) * (COMPACT ? 8 : 22),
      cell: lerp(move.from.cell, CELL, Math.min(1, t * 2.5)),
      alpha: 1
    };
  };

  /* Moves */

  const boardCenter = () => ({ x: BOARD.x + BOARD.w / 2, y: BOARD.y + BOARD.h / 2 });

  const checkStuck = (scoring) => {
    const left = game.tray.filter(Boolean);
    if (!left.length || left.some((piece) => fitsAnywhere(game.board, piece.shape))) {
      return;
    }
    game.dead = true;
    if (!scoring) {
      game.demo.wait = 1.2;
      return;
    }
    if (!game.ending) {
      game.ending = { at: game.clock + OVER_DELAY_S, won: false };
      floatText(boardCenter().x, boardCenter().y, "No space left!", PALETTE.bad, FONT.callout - 2);
    }
  };

  const placePiece = (slot, col, row, from, scoring) => {
    const piece = game.tray[slot];
    if (!piece || !canPlace(game.board, piece.shape, col, row)) {
      return false;
    }
    const { shape, color } = piece;
    game.tray[slot] = null;
    game.trayAnim[slot] = null;
    const landAt = game.clock + LAND_S;
    shape.cells.forEach(([c, r]) => {
      const index = (row + r) * COLS + col + c;
      game.board[index] = color;
      game.bornAt[index] = landAt;
    });
    game.landing.push({ shape, color, from, to: boardPose(col, row), t0: game.clock });

    const full = findFull(game.board);
    const lines = full.rows.length + full.cols.length;
    const midC = col + shape.w / 2 - 0.5;
    const midR = row + shape.h / 2 - 0.5;
    if (lines) {
      const cleared = new Set();
      full.rows.forEach((r) => {
        game.flashes.push({ row: r, col: -1, at: landAt });
        for (let c = 0; c < COLS; c += 1) {
          cleared.add(r * COLS + c);
        }
      });
      full.cols.forEach((c) => {
        game.flashes.push({ row: -1, col: c, at: landAt });
        for (let r = 0; r < ROWS; r += 1) {
          cleared.add(r * COLS + c);
        }
      });
      // Logic clears now; the overlay plays the sweep outward from the drop.
      cleared.forEach((index) => {
        const r = Math.floor(index / COLS);
        const c = index % COLS;
        game.clearing.push({
          x: BOARD.x + c * CELL,
          y: BOARD.y + r * CELL,
          color: game.board[index],
          showAt: landAt,
          at: landAt + Math.hypot(c - midC, r - midR) * SWEEP_S,
          popped: false
        });
        game.board[index] = -1;
      });
    }

    if (scoring) {
      let points = shape.cells.length;
      if (lines) {
        game.streak += 1;
        points += LINE_POINTS[Math.min(lines, LINE_POINTS.length - 1)] * game.streak;
      } else {
        game.streak = 0;
      }
      setScore(Shell.score + points);
      const margin = COMPACT ? 12 : 24;
      const fx = clamp(BOARD.x + (midC + 0.5) * CELL, BOARD.x + margin, BOARD.x + BOARD.w - margin);
      const fy = clamp(BOARD.y + (midR + 0.5) * CELL, BOARD.y + 8, BOARD.y + BOARD.h - 8);
      floatText(fx, fy, `+${points}`, lines ? PALETTE.gold : PALETTE.text, FONT.points);
      const center = boardCenter();
      const gap = COMPACT ? 8 : 12;
      if (lines >= 2) {
        floatText(center.x, center.y - gap, CALLOUTS[Math.min(lines, 4)], PALETTE.accent, FONT.callout);
        shake();
      }
      if (lines && game.streak >= 2) {
        floatText(center.x, center.y + gap, `Combo x${game.streak}`, PALETTE.gold, FONT.combo);
      }
      if (Shell.score >= CONFIG.goal && !game.ending) {
        game.ending = { at: game.clock + WIN_DELAY_S, won: true };
      }
    }

    if (game.tray.every((slotPiece) => !slotPiece)) {
      dealTray();
    }
    checkStuck(scoring);
    return true;
  };

  const returnToTray = (drag) => {
    game.trayAnim[drag.slot] = { ...dragPose(drag), t0: game.clock };
  };

  const stepEffects = () => {
    const now = game.clock;
    for (let index = game.clearing.length - 1; index >= 0; index -= 1) {
      const cell = game.clearing[index];
      if (!cell.popped && now >= cell.at) {
        cell.popped = true;
        burst(cell.x + CELL / 2, cell.y + CELL / 2, PALETTE.blocks[cell.color], COMPACT ? 3 : 4, COMPACT ? 60 : 80);
      }
      if (now >= cell.at + CLEAR_S) {
        game.clearing.splice(index, 1);
      }
    }
    game.landing = game.landing.filter((land) => now < land.t0 + LAND_S);
    game.flashes = game.flashes.filter((flash) => now < flash.at + FLASH_S);
  };

  /* Attract demo */

  const filledCount = () => game.board.reduce((sum, cell) => sum + (cell >= 0 ? 1 : 0), 0);

  const stepDemo = (dt) => {
    const demo = game.demo;
    if (demo.move) {
      if (game.clock - demo.move.t0 >= DEMO_MOVE_S) {
        const move = demo.move;
        demo.move = null;
        placePiece(move.slot, move.col, move.row, demoPose(move), false);
        demo.wait = DEMO_THINK_S;
      }
      return;
    }
    demo.wait -= dt;
    if (demo.wait > 0) {
      return;
    }
    if (game.dead || filledCount() > DEMO_MAX_FILL) {
      resetGame();
      demo.wait = 0.7;
      return;
    }
    let best = null;
    game.tray.forEach((piece, slot) => {
      if (!piece) {
        return;
      }
      const spot = bestSpot(game.board, piece.shape);
      if (spot && (!best || spot.value > best.value)) {
        best = { ...spot, slot };
      }
    });
    if (!best) {
      game.dead = true;
      demo.wait = 1;
      return;
    }
    demo.move = { slot: best.slot, col: best.col, row: best.row, from: trayPose(best.slot), t0: game.clock };
  };

  /* Loop hooks */

  // Runs only in the play phase.
  const update = (dt) => {
    game.clock += dt;
    stepEffects();
    if (game.ending && game.clock >= game.ending.at) {
      endGame(game.ending.won);
    }
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    game.clock += dt;
    if (game.drag) {
      // The round ended mid-drag: send the piece home.
      returnToTray(game.drag);
      game.drag = null;
    }
    game.kb.active = false;
    stepEffects();
    if (Shell.phase === "intro") {
      stepDemo(dt);
    }
  };

  /* Drawing */

  const drawPiece = (shape, color, pose, alpha = 1) => {
    ctx.globalAlpha = alpha;
    const sprite = BLOCK_SPRITES[color];
    shape.cells.forEach(([c, r]) => {
      ctx.drawImage(sprite, pose.left + c * pose.cell, pose.top + r * pose.cell, pose.cell, pose.cell);
    });
    ctx.globalAlpha = 1;
  };

  const drawLifted = (shape, color, pose) => {
    const drop = COMPACT ? 2 : 4;
    ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
    shape.cells.forEach(([c, r]) => {
      roundRect(ctx, pose.left + c * pose.cell + drop * 0.7, pose.top + r * pose.cell + drop, pose.cell - 1, pose.cell - 1, pose.cell * 0.22);
      ctx.fill();
    });
    drawPiece(shape, color, pose);
  };

  const drawBoard = () => {
    for (let index = 0; index < game.board.length; index += 1) {
      const color = game.board[index];
      if (color < 0 || game.clock < game.bornAt[index]) {
        continue;
      }
      const t = (game.clock - game.bornAt[index]) / POP_S;
      const size = t < 1 && !reduceMotion ? CELL * (1 + 0.14 * Math.sin(t * Math.PI)) : CELL;
      const x = BOARD.x + (index % COLS) * CELL + CELL / 2;
      const y = BOARD.y + Math.floor(index / COLS) * CELL + CELL / 2;
      ctx.drawImage(BLOCK_SPRITES[color], x - size / 2, y - size / 2, size, size);
    }
  };

  // Ghost at the snapped spot, plus the lines it would burst recoloured in the piece color.
  const drawGhost = (shape, color, spot) => {
    const full = findFull(withPiece(game.board, shape, spot.col, spot.row));
    const pulse = 0.75 + Math.sin(game.clock * 12) * 0.15;
    const recolor = (r, c) => {
      if (game.board[r * COLS + c] >= 0) {
        ctx.globalAlpha = pulse;
        ctx.drawImage(BLOCK_SPRITES[color], BOARD.x + c * CELL, BOARD.y + r * CELL, CELL, CELL);
      }
    };
    full.rows.forEach((r) => {
      for (let c = 0; c < COLS; c += 1) {
        recolor(r, c);
      }
    });
    full.cols.forEach((c) => {
      for (let r = 0; r < ROWS; r += 1) {
        recolor(r, c);
      }
    });
    drawPiece(shape, color, boardPose(spot.col, spot.row), 0.4);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    const inset = CELL * 0.06;
    shape.cells.forEach(([c, r]) => {
      roundRect(ctx, BOARD.x + (spot.col + c) * CELL + inset, BOARD.y + (spot.row + r) * CELL + inset, CELL - inset * 2, CELL - inset * 2, CELL * 0.2);
      ctx.stroke();
    });
  };

  const drawFlashes = () => {
    game.flashes.forEach((flash) => {
      const t = (game.clock - flash.at) / FLASH_S;
      if (t < 0) {
        return;
      }
      const grow = (COMPACT ? 1.5 : 3) * t;
      ctx.globalAlpha = (1 - t) * (reduceMotion ? 0.35 : 0.7);
      ctx.fillStyle = "#ffffff";
      if (flash.row >= 0) {
        roundRect(ctx, BOARD.x - grow, BOARD.y + flash.row * CELL - grow, BOARD.w + grow * 2, CELL + grow * 2, CELL * 0.24);
      } else {
        roundRect(ctx, BOARD.x + flash.col * CELL - grow, BOARD.y - grow, CELL + grow * 2, BOARD.h + grow * 2, CELL * 0.24);
      }
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };

  const drawClearing = () => {
    game.clearing.forEach((cell) => {
      if (game.clock < cell.showAt) {
        return;
      }
      const t = clamp((game.clock - cell.at) / CLEAR_S, 0, 1);
      const size = CELL * (1 + 0.2 * t) * (1 - easeOut(t) * 0.95);
      const x = cell.x + CELL / 2 - size / 2;
      const y = cell.y + CELL / 2 - size / 2;
      ctx.globalAlpha = 1 - t * 0.6;
      ctx.drawImage(BLOCK_SPRITES[cell.color], x, y, size, size);
      if (t > 0) {
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, x, y, size, size, size * 0.22);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  };

  const drawLanding = () => {
    game.landing.forEach((land) => {
      const e = easeOut(clamp((game.clock - land.t0) / LAND_S, 0, 1));
      drawPiece(land.shape, land.color, {
        left: lerp(land.from.left, land.to.left, e),
        top: lerp(land.from.top, land.to.top, e),
        cell: lerp(land.from.cell, CELL, e)
      });
    });
  };

  const drawTray = () => {
    const held = game.drag ? game.drag.slot : game.demo.move ? game.demo.move.slot : -1;
    const pad = COMPACT ? 2.5 : 4;
    game.tray.forEach((piece, slot) => {
      if (!piece || slot === held || game.clock < piece.dealAt) {
        return;
      }
      const pose = trayPose(slot);
      const usable = !game.dead && fitsAnywhere(game.board, piece.shape);
      drawPiece(piece.shape, piece.color, pose, pose.alpha * (usable ? 1 : 0.32));
      if (game.kb.active && game.kb.slot === slot) {
        const rect = slotRect(slot);
        ctx.strokeStyle = PALETTE.accent;
        ctx.lineWidth = COMPACT ? 1.5 : 2;
        roundRect(ctx, rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2, COMPACT ? 5 : 8);
        ctx.stroke();
      }
    });
  };

  const drawKeyboardPiece = () => {
    const kb = game.kb;
    const piece = game.tray[kb.slot];
    if (!kb.active || !piece || game.drag) {
      return;
    }
    const valid = canPlace(game.board, piece.shape, kb.col, kb.row);
    if (valid) {
      drawGhost(piece.shape, piece.color, kb);
    }
    const pose = boardPose(kb.col, kb.row);
    drawPiece(piece.shape, piece.color, pose, valid ? 0.85 : 0.45);
    const bad = !valid || game.clock - kb.badAt < 0.3;
    ctx.strokeStyle = bad ? PALETTE.bad : "#ffffff";
    ctx.lineWidth = COMPACT ? 1.5 : 2;
    roundRect(ctx, pose.left - 1, pose.top - 1, piece.shape.w * CELL + 2, piece.shape.h * CELL + 2, CELL * 0.24);
    ctx.stroke();
  };

  const drawHeld = () => {
    const drag = game.drag;
    if (drag) {
      const piece = game.tray[drag.slot];
      const spot = snapSpot(piece.shape, dragTarget(drag, piece.shape));
      if (spot) {
        drawGhost(piece.shape, piece.color, spot);
      }
      drawLifted(piece.shape, piece.color, dragPose(drag));
      return;
    }
    const move = game.demo.move;
    if (move && game.tray[move.slot]) {
      const piece = game.tray[move.slot];
      const pose = demoPose(move);
      drawLifted(piece.shape, piece.color, pose);
      // A soft "finger" so the demo reads as a drag.
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(pose.left + (piece.shape.w * pose.cell) / 2, pose.top + piece.shape.h * pose.cell + (COMPACT ? 5 : 12), COMPACT ? 4 : 8, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawProgress = () => {
    const t = clamp(Shell.score / CONFIG.goal, 0, 1);
    if (FORMAT !== "popup" || t <= 0) {
      return;
    }
    const w = (WIDTH - 16) * t;
    const bar = ctx.createLinearGradient(8, 0, 8 + w, 0);
    bar.addColorStop(0, PALETTE.accent);
    bar.addColorStop(1, PALETTE.gold);
    roundRect(ctx, 8, BAR_Y, Math.max(4, w), 4, 2);
    ctx.fillStyle = bar;
    ctx.fill();
  };

  const draw = () => {
    ctx.drawImage(BACKGROUND, 0, 0, WIDTH, HEIGHT);
    drawProgress();
    drawBoard();
    drawKeyboardPiece();
    drawFlashes();
    drawClearing();
    drawLanding();
    if (game.dead) {
      ctx.fillStyle = "rgba(7, 11, 36, 0.45)";
      ctx.fillRect(BOARD.x - 2, BOARD.y - 2, BOARD.w + 4, BOARD.h + 4);
    }
    drawTray();
    drawHeld();
    drawFx();
  };

  /* Input */

  const slotAt = (point) => {
    if (point.x < TRAY.x - 6 || point.x > TRAY.x + TRAY.w + 6 || point.y < TRAY.y - 6 || point.y > TRAY.y + TRAY.h + 6) {
      return -1;
    }
    const along = TRAY.stacked ? (point.y - TRAY.y) / TRAY.h : (point.x - TRAY.x) / TRAY.w;
    return clamp(Math.floor(along * 3), 0, 2);
  };

  const onPointerDown = (point, event) => {
    if (game.drag || game.ending) {
      return;
    }
    const slot = slotAt(point);
    const piece = slot >= 0 ? game.tray[slot] : null;
    if (!piece || game.clock < piece.dealAt) {
      return;
    }
    game.kb.active = false;
    game.drag = {
      slot,
      x: point.x,
      y: point.y,
      id: event ? event.pointerId : 0,
      touch: !event || event.pointerType !== "mouse",
      from: trayPose(slot),
      t0: game.clock
    };
    game.trayAnim[slot] = null;
  };

  const onPointerUp = (point, event) => {
    const drag = game.drag;
    if (!drag || (event && event.pointerId !== drag.id)) {
      return;
    }
    game.drag = null;
    drag.x = point.x;
    drag.y = point.y;
    const piece = game.tray[drag.slot];
    const cancelled = game.ending || (event && event.type === "pointercancel");
    const spot = cancelled ? null : snapSpot(piece.shape, dragTarget(drag, piece.shape));
    if (spot) {
      placePiece(drag.slot, spot.col, spot.row, dragPose(drag), true);
    } else {
      returnToTray(drag);
    }
  };

  const onPointerMove = (point, event) => {
    const drag = game.drag;
    if (!drag || (event && event.pointerId !== drag.id)) {
      return;
    }
    drag.x = point.x;
    drag.y = point.y;
    // A mouse released outside the page never sends pointerup.
    if (event && event.pointerType === "mouse" && event.buttons === 0) {
      onPointerUp(point, event);
    }
  };

  const KB_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter", "Tab", "1", "2", "3", "q", "e"];

  const clampCursor = () => {
    const piece = game.tray[game.kb.slot];
    if (piece) {
      game.kb.col = clamp(game.kb.col, 0, COLS - piece.shape.w);
      game.kb.row = clamp(game.kb.row, 0, ROWS - piece.shape.h);
    }
  };

  const selectSlot = (start, step) => {
    for (let offset = 0; offset < 3; offset += 1) {
      const slot = (start + step * offset + 9) % 3;
      if (game.tray[slot]) {
        game.kb.slot = slot;
        clampCursor();
        return;
      }
    }
  };

  // Keyboard play: Tab / Q / E / 1-3 pick a piece, arrows move it, Space or Enter drops it.
  const onKey = (key, down) => {
    const handled = KB_KEYS.includes(key);
    if (!down || !handled) {
      return handled;
    }
    const kb = game.kb;
    if (game.ending || game.drag) {
      return true;
    }
    if (!kb.active) {
      kb.active = true;
      selectSlot(kb.slot, 1);
      // Arrows and Space only reveal the cursor on the first press; piece keys act at once.
      if (key === " " || key === "Enter" || key.startsWith("Arrow")) {
        return true;
      }
    }
    if (key === "Tab" || key === "e") {
      selectSlot(kb.slot + 1, 1);
    } else if (key === "q") {
      selectSlot(kb.slot - 1, -1);
    } else if (key === "1" || key === "2" || key === "3") {
      selectSlot(Number(key) - 1, 1);
    } else if (key === "ArrowLeft") {
      kb.col -= 1;
    } else if (key === "ArrowRight") {
      kb.col += 1;
    } else if (key === "ArrowUp") {
      kb.row -= 1;
    } else if (key === "ArrowDown") {
      kb.row += 1;
    } else if (game.tray[kb.slot]) {
      if (!placePiece(kb.slot, kb.col, kb.row, trayPose(kb.slot), true)) {
        kb.badAt = game.clock;
      }
      selectSlot(kb.slot, 1);
    }
    clampCursor();
    return true;
  };

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
