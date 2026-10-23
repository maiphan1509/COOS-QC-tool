(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-line-drop",          // CustomEvent namespace
    api: "mgLineDrop",                    // window.<api> handle
    campaign: "velto-watch-4",
    offer: "−25%",
    winTitle: "Lines cleared!",
    loseTitle: "So close!",
    goal: 5,                              // lines to clear for a win (not points); set per format below
    maxPlayMs: 55000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    bgTop: "#07282d",
    bgBottom: "#020c0f",
    panel: "rgba(6, 40, 46, 0.78)",
    panelEdge: "rgba(110, 255, 225, 0.22)",
    box: "rgba(1, 14, 17, 0.75)",
    frameTop: "#2a8f8a",
    frameBottom: "#0f3d3f",
    well: "#020e11",
    grid: "rgba(120, 255, 230, 0.06)",
    // I, O, T, S, Z, J, L, then the pre-filled rows
    pieces: ["#2ee6f0", "#ffd23f", "#b46bff", "#5ce65c", "#ff4f6a", "#3f7dff", "#ff9a3c", "#5f7f86"],
    accent: "#b6ff3b",
    text: "#eafffb",
    textDim: "rgba(170, 230, 220, 0.62)",
    bad: "#ff4f6a"
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

  // Well and pacing per format. The strip lays the well on its side: pieces
  // fall right to left into a 5-wide, 28-long well, so lines are short and
  // the drop is long (faster gravity, more lines to win).
  const LAYOUT = {
    popup: {
      cols: 10, rows: 20, cell: 11, rotated: false, garbage: 4, goal: 5, time: 55000,
      gravity: [0.32, 0.03, 0.1], dragX: 13, dragY: 12, flick: 22, slop: 7
    },
    rail: {
      cols: 10, rows: 20, cell: 9, rotated: false, garbage: 4, goal: 5, time: 55000,
      gravity: [0.32, 0.03, 0.1], dragX: 11, dragY: 10, flick: 18, slop: 6
    },
    strip: {
      cols: 5, rows: 28, cell: 10, rotated: true, garbage: 3, goal: 8, time: 50000,
      gravity: [0.15, 0.01, 0.06], dragX: 11, dragY: 10, flick: 16, slop: 6
    }
  }[FORMAT];

  CONFIG.goal = LAYOUT.goal;
  CONFIG.maxPlayMs = LAYOUT.time;

  const COLS = LAYOUT.cols;
  const ROWS = LAYOUT.rows;
  const HIDDEN = 2;             // spawn rows beyond the visible well
  const TOTAL = ROWS + HIDDEN;
  const CELL = LAYOUT.cell;
  const ROTATED = LAYOUT.rotated;
  const COMPACT = FORMAT !== "popup";

  // Well size in its own (unrotated) coordinates, and its rect on screen.
  const WELL_W = COLS * CELL;
  const WELL_H = ROWS * CELL;
  const WELL = {
    popup: { x: 95, y: 15 },
    rail: { x: (WIDTH - WELL_W) / 2, y: SAFE.y + 3 },
    strip: { x: SAFE.x + 4, y: (HEIGHT - WELL_W) / 2 }
  }[FORMAT];
  WELL.w = ROTATED ? WELL_H : WELL_W;
  WELL.h = ROTATED ? WELL_W : WELL_H;

  // Well coordinates -> screen. Rotated, "down" points left and "right" points down.
  const WELL_MATRIX = ROTATED ? [0, 1, -1, 0, WELL.x + WELL.w, WELL.y] : [1, 0, 0, 1, WELL.x, WELL.y];
  const toScreen = (x, y) => ({
    x: WELL_MATRIX[0] * x + WELL_MATRIX[2] * y + WELL_MATRIX[4],
    y: WELL_MATRIX[1] * x + WELL_MATRIX[3] * y + WELL_MATRIX[5]
  });

  // Popup side panels; the rail and strip keep score, lines and time in the HUD.
  const PANEL_W = 82;
  const LEFT_X = 6;
  const RIGHT_X = WIDTH - 6 - PANEL_W;
  const LEFT_CX = LEFT_X + PANEL_W / 2;
  const RIGHT_CX = RIGHT_X + PANEL_W / 2;

  // Upcoming-piece previews: a column in the popup, a row under the rail's
  // well, a box after the strip's well.
  const NEXT_BOX = {
    popup: null,
    rail: { x: 2, y: WELL.y + WELL.h + 3, w: WIDTH - 4, h: HEIGHT - (WELL.y + WELL.h + 3) - 2 },
    strip: { x: WELL.x + WELL.w + 5, y: 2, w: SAFE.x + SAFE.w - (WELL.x + WELL.w + 5) - 2, h: HEIGHT - 4 }
  }[FORMAT];
  const NEXT = {
    popup: () => [{ x: RIGHT_CX, y: 54, cell: 10 }, { x: RIGHT_CX, y: 95, cell: 7 }, { x: RIGHT_CX, y: 129, cell: 7 }],
    rail: () => [
      { x: 42, y: NEXT_BOX.y + NEXT_BOX.h / 2, cell: 5 },
      { x: 66, y: NEXT_BOX.y + NEXT_BOX.h / 2, cell: 4 },
      { x: 86, y: NEXT_BOX.y + NEXT_BOX.h / 2, cell: 4 }
    ],
    strip: () => [
      { x: NEXT_BOX.x + NEXT_BOX.w * 0.3, y: NEXT_BOX.y + NEXT_BOX.h * 0.6, cell: 5 },
      { x: NEXT_BOX.x + NEXT_BOX.w * 0.73, y: NEXT_BOX.y + NEXT_BOX.h * 0.6, cell: 4 }
    ]
  }[FORMAT]();

  const FONT = {
    label: COMPACT ? 7 : 8,
    points: COMPACT ? 9 : 12,
    callout: COMPACT ? 12 : 18,
    combo: COMPACT ? 10 : 14
  };

  const GOAL_LINES = CONFIG.goal;
  const GARBAGE_ROWS = LAYOUT.garbage;
  const GARBAGE = 7;            // palette index of pre-filled cells
  const [GRAVITY_START_S, GRAVITY_STEP_S, GRAVITY_MIN_S] = LAYOUT.gravity;
  const SOFT_DROP_S = 0.035;
  const LOCK_DELAY_S = 0.4;
  const LOCK_RESETS = 12;
  const DAS_S = 0.16;
  const ARR_S = 0.05;
  const CLEAR_S = 0.3;
  const COLLAPSE_S = 0.14;
  const SPIN_S = 0.09;
  const TRAIL_S = 0.2;
  const LOCK_FLASH_S = 0.16;
  const TOPOUT_S = 0.6;
  const DRAG_STEP_X = LAYOUT.dragX;   // finger travel per column
  const DRAG_STEP_Y = LAYOUT.dragY;   // slow pull per soft-drop row
  const TAP_SLOP = LAYOUT.slop;
  const TAP_MS = 280;
  const FLICK_WINDOW_MS = 90;
  const FLICK_SPEED = 0.55;     // px per ms along the fall that reads as a hard-drop swipe
  const FLICK_MIN = LAYOUT.flick;
  const WIN_DELAY_S = 0.45;
  const OVER_DELAY_S = 1;
  const LINE_POINTS = [0, 100, 300, 500, 800];
  const COMBO_POINTS = 50;
  const CALLOUTS = ["", "", "Double!", "Triple!", "Quad!"];
  const DEMO_STEP_S = 0.09;
  const DEMO_MAX_HEIGHT = Math.round(ROWS * 0.65);

  // Keys per format: the strip's fall runs right to left, so up/down steer and left drops.
  const KEYMAP = ROTATED
    ? { ArrowUp: "left", ArrowDown: "right", ArrowLeft: "soft", ArrowRight: "rotate", x: "rotate", z: "back", " ": "drop" }
    : { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "soft", ArrowUp: "rotate", x: "rotate", z: "back", " ": "drop" };

  const I = 0;
  const O = 1;

  // Spawn orientation of each piece inside its rotation box (SRS layout).
  const PIECES = [
    { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }
  ].map((piece) => {
    const rots = [piece.cells];
    for (let turn = 1; turn < 4; turn += 1) {
      rots.push(rots[turn - 1].map(([x, y]) => [piece.size - 1 - y, x]));
    }
    const xs = piece.cells.map(([x]) => x);
    const ys = piece.cells.map(([, y]) => y);
    const bounds = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
    return { size: piece.size, rots, bounds };
  });

  // SRS wall kicks with y pointing down, keyed "from" + "to" rotation state.
  const KICKS = {
    "01": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "10": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "12": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "21": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "23": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "32": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "30": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "03": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  };
  const KICKS_I = {
    "01": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "10": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "12": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    "21": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "23": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    "32": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    "30": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    "03": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const easeIn = (t) => t * t;
  const shuffle = (list) => {
    for (let index = list.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [list[index], list[other]] = [list[other], list[index]];
    }
    return list;
  };

  const rgb = (hex) => {
    const value = parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const shade = (hex, amount) => {
    const target = amount < 0 ? 0 : 255;
    const [r, g, b] = rgb(hex).map((channel) => Math.round(lerp(channel, target, Math.abs(amount))));
    return `rgb(${r}, ${g}, ${b})`;
  };
  const alpha = (hex, a) => `rgba(${rgb(hex).join(", ")}, ${a})`;

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

  /* Board rules (pure: they only read the board they are given) */

  const emptyRow = () => new Array(COLS).fill(-1);
  const emptyBoard = () => Array.from({ length: TOTAL }, emptyRow);

  const collides = (board, type, rot, x, y) => PIECES[type].rots[rot].some(([cx, cy]) => {
    const gx = x + cx;
    const gy = y + cy;
    return gx < 0 || gx >= COLS || gy >= TOTAL || (gy >= 0 && board[gy][gx] >= 0);
  });

  // SRS rotation: first kick offset that fits wins. Returns { rot, x, y } or null.
  const rotated = (board, piece, dir) => {
    if (piece.type === O) {
      return null;
    }
    const to = (piece.rot + dir + 4) % 4;
    const kicks = (piece.type === I ? KICKS_I : KICKS)[`${piece.rot}${to}`];
    for (let index = 0; index < kicks.length; index += 1) {
      const [dx, dy] = kicks[index];
      if (!collides(board, piece.type, to, piece.x + dx, piece.y + dy)) {
        return { rot: to, x: piece.x + dx, y: piece.y + dy };
      }
    }
    return null;
  };

  const dropDistance = (board, type, rot, x, y) => {
    let distance = 0;
    while (!collides(board, type, rot, x, y + distance + 1)) {
      distance += 1;
    }
    return distance;
  };

  const fullRows = (board) => {
    const rows = [];
    board.forEach((row, index) => {
      if (row.every((cell) => cell >= 0)) {
        rows.push(index);
      }
    });
    return rows;
  };

  // Board without `rows`, topped up with empty rows; `fell` = rows each kept row dropped.
  const collapseRows = (board, rows) => {
    const kept = [];
    const fell = [];
    let below = 0;
    for (let index = TOTAL - 1; index >= 0; index -= 1) {
      if (rows.includes(index)) {
        below += 1;
      } else {
        kept.unshift(board[index]);
        fell.unshift(below);
      }
    }
    while (kept.length < TOTAL) {
      kept.unshift(emptyRow());
      fell.unshift(0);
    }
    return { board: kept, fell };
  };

  // Pre-filled rows shaped like a skyline with one open well, so no row starts full
  // and the first long piece can clear several at once.
  const addGarbage = (board) => {
    const well = Math.floor(Math.random() * COLS);
    const heights = [GARBAGE_ROWS - 2, GARBAGE_ROWS - 1, GARBAGE_ROWS, GARBAGE_ROWS, GARBAGE_ROWS];
    for (let col = 0; col < COLS; col += 1) {
      const height = col === well ? 0 : heights[Math.floor(Math.random() * heights.length)];
      for (let k = 0; k < height; k += 1) {
        board[TOTAL - 1 - k][col] = GARBAGE;
      }
    }
  };

  const spawnX = (type) => Math.floor((COLS - PIECES[type].size) / 2);

  const columnHeights = (board) => {
    const heights = [];
    for (let col = 0; col < COLS; col += 1) {
      let row = 0;
      while (row < TOTAL && board[row][col] < 0) {
        row += 1;
      }
      heights.push(TOTAL - row);
    }
    return heights;
  };

  // Attract-mode placement score: lines good; height, holes and bumps bad.
  const evaluate = (board, lines) => {
    const heights = columnHeights(board);
    let holes = 0;
    let bumps = 0;
    heights.forEach((height, col) => {
      for (let row = TOTAL - height + 1; row < TOTAL; row += 1) {
        if (board[row][col] < 0) {
          holes += 1;
        }
      }
      if (col > 0) {
        bumps += Math.abs(height - heights[col - 1]);
      }
    });
    const total = heights.reduce((sum, height) => sum + height, 0);
    return lines * 0.76 - total * 0.51 - holes * 0.36 - bumps * 0.18;
  };

  const planMove = (board, type, y) => {
    let best = null;
    for (let rot = 0; rot < 4; rot += 1) {
      for (let x = -2; x < COLS; x += 1) {
        if (collides(board, type, rot, x, y)) {
          continue;
        }
        const land = y + dropDistance(board, type, rot, x, y);
        const test = board.map((row) => row.slice());
        PIECES[type].rots[rot].forEach(([cx, cy]) => {
          if (land + cy >= 0) {
            test[land + cy][x + cx] = type;
          }
        });
        const rows = fullRows(test);
        const value = evaluate(collapseRows(test, rows).board, rows.length);
        if (!best || value > best.value) {
          best = { rot, x, value };
        }
      }
    }
    return best;
  };

  /* Art */

  const paintCell = (g, s, color) => {
    if (ROTATED) {
      // Drawn inside the turned well, so pre-turn it back to keep the light on top.
      g.translate(s / 2, s / 2);
      g.rotate(-Math.PI / 2);
      g.translate(-s / 2, -s / 2);
    }
    roundRect(g, 0.2, 0.2, s - 0.4, s - 0.4, s * 0.2);
    g.fillStyle = shade(color, -0.55);
    g.fill();
    const body = g.createLinearGradient(0, 0, 0, s);
    body.addColorStop(0, shade(color, 0.38));
    body.addColorStop(0.5, color);
    body.addColorStop(1, shade(color, -0.2));
    roundRect(g, 0.8, 0.7, s - 1.6, s - 1.9, s * 0.16);
    g.fillStyle = body;
    g.fill();
    const face = g.createLinearGradient(0, s * 0.3, 0, s * 0.72);
    face.addColorStop(0, shade(color, 0.1));
    face.addColorStop(1, shade(color, -0.12));
    roundRect(g, s * 0.26, s * 0.3, s * 0.48, s * 0.4, 1);
    g.fillStyle = face;
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.5)";
    roundRect(g, s * 0.15, s * 0.12, s * 0.7, s * 0.14, s * 0.07);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    g.fillRect(s * 0.18, s * 0.18, s * 0.11, s * 0.11);
  };

  const SPRITES = PALETTE.pieces.map((color) => makeLayer(CELL, CELL, (g) => paintCell(g, CELL, color)));

  const label = (g, text, x, y, size = 8, color = PALETTE.textDim, align = "center") => {
    g.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    g.textAlign = align;
    g.textBaseline = "middle";
    g.fillStyle = color;
    g.fillText(text, x, y);
  };

  const paintWatch = (g, cx, cy) => {
    g.fillStyle = "#123c40";
    roundRect(g, cx - 9, cy - 22, 18, 44, 6);
    g.fill();
    const bezel = g.createLinearGradient(0, cy - 14, 0, cy + 14);
    bezel.addColorStop(0, "#9fd8d2");
    bezel.addColorStop(1, "#2f6f6c");
    roundRect(g, cx - 14, cy - 14, 28, 28, 8);
    g.fillStyle = bezel;
    g.fill();
    roundRect(g, cx - 12, cy - 12, 24, 24, 6.5);
    g.fillStyle = "#03151a";
    g.fill();
    g.lineWidth = 2.2;
    g.lineCap = "round";
    [[8, PALETTE.accent, 1.5], [5, "#2ee6f0", 1.1]].forEach(([radius, color, sweep]) => {
      g.strokeStyle = alpha(color, 0.22);
      g.beginPath();
      g.arc(cx, cy, radius, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = color;
      g.beginPath();
      g.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * sweep);
      g.stroke();
    });
    g.fillStyle = "rgba(255, 255, 255, 0.18)";
    roundRect(g, cx - 11, cy - 11, 22, 7, 4);
    g.fill();
  };

  const BACKGROUND = makeLayer(WIDTH, HEIGHT, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, PALETTE.bgTop);
    sky.addColorStop(1, PALETTE.bgBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle = "rgba(0, 0, 0, 0.12)";
    for (let y = 0; y < HEIGHT; y += 3) {
      g.fillRect(0, y, WIDTH, 1);
    }

    if (FORMAT === "popup") {
      [LEFT_X, RIGHT_X].forEach((x) => {
        roundRect(g, x, WELL.y, PANEL_W, WELL.h, 8);
        g.fillStyle = PALETTE.panel;
        g.fill();
        g.strokeStyle = PALETTE.panelEdge;
        g.lineWidth = 1;
        g.stroke();
      });
    }

    const frameW = COMPACT ? 2 : 3;
    const frame = g.createLinearGradient(0, WELL.y - frameW, 0, WELL.y + WELL.h + frameW);
    frame.addColorStop(0, PALETTE.frameTop);
    frame.addColorStop(1, PALETTE.frameBottom);
    roundRect(g, WELL.x - frameW, WELL.y - frameW, WELL.w + frameW * 2, WELL.h + frameW * 2, frameW + 1);
    g.fillStyle = frame;
    g.fill();
    g.fillStyle = PALETTE.well;
    g.fillRect(WELL.x, WELL.y, WELL.w, WELL.h);
    g.fillStyle = PALETTE.grid;
    for (let x = CELL; x < WELL.w - 0.5; x += CELL) {
      g.fillRect(WELL.x + x, WELL.y, 1, WELL.h);
    }
    for (let y = CELL; y < WELL.h - 0.5; y += CELL) {
      g.fillRect(WELL.x, WELL.y + y, WELL.w, 1);
    }
    if (ROTATED) {
      // A faint glow where pieces enter, so the direction of fall reads at a glance.
      const entry = g.createLinearGradient(WELL.x + WELL.w - CELL * 3, 0, WELL.x + WELL.w, 0);
      entry.addColorStop(0, "rgba(182, 255, 59, 0)");
      entry.addColorStop(1, "rgba(182, 255, 59, 0.12)");
      g.fillStyle = entry;
      g.fillRect(WELL.x + WELL.w - CELL * 3, WELL.y, CELL * 3, WELL.h);
    }

    if (NEXT_BOX) {
      roundRect(g, NEXT_BOX.x, NEXT_BOX.y, NEXT_BOX.w, NEXT_BOX.h, 5);
      g.fillStyle = PALETTE.panel;
      g.fill();
      g.strokeStyle = PALETTE.panelEdge;
      g.lineWidth = 1;
      g.stroke();
      if (FORMAT === "rail") {
        label(g, "NEXT", NEXT_BOX.x + 4, NEXT_BOX.y + NEXT_BOX.h / 2, FONT.label, PALETTE.textDim, "left");
      } else {
        label(g, "NEXT", NEXT_BOX.x + NEXT_BOX.w / 2, 9, FONT.label);
      }
      return;
    }

    // Popup panels: brand, stat labels, control hints, queue boxes, product mark.
    label(g, "VELTO", LEFT_CX, 29, 14, PALETTE.accent);
    label(g, "WATCH 4", LEFT_CX, 42, 8, PALETTE.text);
    g.fillStyle = PALETTE.panelEdge;
    g.fillRect(LEFT_X + 10, 52, PANEL_W - 20, 1);
    label(g, "SCORE", LEFT_CX, 62);
    label(g, "LINES", LEFT_CX, 96);
    label(g, "TIME", LEFT_CX, 142);
    g.fillRect(LEFT_X + 10, 172, PANEL_W - 20, 1);
    [["TAP", "rotate", 188], ["DRAG", "move", 203], ["SWIPE ↓", "drop", 218]].forEach(([key, action, y]) => {
      label(g, key, LEFT_CX + 2, y, 8, PALETTE.accent, "right");
      label(g, action, LEFT_CX + 6, y, 8, PALETTE.text, "left");
    });
    label(g, "NEXT", RIGHT_CX, 26);
    [[34, 40], [80, 30], [114, 30]].forEach(([y, h]) => {
      roundRect(g, RIGHT_X + 8, y, PANEL_W - 16, h, 6);
      g.fillStyle = PALETTE.box;
      g.fill();
    });
    label(g, "LEVEL", RIGHT_CX, 160);
    paintWatch(g, RIGHT_CX, 206);
  });

  /* State */

  const linesValue = document.getElementById("linesValue");
  const howto = document.getElementById("howto");

  // The shared intro copy says "swipe down"; the strip's well falls to the left.
  if (howto && ROTATED) {
    howto.textContent = `Clear ${GOAL_LINES} lines! Drag up/down to move, tap to rotate, flick left to drop`;
  }

  const game = {
    clock: 0,
    board: emptyBoard(),
    bag: [],
    queue: [],
    piece: null,          // { type, rot, x, y } in grid cells, vx/vy = drawn position
    fallTimer: 0,
    lockTimer: 0,
    lockResets: 0,
    lowestY: 0,
    lines: 0,
    combo: -1,
    clearing: null,       // { rows, t0 } while the clear flash plays
    fell: null,           // rows each board row dropped in the last collapse
    collapseAt: -1,
    trails: [],
    flashes: [],
    held: { left: false, right: false, soft: false },
    das: { dir: 0, timer: 0, charged: false },
    touch: null,
    toppedAt: -1,
    ending: null,
    demo: { piece: null, plan: null, timer: 0, resetAt: -1 }
  };

  const releaseKeys = () => {
    game.held.left = false;
    game.held.right = false;
    game.held.soft = false;
    game.das.dir = 0;
  };

  // Keys held while focus leaves the ad never send keyup.
  ad.addEventListener("blur", releaseKeys);

  const addScore = (points) => {
    if (Shell.phase === "play" && points > 0) {
      setScore(Shell.score + points);
    }
  };

  const showLines = () => {
    if (linesValue) {
      linesValue.textContent = String(Math.min(game.lines, GOAL_LINES));
    }
  };

  const gravity = () => Math.max(GRAVITY_MIN_S, GRAVITY_START_S - game.lines * GRAVITY_STEP_S);

  const fillQueue = () => {
    while (game.queue.length < 4) {
      if (!game.bag.length) {
        game.bag = shuffle([0, 1, 2, 3, 4, 5, 6]);
      }
      game.queue.push(game.bag.pop());
    }
  };

  // Where callouts float: over the well's middle, inside the canvas.
  const calloutAt = (offset) => (ROTATED
    ? { x: WELL.x + WELL.w * 0.45, y: HEIGHT / 2 + offset * 0.6 }
    : { x: WELL.x + WELL.w / 2, y: clamp(WELL.y + WELL.h * 0.3 + offset, WELL.y + 10, WELL.y + WELL.h - 10) });

  const topOut = () => {
    game.piece = null;
    game.toppedAt = game.clock;
    if (Shell.phase !== "play") {
      game.demo.resetAt = game.clock + 1;
      return;
    }
    if (!game.ending) {
      game.ending = { at: game.clock + OVER_DELAY_S, won: false };
      const at = calloutAt(0);
      floatText(at.x, at.y, "Topped out!", PALETTE.bad, FONT.callout);
    }
  };

  const spawn = () => {
    fillQueue();
    const type = game.queue.shift();
    fillQueue();
    const piece = { type, rot: 0, x: spawnX(type), y: HIDDEN - 1, spinAt: -1, spinDir: 0 };
    piece.vx = piece.x;
    piece.vy = piece.y - 1.5;
    game.fallTimer = 0;
    game.lockTimer = 0;
    game.lockResets = 0;
    game.lowestY = piece.y;
    if (collides(game.board, type, 0, piece.x, piece.y)) {
      topOut();
      return;
    }
    game.piece = piece;
  };

  const resetGame = () => {
    game.board = emptyBoard();
    addGarbage(game.board);
    game.bag = [];
    game.queue = [];
    game.piece = null;
    game.lines = 0;
    game.combo = -1;
    game.clearing = null;
    game.fell = null;
    game.collapseAt = -1;
    game.trails = [];
    game.flashes = [];
    releaseKeys();
    game.touch = null;
    game.toppedAt = -1;
    game.ending = null;
    game.demo.piece = null;
    game.demo.plan = null;
    game.demo.resetAt = -1;
    showLines();
    spawn();
  };

  /* Moves */

  const grounded = () => {
    const p = game.piece;
    return !!p && collides(game.board, p.type, p.rot, p.x, p.y + 1);
  };

  // Moving or rotating on the floor buys more lock time, up to LOCK_RESETS times.
  const nudgeLock = () => {
    if (game.lockResets < LOCK_RESETS && grounded()) {
      game.lockTimer = 0;
      game.lockResets += 1;
    }
  };

  const markLowest = () => {
    if (game.piece.y > game.lowestY) {
      game.lowestY = game.piece.y;
      game.lockResets = 0;
      game.lockTimer = 0;
    }
  };

  const shift = (dx) => {
    const p = game.piece;
    if (!p || collides(game.board, p.type, p.rot, p.x + dx, p.y)) {
      return false;
    }
    p.x += dx;
    nudgeLock();
    return true;
  };

  const rotate = (dir) => {
    const p = game.piece;
    const next = p ? rotated(game.board, p, dir) : null;
    if (!next) {
      return false;
    }
    p.rot = next.rot;
    p.x = next.x;
    p.y = next.y;
    p.spinAt = game.clock;
    p.spinDir = dir;
    markLowest();
    nudgeLock();
    return true;
  };

  const stepDown = (soft) => {
    const p = game.piece;
    if (!p || collides(game.board, p.type, p.rot, p.x, p.y + 1)) {
      return false;
    }
    p.y += 1;
    if (soft) {
      addScore(1);
    }
    markLowest();
    return true;
  };

  const softStep = () => {
    if (stepDown(true)) {
      game.fallTimer = 0;
    }
  };

  const rowCenter = (row) => toScreen(WELL_W / 2, (row - HIDDEN + 0.5) * CELL);

  const lockPiece = () => {
    const p = game.piece;
    game.piece = null;
    let hidden = true;
    PIECES[p.type].rots[p.rot].forEach(([cx, cy]) => {
      const gx = p.x + cx;
      const gy = p.y + cy;
      if (gy >= 0) {
        game.board[gy][gx] = p.type;
      }
      if (gy >= HIDDEN) {
        hidden = false;
      }
      game.flashes.push({ x: gx, y: gy, t0: game.clock });
    });
    if (hidden) {
      topOut();
      return;
    }
    const rows = fullRows(game.board);
    if (!rows.length) {
      game.combo = -1;
      spawn();
      return;
    }
    game.combo += 1;
    game.lines += rows.length;
    showLines();
    game.clearing = { rows, t0: game.clock };
    rows.forEach((row) => {
      for (let col = 0; col < COLS; col += 2) {
        const at = toScreen((col + 1) * CELL, (row - HIDDEN + 0.5) * CELL);
        burst(at.x, at.y, PALETTE.pieces[game.board[row][col]], 3, COMPACT ? 55 : 70);
      }
    });
    if (Shell.phase !== "play") {
      return;
    }
    const points = LINE_POINTS[Math.min(rows.length, 4)] + COMBO_POINTS * game.combo;
    addScore(points);
    const at = rowCenter(rows[0]);
    floatText(clamp(at.x, WELL.x + 14, WELL.x + WELL.w - 14), clamp(at.y, WELL.y + 8, WELL.y + WELL.h - 8), `+${points}`, PALETTE.accent, FONT.points);
    if (rows.length >= 2) {
      const callout = calloutAt(-12);
      floatText(callout.x, callout.y, CALLOUTS[Math.min(rows.length, 4)], PALETTE.accent, FONT.callout);
      shake();
    }
    if (game.combo >= 1) {
      const combo = calloutAt(12);
      floatText(combo.x, combo.y, `Combo x${game.combo + 1}`, "#2ee6f0", FONT.combo);
    }
    if (game.lines >= GOAL_LINES && !game.ending) {
      game.ending = { at: game.clock + CLEAR_S + WIN_DELAY_S, won: true };
    }
  };

  const hardDrop = () => {
    const p = game.piece;
    if (!p) {
      return;
    }
    const distance = dropDistance(game.board, p.type, p.rot, p.x, p.y);
    if (distance > 0) {
      game.trails.push({ type: p.type, rot: p.rot, x: p.x, fromY: Math.min(p.vy, p.y), toY: p.y + distance, t0: game.clock });
    }
    p.y += distance;
    p.vy = p.y;
    addScore(distance * 2);
    lockPiece();
  };

  const finishClear = () => {
    const result = collapseRows(game.board, game.clearing.rows);
    game.board = result.board;
    game.fell = result.fell;
    game.collapseAt = game.clock;
    game.clearing = null;
    if (!game.ending) {
      spawn();
    }
  };

  const stepPiece = (dt) => {
    const p = game.piece;
    const interval = game.held.soft ? Math.min(SOFT_DROP_S, gravity()) : gravity();
    game.fallTimer += dt;
    while (game.fallTimer >= interval) {
      game.fallTimer -= interval;
      if (!stepDown(game.held.soft)) {
        game.fallTimer = 0;
      }
    }
    if (grounded()) {
      game.lockTimer += dt;
      if (game.lockTimer >= LOCK_DELAY_S) {
        lockPiece();
      }
    } else if (p) {
      game.lockTimer = 0;
    }
  };

  const stepBoard = (dt) => {
    if (game.clearing) {
      if (game.clock - game.clearing.t0 >= CLEAR_S) {
        finishClear();
      }
      return;
    }
    if (game.piece) {
      stepPiece(dt);
    }
  };

  // Keyboard auto-repeat: one step on press, then DAS delay, then ARR steps.
  const stepDas = (dt) => {
    const das = game.das;
    if (!das.dir) {
      return;
    }
    das.timer += dt;
    if (!das.charged) {
      if (das.timer < DAS_S) {
        return;
      }
      das.charged = true;
      das.timer -= DAS_S;
      shift(das.dir);
    }
    while (das.timer >= ARR_S) {
      das.timer -= ARR_S;
      shift(das.dir);
    }
  };

  const stepVisual = (dt) => {
    const now = game.clock;
    game.trails = game.trails.filter((trail) => now < trail.t0 + TRAIL_S);
    game.flashes = game.flashes.filter((flash) => now < flash.t0 + LOCK_FLASH_S);
    const p = game.piece;
    if (!p) {
      return;
    }
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 30);
    p.vx += (p.x - p.vx) * k;
    p.vy += (p.y - p.vy) * k;
  };

  /* Attract demo */

  const stepDemo = (dt) => {
    const p = game.piece;
    const demo = game.demo;
    if (!p) {
      return;
    }
    if (demo.piece !== p) {
      demo.piece = p;
      const tall = Math.max(...columnHeights(game.board)) > DEMO_MAX_HEIGHT;
      demo.plan = tall ? null : planMove(game.board, p.type, p.y);
      demo.timer = 0.3;
      if (!demo.plan) {
        demo.resetAt = game.clock + 0.6;
      }
    }
    demo.timer -= dt;
    if (!demo.plan || demo.timer > 0) {
      return;
    }
    demo.timer = DEMO_STEP_S;
    if (p.rot !== demo.plan.rot) {
      if (!rotate(1)) {
        hardDrop();
      }
    } else if (p.x !== demo.plan.x) {
      if (!shift(Math.sign(demo.plan.x - p.x))) {
        hardDrop();
      }
    } else {
      hardDrop();
    }
  };

  /* Loop hooks */

  // Runs only in the play phase.
  const update = (dt) => {
    game.clock += dt;
    // The shell's timeout compares score with CONFIG.goal, but the goal here is lines.
    if (Shell.elapsed >= CONFIG.maxPlayMs) {
      endGame(game.lines >= GOAL_LINES);
      return;
    }
    if (game.ending && game.clock >= game.ending.at) {
      endGame(game.ending.won);
      return;
    }
    stepDas(dt);
    stepBoard(dt);
    stepVisual(dt);
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    game.clock += dt;
    releaseKeys();
    game.touch = null;
    if (Shell.phase === "intro") {
      if (game.demo.resetAt >= 0 && game.clock >= game.demo.resetAt) {
        resetGame();
      }
      stepDemo(dt);
      stepBoard(dt);
    }
    stepVisual(dt);
  };

  /* Drawing (the well draws in its own coordinates; see WELL_MATRIX) */

  const rowY = (row) => (row - HIDDEN) * CELL;

  const drawCells = () => {
    const collapse = game.fell ? clamp((game.clock - game.collapseAt) / COLLAPSE_S, 0, 1) : 1;
    const clearT = game.clearing ? clamp((game.clock - game.clearing.t0) / CLEAR_S, 0, 1) : 0;
    for (let row = HIDDEN - 1; row < TOTAL; row += 1) {
      const squash = game.clearing && game.clearing.rows.includes(row) ? 1 - easeIn(clearT) : 1;
      const offset = collapse < 1 && !reduceMotion ? -game.fell[row] * CELL * (1 - easeOut(collapse)) : 0;
      const y = rowY(row) + offset + (CELL * (1 - squash)) / 2;
      if (squash <= 0.02) {
        continue;
      }
      for (let col = 0; col < COLS; col += 1) {
        const cell = game.board[row][col];
        if (cell >= 0) {
          ctx.drawImage(SPRITES[cell], col * CELL, y, CELL, CELL * squash);
        }
      }
    }
    if (game.clearing) {
      const width = WELL_W * Math.min(1, clearT * 2.5);
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = (1 - clearT) * (reduceMotion ? 0.45 : 0.9);
      game.clearing.rows.forEach((row) => {
        ctx.fillRect((WELL_W - width) / 2, rowY(row), width, CELL);
      });
      ctx.globalAlpha = 1;
    }
  };

  const drawTrails = () => {
    game.trails.forEach((trail) => {
      const t = (game.clock - trail.t0) / TRAIL_S;
      const color = PALETTE.pieces[trail.type];
      const tops = new Map();
      PIECES[trail.type].rots[trail.rot].forEach(([cx, cy]) => {
        const col = trail.x + cx;
        tops.set(col, Math.min(tops.has(col) ? tops.get(col) : 9, cy));
      });
      ctx.globalAlpha = 1 - t;
      tops.forEach((cy, col) => {
        const y0 = rowY(trail.fromY + cy);
        const y1 = rowY(trail.toY + cy);
        const streak = ctx.createLinearGradient(0, y0, 0, y1 + 1);
        streak.addColorStop(0, alpha(color, 0));
        streak.addColorStop(1, alpha(color, 0.6));
        ctx.fillStyle = streak;
        ctx.fillRect(col * CELL + CELL * 0.18, y0, CELL * 0.64, y1 - y0);
      });
    });
    ctx.globalAlpha = 1;
  };

  const drawFlashes = () => {
    ctx.fillStyle = "#ffffff";
    game.flashes.forEach((flash) => {
      ctx.globalAlpha = (1 - (game.clock - flash.t0) / LOCK_FLASH_S) * 0.7;
      ctx.fillRect(flash.x * CELL, rowY(flash.y), CELL, CELL);
    });
    ctx.globalAlpha = 1;
  };

  const drawGhost = (p) => {
    const distance = dropDistance(game.board, p.type, p.rot, p.x, p.y);
    if (distance <= 0) {
      return;
    }
    const color = PALETTE.pieces[p.type];
    ctx.lineWidth = 1;
    ctx.strokeStyle = alpha(color, 0.75);
    ctx.fillStyle = alpha(color, 0.14);
    PIECES[p.type].rots[p.rot].forEach(([cx, cy]) => {
      const x = (p.x + cx) * CELL;
      const y = rowY(p.y + distance + cy);
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
    });
  };

  const drawActive = () => {
    const p = game.piece;
    if (!p) {
      return;
    }
    drawGhost(p);
    const box = PIECES[p.type].size * CELL;
    const left = p.vx * CELL;
    const top = rowY(p.vy);
    const spin = reduceMotion ? 0 : 1 - clamp((game.clock - p.spinAt) / SPIN_S, 0, 1);
    ctx.save();
    if (spin > 0) {
      // Start from the old orientation and swing into the new one.
      ctx.translate(left + box / 2, top + box / 2);
      ctx.rotate((-p.spinDir * Math.PI * spin * spin) / 2);
      ctx.translate(-(left + box / 2), -(top + box / 2));
    }
    PIECES[p.type].rots[p.rot].forEach(([cx, cy]) => {
      ctx.drawImage(SPRITES[p.type], left + cx * CELL, top + cy * CELL, CELL, CELL);
    });
    ctx.restore();
  };

  const drawWell = () => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(WELL.x, WELL.y, WELL.w, WELL.h);
    ctx.clip();
    ctx.transform(...WELL_MATRIX);
    drawCells();
    drawTrails();
    drawActive();
    drawFlashes();
    if (game.toppedAt >= 0) {
      const t = easeOut(clamp((game.clock - game.toppedAt) / TOPOUT_S, 0, 1));
      ctx.fillStyle = "rgba(2, 12, 15, 0.62)";
      ctx.fillRect(0, WELL_H * (1 - t), WELL_W, WELL_H * t);
    }
    ctx.restore();
  };

  // Queue preview; in the strip it is turned like the well so it matches what drops in.
  const drawMini = (type, cx, cy, cell) => {
    const piece = PIECES[type];
    const { x, y, w, h } = piece.bounds;
    ctx.save();
    if (ROTATED) {
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-cx, -cy);
    }
    const left = cx - (w * cell) / 2;
    const top = cy - (h * cell) / 2;
    piece.rots[0].forEach(([px, py]) => {
      ctx.drawImage(SPRITES[type], left + (px - x) * cell, top + (py - y) * cell, cell, cell);
    });
    ctx.restore();
  };

  const drawPanels = () => {
    if (game.queue.length >= NEXT.length) {
      NEXT.forEach((slot, index) => drawMini(game.queue[index], slot.x, slot.y, slot.cell));
    }
    if (FORMAT !== "popup") {
      return;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.text;
    ctx.font = "900 15px Arial, Helvetica, sans-serif";
    ctx.fillText(String(Shell.score), LEFT_CX, 77);
    ctx.fillText(`${Math.min(game.lines, GOAL_LINES)} / ${GOAL_LINES}`, LEFT_CX, 111);
    const remaining = Math.max(0, Math.ceil((CONFIG.maxPlayMs - (Shell.phase === "intro" ? 0 : Shell.elapsed)) / 1000));
    ctx.fillStyle = remaining <= 10 && Shell.phase === "play" ? PALETTE.bad : PALETTE.text;
    ctx.fillText(String(remaining), LEFT_CX, 157);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(String(1 + game.lines), RIGHT_CX, 177);

    const pip = (PANEL_W - 22 - (GOAL_LINES - 1) * 3) / GOAL_LINES;
    for (let index = 0; index < GOAL_LINES; index += 1) {
      roundRect(ctx, LEFT_X + 11 + index * (pip + 3), 123, pip, 5, 2.5);
      ctx.fillStyle = index < game.lines ? PALETTE.accent : "rgba(170, 230, 220, 0.16)";
      ctx.fill();
    }
  };

  const draw = () => {
    ctx.drawImage(BACKGROUND, 0, 0, WIDTH, HEIGHT);
    drawWell();
    drawPanels();
    drawFx();
  };

  /* Input */

  // The whole ad is a touchpad: tap rotates, drag moves by columns, a slow pull
  // along the fall soft-drops and a quick flick hard-drops. Points are turned
  // into well space first, so in the strip "down" is a drag to the left.
  const toWell = (point) => (ROTATED ? { x: point.y, y: -point.x } : point);

  const isFlick = (touch, point, now) => {
    const first = touch.hist[0];
    const dy = point.y - first.y;
    return dy / Math.max(1, now - first.t) > FLICK_SPEED && point.y - touch.y0 > FLICK_MIN && dy > Math.abs(point.x - first.x) * 1.5;
  };

  const onPointerDown = (screenPoint, event) => {
    if (game.touch) {
      return;
    }
    const point = toWell(screenPoint);
    const now = performance.now();
    game.touch = {
      id: event ? event.pointerId : 0,
      x0: point.x,
      y0: point.y,
      ax: point.x,
      ay: point.y,
      t0: now,
      moved: false,
      dropped: false,
      hist: [{ x: point.x, y: point.y, t: now }]
    };
  };

  const onPointerUp = (screenPoint, event) => {
    const touch = game.touch;
    if (!touch || (event && event.pointerId !== touch.id)) {
      return;
    }
    game.touch = null;
    if (touch.dropped || game.ending || (event && event.type === "pointercancel")) {
      return;
    }
    const point = toWell(screenPoint);
    const now = performance.now();
    if (isFlick(touch, point, now)) {
      hardDrop();
    } else if (!touch.moved && now - touch.t0 < TAP_MS) {
      rotate(1);
    }
  };

  const onPointerMove = (screenPoint, event) => {
    const touch = game.touch;
    if (!touch || (event && event.pointerId !== touch.id)) {
      return;
    }
    if (event && event.pointerType === "mouse" && event.buttons === 0) {
      onPointerUp(screenPoint, event);
      return;
    }
    const point = toWell(screenPoint);
    const now = performance.now();
    touch.hist.push({ x: point.x, y: point.y, t: now });
    while (touch.hist.length > 2 && now - touch.hist[0].t > FLICK_WINDOW_MS) {
      touch.hist.shift();
    }
    if (Math.abs(point.x - touch.x0) > TAP_SLOP || Math.abs(point.y - touch.y0) > TAP_SLOP) {
      touch.moved = true;
    }
    if (touch.dropped || game.ending) {
      return;
    }
    if (isFlick(touch, point, now)) {
      touch.dropped = true;
      hardDrop();
      return;
    }
    while (point.x - touch.ax >= DRAG_STEP_X) {
      shift(1);
      touch.ax += DRAG_STEP_X;
    }
    while (touch.ax - point.x >= DRAG_STEP_X) {
      shift(-1);
      touch.ax -= DRAG_STEP_X;
    }
    while (point.y - touch.ay >= DRAG_STEP_Y) {
      softStep();
      touch.ay += DRAG_STEP_Y;
    }
    touch.ay = Math.min(touch.ay, point.y);
  };

  // Popup / rail: ←/→ move (auto-repeat), ↑ or X rotate, Z rotate back, ↓ soft drop, Space hard drop.
  // Strip: ↑/↓ move, → or X rotate, ← soft drop, Space hard drop.
  const onKey = (rawKey, down, event) => {
    const action = KEYMAP[rawKey.length === 1 ? rawKey.toLowerCase() : rawKey];
    if (!action) {
      return false;
    }
    const held = game.held;
    if (!down) {
      if (action === "left" || action === "right") {
        held[action] = false;
        game.das.dir = held.left ? -1 : held.right ? 1 : 0;
        game.das.timer = 0;
        game.das.charged = false;
      } else if (action === "soft") {
        held.soft = false;
      }
      return true;
    }
    if ((event && event.repeat) || game.ending) {
      return true;
    }
    if (action === "left" || action === "right") {
      const dir = action === "left" ? -1 : 1;
      held[action] = true;
      game.das.dir = dir;
      game.das.timer = 0;
      game.das.charged = false;
      shift(dir);
    } else if (action === "soft") {
      held.soft = true;
      softStep();
    } else if (action === "rotate") {
      rotate(1);
    } else if (action === "back") {
      rotate(-1);
    } else {
      hardDrop();
    }
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
