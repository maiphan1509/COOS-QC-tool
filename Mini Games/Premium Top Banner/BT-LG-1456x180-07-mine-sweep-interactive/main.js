(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-mine-sweep",         // CustomEvent namespace
    api: "mgMineSweep",                   // window.<api> handle
    campaign: "orbit-buds",
    offer: "−20%",
    winTitle: "Field cleared!",
    loseTitle: "Boom! So close",
    goal: 62,                             // safe cells; recomputed per format below
    maxPlayMs: 75000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#08203a",
    skyBottom: "#030a15",
    tileTop: ["#4fe3cf", "#43d6c3"],
    tileBottom: ["#1b9aa0", "#178c93"],
    tileEdge: "#0b4d57",
    openTile: ["#0f2440", "#0c1e36"],
    openEdge: "#06111f",
    numbers: ["", "#4cc3ff", "#7dff8a", "#ff6b6b", "#c38bff", "#ffb547", "#4df0e0", "#ffffff", "#a9b8cc"],
    flag: "#ff4d5e",
    mine: "#0a0f18",
    boom: "#ff3b4a",
    accent: "#5ef2d6",
    text: "#eaf3ff",
    dim: "rgba(210, 231, 255, 0.6)"
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

  // Board size per format; the strip fits as many columns as its width allows
  // next to the control panel.
  const BOARDS = {
    popup: { cols: 9, rows: 8, cell: 26, mines: 10 },
    rail: { cols: 5, rows: 8, cell: 18, mines: 6 },
    strip: { cols: Math.min(16, Math.floor((SAFE.w - 100) / 16)), rows: 3, cell: 16, mines: 7 }
  };

  const COLS = BOARDS[FORMAT].cols;
  const ROWS = BOARDS[FORMAT].rows;
  const MINES = BOARDS[FORMAT].mines;
  const CELL = BOARDS[FORMAT].cell;
  const COMPACT = FORMAT !== "popup";

  const BOARD = {
    popup: { x: 8, y: 32 },
    rail: { x: (WIDTH - COLS * CELL) / 2, y: SAFE.y + 4 },
    strip: { x: SAFE.x + 4, y: (HEIGHT - ROWS * CELL) / 2 }
  }[FORMAT];
  BOARD.w = COLS * CELL;
  BOARD.h = ROWS * CELL;

  // Mode toggle, mines counter and shield: a column beside the board in the
  // popup, a row under it in the rail, a row after it in the strip.
  const PANEL_X = BOARD.x + BOARD.w + 6;
  const WIDGETS = {
    popup: {
      mode: { x: 250, y: 34, w: 44, h: 48 },
      mines: { x: 272, iconY: 128, numY: 151, labelY: 164 },
      shield: { x: 272, y: 196, labelY: 216, label2Y: 225 },
      hint: true
    },
    rail: {
      mode: { x: 5, y: BOARD.y + BOARD.h + 7, w: 36, h: HEIGHT - (BOARD.y + BOARD.h + 7) - 4 },
      mines: { x: 62, iconY: BOARD.y + BOARD.h + 17, numY: BOARD.y + BOARD.h + 35, labelY: BOARD.y + BOARD.h + 47 },
      shield: { x: 87, y: BOARD.y + BOARD.h + 21, labelY: BOARD.y + BOARD.h + 41 },
      hint: false
    },
    strip: {
      mode: { x: PANEL_X, y: 6, w: 34, h: HEIGHT - 12 },
      mines: { x: PANEL_X + 56, iconY: 14, numY: 30, labelY: 43 },
      shield: { x: PANEL_X + 86, y: 20, labelY: 40 },
      hint: false
    }
  }[FORMAT];

  const FONT = {
    label: COMPACT ? 7 : 8,
    mode: COMPACT ? 7 : 9,
    count: COMPACT ? 11 : 16,
    cell: Math.round(CELL * 0.58)
  };

  const LONG_PRESS = 0.36;        // seconds held on a tile before it flags
  const PRESS_SLOP = COMPACT ? 7 : 10;
  const REVEAL_STAGGER = 0.035;   // seconds per flood-fill ring
  const REVEAL_TIME = 0.22;
  const LOSE_DELAY = 1.3;         // let the chain of mines read before the end card
  const DEMO_EVERY = 0.45;

  // One forgiven mine per round: the first mine dug is flagged instead of
  // ending the game. Keeps a guess on a 50/50 from costing a casual player
  // the whole session; shown in the panel as a shield.
  const SHIELDS = 1;

  CONFIG.goal = COLS * ROWS - MINES;

  const game = {
    cells: [],
    started: false,
    mode: "dig",         // dig | flag
    shields: SHIELDS,
    flags: 0,
    clock: 0,
    press: null,         // { index, x, y, held, fired }
    cursor: { col: Math.floor(COLS / 2), row: Math.floor(ROWS / 2) },
    keyboard: false,
    exploding: 0,
    demoTimer: 0,
    demoRest: 0,
    modePulse: 0,
    shieldPulse: 0
  };

  const neighbors = (index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const list = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const c = col + dx;
        const r = row + dy;
        if ((dx || dy) && c >= 0 && c < COLS && r >= 0 && r < ROWS) {
          list.push(r * COLS + c);
        }
      }
    }
    return list;
  };

  const NEIGHBORS = Array.from({ length: COLS * ROWS }, (_, index) => neighbors(index));

  const newBoard = () => {
    game.cells = Array.from({ length: COLS * ROWS }, () => ({
      mine: false, count: 0, open: false, flag: false, openAt: 0, flagAt: 0, boom: false
    }));
    game.started = false;
    game.flags = 0;
  };

  // Mines go anywhere except the first tile dug and its ring, so the opening
  // move always floods a pocket instead of showing a lone number.
  const placeMines = (safeIndex) => {
    const banned = new Set([safeIndex, ...NEIGHBORS[safeIndex]]);
    const pool = [];
    for (let index = 0; index < game.cells.length; index += 1) {
      if (!banned.has(index)) {
        pool.push(index);
      }
    }
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [pool[index], pool[swap]] = [pool[swap], pool[index]];
    }
    pool.slice(0, MINES).forEach((index) => {
      game.cells[index].mine = true;
    });
    game.cells.forEach((cell, index) => {
      cell.count = NEIGHBORS[index].reduce((sum, n) => sum + (game.cells[n].mine ? 1 : 0), 0);
    });
    game.started = true;
  };

  const cellCenter = (index) => ({
    x: BOARD.x + (index % COLS) * CELL + CELL / 2,
    y: BOARD.y + Math.floor(index / COLS) * CELL + CELL / 2
  });

  const cellAt = (point) => {
    const col = Math.floor((point.x - BOARD.x) / CELL);
    const row = Math.floor((point.y - BOARD.y) / CELL);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
      return -1;
    }
    return row * COLS + col;
  };

  // Breadth-first flood so each ring opens a beat after the previous one.
  const flood = (start, scoring) => {
    const queue = [[start, 0]];
    const seen = new Set([start]);
    let opened = 0;
    while (queue.length) {
      const [index, depth] = queue.shift();
      const cell = game.cells[index];
      if (cell.open || cell.flag || cell.mine) {
        continue;
      }
      cell.open = true;
      cell.openAt = game.clock + depth * REVEAL_STAGGER;
      opened += 1;
      if (cell.count === 0) {
        NEIGHBORS[index].forEach((n) => {
          if (!seen.has(n)) {
            seen.add(n);
            queue.push([n, depth + 1]);
          }
        });
      }
    }
    if (scoring && opened) {
      setScore(Shell.score + opened);
      if (opened >= 8) {
        const center = cellCenter(start);
        floatText(center.x, center.y - 8, `+${opened}`, PALETTE.accent);
      }
    }
    return opened;
  };

  const toggleFlag = (index) => {
    const cell = game.cells[index];
    if (!cell || cell.open) {
      return;
    }
    cell.flag = !cell.flag;
    cell.flagAt = game.clock;
    game.flags += cell.flag ? 1 : -1;
    if (cell.flag) {
      const center = cellCenter(index);
      burst(center.x, center.y, PALETTE.flag, 6, 50);
    }
    if (navigator.vibrate && !reduceMotion) {
      navigator.vibrate(12);
    }
  };

  const explode = (index) => {
    const origin = cellCenter(index);
    game.cells[index].boom = true;
    game.cells.forEach((cell, other) => {
      if (cell.mine && !cell.flag) {
        const at = cellCenter(other);
        cell.open = true;
        cell.openAt = game.clock + (Math.hypot(at.x - origin.x, at.y - origin.y) / CELL) * 0.1;
      }
    });
    burst(origin.x, origin.y, PALETTE.boom, 26, 140);
    burst(origin.x, origin.y, "#ffd23f", 14, 90);
    shake();
    game.exploding = LOSE_DELAY;
  };

  const dig = (index) => {
    const cell = game.cells[index];
    if (!cell || cell.flag) {
      return;
    }
    if (!game.started) {
      placeMines(index);
    }
    if (cell.open) {
      // Chord: a satisfied number opens its remaining neighbours.
      const around = NEIGHBORS[index];
      const flagged = around.filter((n) => game.cells[n].flag).length;
      if (cell.count > 0 && flagged === cell.count) {
        around.forEach((n) => {
          if (Shell.phase === "play" && !game.exploding && !game.cells[n].open && !game.cells[n].flag) {
            dig(n);
          }
        });
      }
      return;
    }
    if (cell.mine) {
      if (game.shields > 0) {
        game.shields -= 1;
        game.shieldPulse = 1;
        cell.flag = true;
        cell.flagAt = game.clock;
        game.flags += 1;
        const center = cellCenter(index);
        burst(center.x, center.y, "#7fc4ff", 18, 110);
        floatText(center.x, center.y - 10, "SHIELD!", "#7fc4ff");
        shake();
        return;
      }
      explode(index);
      return;
    }
    flood(index, true);
  };

  const act = (index) => {
    if (game.mode === "flag" && !game.cells[index].open) {
      toggleFlag(index);
    } else {
      dig(index);
    }
  };

  const resetGame = () => {
    newBoard();
    game.mode = "dig";
    game.shields = SHIELDS;
    game.press = null;
    game.exploding = 0;
    game.keyboard = false;
    game.cursor.col = Math.floor(COLS / 2);
    game.cursor.row = Math.floor(ROWS / 2);
    game.modePulse = 0;
    game.shieldPulse = 0;
  };

  const tickTimers = (dt) => {
    game.clock += dt;
    game.modePulse = Math.max(0, game.modePulse - dt * 3);
    game.shieldPulse = Math.max(0, game.shieldPulse - dt * 1.5);
  };

  // Runs only in the play phase.
  const update = (dt) => {
    tickTimers(dt);

    if (game.exploding > 0) {
      game.exploding -= dt;
      if (game.exploding <= 0) {
        endGame(false);
      }
      return;
    }

    const press = game.press;
    if (press && !press.fired) {
      press.held += dt;
      if (press.held >= LONG_PRESS) {
        press.fired = true;
        toggleFlag(press.index);
      }
    }

    if (Shell.score >= CONFIG.goal) {
      game.cells.forEach((cell) => {
        if (cell.mine && !cell.flag) {
          cell.flag = true;
          cell.flagAt = game.clock;
        }
      });
      endGame(true);
    }
  };

  // Attract mode: a self-solving board opens behind the intro card.
  const idle = (dt) => {
    tickTimers(dt);
    if (Shell.phase !== "intro") {
      return;
    }
    if (game.demoRest > 0) {
      game.demoRest -= dt;
      if (game.demoRest <= 0) {
        newBoard();
      }
      return;
    }
    game.demoTimer -= dt;
    if (game.demoTimer > 0) {
      return;
    }
    game.demoTimer = DEMO_EVERY;
    if (!game.started) {
      placeMines(Math.floor(Math.random() * game.cells.length));
    }
    const closed = [];
    game.cells.forEach((cell, index) => {
      if (!cell.open && !cell.mine) {
        closed.push(index);
      }
    });
    if (!closed.length) {
      game.cells.forEach((cell) => {
        if (cell.mine) {
          cell.flag = true;
          cell.flagAt = game.clock;
        }
      });
      game.demoRest = 1.6;
      return;
    }
    flood(closed[Math.floor(Math.random() * closed.length)], false);
  };

  /* -------------------------------------------------------------- RENDERING */

  const sprite = (draw) => {
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(CELL * DPR);
    layer.height = Math.ceil(CELL * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw(g);
    return layer;
  };

  const roundRect = (g, x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  const TILE_RADIUS = Math.max(2, CELL * 0.15);
  const TILE_LIP = Math.max(2, CELL * 0.12);

  const TILE_SPRITES = [0, 1].map((shade) => sprite((g) => {
    roundRect(g, 1, 1, CELL - 2, CELL - 2, TILE_RADIUS);
    g.fillStyle = PALETTE.tileEdge;
    g.fill();
    const face = g.createLinearGradient(0, 1, 0, CELL - TILE_LIP);
    face.addColorStop(0, PALETTE.tileTop[shade]);
    face.addColorStop(1, PALETTE.tileBottom[shade]);
    roundRect(g, 1, 1, CELL - 2, CELL - 2 - TILE_LIP, TILE_RADIUS);
    g.fillStyle = face;
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.35)";
    g.fillRect(CELL * 0.2, CELL * 0.12, CELL * 0.6, Math.max(1, CELL * 0.07));
  }));

  const OPEN_SPRITES = [0, 1].map((shade) => sprite((g) => {
    g.fillStyle = PALETTE.openTile[shade];
    g.fillRect(0, 0, CELL, CELL);
    g.fillStyle = PALETTE.openEdge;
    g.fillRect(0, 0, CELL, 1);
    g.fillRect(0, 0, 1, CELL);
  }));

  const BACKDROP = (() => {
    const layer = document.createElement("canvas");
    layer.width = Math.round(WIDTH * DPR);
    layer.height = Math.round(HEIGHT * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle = "rgba(94, 242, 214, 0.07)";
    for (let y = 6; y < HEIGHT; y += 12) {
      for (let x = 6; x < WIDTH; x += 12) {
        g.fillRect(x, y, 1, 1);
      }
    }
    const frame = COMPACT ? 2 : 4;
    roundRect(g, BOARD.x - frame, BOARD.y - frame, BOARD.w + frame * 2, BOARD.h + frame * 2, frame + 3);
    g.fillStyle = "rgba(2, 8, 16, 0.85)";
    g.fill();
    g.strokeStyle = "rgba(94, 242, 214, 0.35)";
    g.lineWidth = 1;
    g.stroke();
    return layer;
  })();

  const easeOutBack = (t) => {
    const c = 1.7;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  const drawMine = (x, y, r, lit) => {
    ctx.strokeStyle = PALETTE.mine;
    ctx.lineWidth = Math.max(1, r / 3);
    ctx.beginPath();
    for (let spike = 0; spike < 8; spike += 1) {
      const angle = (spike * Math.PI) / 4;
      ctx.moveTo(x + Math.cos(angle) * r * 0.5, y + Math.sin(angle) * r * 0.5);
      ctx.lineTo(x + Math.cos(angle) * r * 1.35, y + Math.sin(angle) * r * 1.35);
    }
    ctx.stroke();
    ctx.fillStyle = PALETTE.mine;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lit ? "#ffd23f" : "rgba(255, 255, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawFlag = (x, y, s) => {
    ctx.fillStyle = "#0b1a2b";
    ctx.fillRect(x - 5 * s, y + 6 * s, 10 * s, 2.5 * s);
    ctx.fillRect(x - 1.5 * s, y - 8 * s, 2 * s, 15 * s);
    ctx.fillStyle = PALETTE.flag;
    ctx.beginPath();
    ctx.moveTo(x + 0.5 * s, y - 8 * s);
    ctx.lineTo(x + 9 * s, y - 4 * s);
    ctx.lineTo(x + 0.5 * s, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(x + 0.5 * s, y - 8 * s, 3 * s, 1.5 * s);
  };

  const drawShovel = (x, y, s) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#c58b4a";
    ctx.fillRect(-1.5, -12, 3, 13);
    ctx.fillRect(-4, -14, 8, 3);
    ctx.fillStyle = "#cfe6ff";
    ctx.beginPath();
    ctx.moveTo(-5, 1);
    ctx.lineTo(5, 1);
    ctx.lineTo(4, 8);
    ctx.quadraticCurveTo(0, 13, -4, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawShield = (x, y, s, on) => {
    ctx.fillStyle = on ? "#7fc4ff" : "rgba(127, 196, 255, 0.18)";
    ctx.beginPath();
    ctx.moveTo(x, y - 9 * s);
    ctx.lineTo(x + 8 * s, y - 6 * s);
    ctx.quadraticCurveTo(x + 8 * s, y + 5 * s, x, y + 10 * s);
    ctx.quadraticCurveTo(x - 8 * s, y + 5 * s, x - 8 * s, y - 6 * s);
    ctx.closePath();
    ctx.fill();
    if (on) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillRect(x - 1, y - 6 * s, 2, 12 * s);
    }
  };

  const drawCell = (cell, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = BOARD.x + col * CELL;
    const y = BOARD.y + row * CELL;
    const shade = (col + row) % 2;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const progress = cell.open ? clamp((game.clock - cell.openAt) / REVEAL_TIME, 0, 1) : 0;

    if (cell.open && progress > 0) {
      ctx.drawImage(OPEN_SPRITES[shade], x, y, CELL, CELL);
      if (cell.mine) {
        if (cell.boom) {
          ctx.fillStyle = PALETTE.boom;
          ctx.fillRect(x, y, CELL, CELL);
        }
        drawMine(cx, cy, CELL * 0.23 * Math.max(0.05, easeOutBack(progress)), cell.boom);
      } else if (cell.count > 0) {
        ctx.globalAlpha = progress;
        ctx.fillStyle = PALETTE.numbers[cell.count];
        ctx.font = `900 ${FONT.cell}px Arial, Helvetica, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(cell.count), cx, cy + 1);
        ctx.globalAlpha = 1;
      }
    }

    if (!cell.open || progress < 1) {
      // Closed tile, shrinking away while it opens.
      const pressed = game.press && game.press.index === index && !game.press.fired;
      const scale = cell.open ? 1 - progress : pressed ? 0.9 : 1;
      if (scale > 0.02) {
        const size = CELL * scale;
        ctx.globalAlpha = cell.open ? 1 - progress * 0.5 : 1;
        ctx.drawImage(TILE_SPRITES[shade], cx - size / 2, cy - size / 2, size, size);
        ctx.globalAlpha = 1;
      }
    }

    if (cell.flag) {
      const t = clamp((game.clock - cell.flagAt) / 0.25, 0, 1);
      drawFlag(cx - CELL * 0.08, cy, (CELL / 27.4) * Math.max(0.05, easeOutBack(t)));
    }
  };

  const drawPressRing = () => {
    const press = game.press;
    if (!press || press.fired || game.cells[press.index].open) {
      return;
    }
    const t = clamp((press.held - 0.1) / (LONG_PRESS - 0.1), 0, 1);
    if (t <= 0) {
      return;
    }
    const center = cellCenter(press.index);
    ctx.strokeStyle = PALETTE.flag;
    ctx.lineWidth = COMPACT ? 1.8 : 2.5;
    ctx.beginPath();
    ctx.arc(center.x, center.y, CELL * 0.58, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
    ctx.stroke();
  };

  const drawPanel = () => {
    const flagMode = game.mode === "flag";
    const mode = WIDGETS.mode;
    const pulse = 1 + game.modePulse * 0.08;
    const iconScale = COMPACT ? 0.75 : 1;

    ctx.save();
    ctx.translate(mode.x + mode.w / 2, mode.y + mode.h / 2);
    ctx.scale(pulse, pulse);
    roundRect(ctx, -mode.w / 2, -mode.h / 2, mode.w, mode.h, COMPACT ? 6 : 8);
    ctx.fillStyle = flagMode ? "rgba(255, 77, 94, 0.22)" : "rgba(94, 242, 214, 0.16)";
    ctx.fill();
    ctx.strokeStyle = flagMode ? PALETTE.flag : PALETTE.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const iconY = -mode.h * 0.13;
    if (flagMode) {
      drawFlag(-2 * iconScale, iconY, 1.1 * iconScale);
    } else {
      drawShovel(0, iconY, iconScale);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 ${FONT.mode}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(flagMode ? "FLAG" : "DIG", 0, mode.h / 2 - FONT.mode * 0.95);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (WIDGETS.hint) {
      ctx.fillStyle = PALETTE.dim;
      ctx.font = `800 ${FONT.label}px Arial, Helvetica, sans-serif`;
      ctx.fillText("TAP TO", mode.x + mode.w / 2, mode.y + mode.h + 10);
      ctx.fillText("SWITCH", mode.x + mode.w / 2, mode.y + mode.h + 19);
    }

    const mines = WIDGETS.mines;
    const mineR = COMPACT ? 4.5 : 6;
    ctx.fillStyle = "rgba(94, 242, 214, 0.22)";
    ctx.beginPath();
    ctx.arc(mines.x, mines.iconY, mineR * 2.1, 0, Math.PI * 2);
    ctx.fill();
    drawMine(mines.x, mines.iconY, mineR, false);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `900 ${FONT.count}px Arial, Helvetica, sans-serif`;
    ctx.fillText(String(Math.max(0, MINES - game.flags)), mines.x, mines.numY);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = `800 ${FONT.label}px Arial, Helvetica, sans-serif`;
    ctx.fillText("MINES", mines.x, mines.labelY);

    const shield = WIDGETS.shield;
    const shieldScale = COMPACT ? 0.7 : 1;
    if (game.shieldPulse > 0) {
      ctx.fillStyle = `rgba(127, 196, 255, ${game.shieldPulse * 0.35})`;
      ctx.beginPath();
      ctx.arc(shield.x, shield.y, (14 + game.shieldPulse * 8) * shieldScale, 0, Math.PI * 2);
      ctx.fill();
    }
    drawShield(shield.x, shield.y, shieldScale, game.shields > 0);
    ctx.fillStyle = PALETTE.dim;
    if (shield.label2Y) {
      ctx.fillText(game.shields > 0 ? "1 FREE" : "USED", shield.x, shield.labelY);
      ctx.fillText("MISS", shield.x, shield.label2Y);
    } else {
      ctx.fillText(game.shields > 0 ? "FREE" : "USED", shield.x, shield.labelY);
    }
  };

  const draw = () => {
    ctx.drawImage(BACKDROP, 0, 0, WIDTH, HEIGHT);
    game.cells.forEach(drawCell);
    drawPressRing();

    if (game.keyboard && Shell.phase === "play") {
      const x = BOARD.x + game.cursor.col * CELL;
      const y = BOARD.y + game.cursor.row * CELL;
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = COMPACT ? 1.5 : 2;
      ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
    }

    drawPanel();
    drawFx();
  };

  /* --------------------------------------------------------------- GAME INPUT */

  const inModeButton = (point) => {
    const mode = WIDGETS.mode;
    return point.x >= mode.x - 4 && point.x <= mode.x + mode.w + 4 &&
      point.y >= mode.y - 4 && point.y <= mode.y + mode.h + 4;
  };

  const toggleMode = () => {
    game.mode = game.mode === "dig" ? "flag" : "dig";
    game.modePulse = 1;
  };

  const onPointerDown = (point, event) => {
    if (game.exploding > 0) {
      return;
    }
    game.keyboard = false;
    if (inModeButton(point)) {
      toggleMode();
      return;
    }
    const index = cellAt(point);
    if (index < 0) {
      return;
    }
    if (event && event.button === 2) {
      toggleFlag(index);
      return;
    }
    game.press = { index, x: point.x, y: point.y, held: 0, fired: false };
  };

  const onPointerMove = (point) => {
    const press = game.press;
    if (press && Math.hypot(point.x - press.x, point.y - press.y) > PRESS_SLOP) {
      game.press = null;
    }
  };

  const onPointerUp = (point, event) => {
    const press = game.press;
    game.press = null;
    if (press && !press.fired && game.exploding <= 0 && !(event && event.type === "pointercancel")) {
      act(press.index);
    }
  };

  const onKey = (key, down) => {
    if (!down || game.exploding > 0) {
      return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key);
    }
    const cursor = game.cursor;
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[key]) {
      game.keyboard = true;
      cursor.col = clamp(cursor.col + moves[key][0], 0, COLS - 1);
      cursor.row = clamp(cursor.row + moves[key][1], 0, ROWS - 1);
      return true;
    }
    const index = cursor.row * COLS + cursor.col;
    if (key === " " || key === "Enter") {
      game.keyboard = true;
      act(index);
      return true;
    }
    if (key === "f" || key === "F") {
      game.keyboard = true;
      toggleFlag(index);
      return true;
    }
    if (key === "m" || key === "M") {
      toggleMode();
      return true;
    }
    return false;
  };

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

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
    endEyebrow.textContent = won
      ? `Cleared in ${Math.round(Shell.elapsed / 1000)}s`
      : `${Shell.score} of ${CONFIG.goal} cleared`;
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
  newBoard();
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
