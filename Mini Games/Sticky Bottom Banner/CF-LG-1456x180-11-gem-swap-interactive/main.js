(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-gem-swap",           // CustomEvent namespace
    api: "mgGemSwap",                     // window.<api> handle
    campaign: "lyrae-ring-2",
    offer: "−30%",
    winTitle: "Dazzling win!",
    loseTitle: "So close!",
    goal: 800,                            // score that counts as a win; set per format below
    maxPlayMs: 60000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    bgTop: "#2c0f3e",
    bgBottom: "#10051a",
    board: "#1a0a27",
    tileA: "rgba(255, 255, 255, 0.05)",
    tileB: "rgba(255, 255, 255, 0.09)",
    goldHi: "#ffe6a3",
    gold: "#e0a83a",
    goldLo: "#6e4512",
    panel: "rgba(42, 14, 60, 0.86)",
    // circle, square, diamond, triangle, hexagon, star
    gems: ["#ff3b5c", "#ff9a1f", "#3d8bff", "#2fd67a", "#b45cff", "#ffd93b"],
    accent: "#ffc94a",
    text: "#fff6e8",
    textDim: "rgba(235, 210, 255, 0.66)",
    bad: "#ff5a6e"
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

  // Grid, moves and win target per format.
  const LAYOUT = {
    popup: { cols: 7, rows: 7, cell: 29, moves: 15, goal: 800, time: 60000 },
    rail: { cols: 6, rows: 9, cell: 15, moves: 15, goal: 850, time: 55000 },
    strip: { cols: 16, rows: 3, cell: 16, moves: 15, goal: 600, time: 55000 }
  }[FORMAT];

  CONFIG.goal = LAYOUT.goal;
  CONFIG.maxPlayMs = LAYOUT.time;

  const COLS = LAYOUT.cols;
  const ROWS = LAYOUT.rows;
  const CELL = LAYOUT.cell;
  const COMPACT = FORMAT !== "popup";

  const GRID = {
    popup: { x: 9, y: 24 },
    rail: { x: (WIDTH - COLS * CELL) / 2, y: SAFE.y + 5 },
    strip: { x: SAFE.x + 5, y: (HEIGHT - ROWS * CELL) / 2 }
  }[FORMAT];
  GRID.w = COLS * CELL;
  GRID.h = ROWS * CELL;

  // Side panel: full column in the popup; a moves badge and goal bar under
  // the grid in the rail and after it in the strip (score and time live in the HUD).
  const PANEL = {
    popup: { x: 221, y: GRID.y - 5, w: 73, h: GRID.h + 10 },
    rail: { x: 3, y: GRID.y + GRID.h + 6, w: WIDTH - 6, h: HEIGHT - (GRID.y + GRID.h + 6) - 3 },
    strip: { x: GRID.x + GRID.w + 7, y: 3, w: SAFE.x + SAFE.w - (GRID.x + GRID.w + 7) - 3, h: HEIGHT - 6 }
  }[FORMAT];
  const PANEL_CX = PANEL.x + PANEL.w / 2;

  const BADGE = {
    popup: { x: PANEL_CX, y: 86, r: 21, font: 20, labelY: 116 },
    rail: { x: PANEL.x + 19, y: PANEL.y + PANEL.h / 2 - 5, r: 14, font: 12, labelY: PANEL.y + PANEL.h / 2 + 17 },
    strip: { x: PANEL.x + 16, y: PANEL.y + 17, r: 13, font: 11, labelY: PANEL.y + 39 }
  }[FORMAT];

  const BAR = {
    popup: { x: PANEL.x + 9, y: 156, w: PANEL.w - 18, h: 8 },
    rail: { x: PANEL.x + 42, y: BADGE.y - 3, w: PANEL.w - 46, h: 7 },
    strip: { x: PANEL.x + 36, y: PANEL.y + 18, w: PANEL.w - 39, h: 6 }
  }[FORMAT];

  const FONT = {
    label: COMPACT ? 7 : 8,
    points: COMPACT ? 9 : 12,
    callout: COMPACT ? 12 : 18,
    banner: COMPACT ? 11 : 16
  };

  const TYPES = 6;
  const GEM_POINTS = 10;        // per gem, times the cascade level
  const ROW = 1;                // special: clears its row
  const COL = 2;                // special: clears its column
  const BOMB = 3;               // special: clears every gem of one color
  const SWAP_S = 0.16;
  const CLEAR_S = 0.24;
  const CLEAR_HOLD_S = 0.16;    // gems start falling before the pop has fully faded
  const FALL_BASE_S = 0.16;
  const FALL_ROW_S = 0.045;
  const BOUNCE = 0.12;          // cells a landing gem rebounds
  const SHUFFLE_S = 0.5;
  const MADE_S = 0.3;
  const BEAM_S = 0.32;
  const HINT_AFTER_S = 4;
  const DRAG_SLOP = COMPACT ? 6 : 9;
  const WIN_DELAY_S = 0.45;
  const OVER_DELAY_S = 0.9;
  const CALLOUTS = ["", "", "Nice!", "Great!", "Superb!", "Dazzling!"];
  const DEMO_PICK_S = 0.35;
  const DEMO_WAIT_S = 0.75;
  const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"];
  const DIRS = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
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
    const channel = (shift) => Math.round(lerp((value >> shift) & 255, target, Math.abs(amount)));
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

  /* Board rules (pure: they only read the grids they are given) */

  const keyOf = (row, col) => row * COLS + col;
  const inBounds = (cell) => cell.row >= 0 && cell.col >= 0 && cell.row < ROWS && cell.col < COLS;
  const sameCell = (a, b) => !!a && !!b && a.row === b.row && a.col === b.col;
  const adjacent = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

  // Matchable color of a gem; color bombs and holes never match.
  const typeOf = (gem) => (gem && gem.special !== BOMB ? gem.type : -1);
  const typesOf = (grid) => grid.map((line) => line.map(typeOf));

  const findRuns = (types) => {
    const runs = [];
    const scan = (lines, length, get, dir) => {
      for (let line = 0; line < lines; line += 1) {
        let start = 0;
        for (let index = 1; index <= length; index += 1) {
          const type = get(line, start);
          if (index < length && type >= 0 && get(line, index) === type) {
            continue;
          }
          if (type >= 0 && index - start >= 3) {
            const cells = [];
            for (let k = start; k < index; k += 1) {
              cells.push(dir === "h" ? [line, k] : [k, line]);
            }
            runs.push({ dir, type, cells });
          }
          start = index;
        }
      }
    };
    scan(ROWS, COLS, (row, col) => types[row][col], "h");
    scan(COLS, ROWS, (col, row) => types[row][col], "v");
    return runs;
  };

  const swapTypes = (types, a, b) => {
    const held = types[a.row][a.col];
    types[a.row][a.col] = types[b.row][b.col];
    types[b.row][b.col] = held;
  };

  // Every neighbour swap that makes a match.
  const findMoves = (types) => {
    const moves = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        [[0, 1], [1, 0]].forEach(([dr, dc]) => {
          const a = { row, col };
          const b = { row: row + dr, col: col + dc };
          if (!inBounds(b)) {
            return;
          }
          swapTypes(types, a, b);
          if (findRuns(types).length) {
            moves.push({ a, b });
          }
          swapTypes(types, a, b);
        });
      }
    }
    return moves;
  };

  const randomTypes = () => {
    const types = [];
    for (let row = 0; row < ROWS; row += 1) {
      types.push([]);
      for (let col = 0; col < COLS; col += 1) {
        let type;
        do {
          type = Math.floor(Math.random() * TYPES);
        } while (
          (col >= 2 && types[row][col - 1] === type && types[row][col - 2] === type) ||
          (row >= 2 && types[row - 1][col] === type && types[row - 2][col] === type)
        );
        types[row].push(type);
      }
    }
    return types;
  };

  // A start position with no ready-made matches and at least one move.
  const freshTypes = () => {
    for (let tries = 0; tries < 40; tries += 1) {
      const types = randomTypes();
      if (findMoves(types).length) {
        return types;
      }
    }
    return randomTypes();
  };

  const commonType = (grid) => {
    const counts = new Array(TYPES).fill(0);
    grid.forEach((line) => line.forEach((gem) => {
      if (typeOf(gem) >= 0) {
        counts[gem.type] += 1;
      }
    }));
    return counts.indexOf(Math.max(...counts));
  };

  // Fire every special caught in the clear, chaining until nothing new is hit.
  const expandClear = (grid, doomed, makes, fired, blasts) => {
    const keep = new Set(makes.map((make) => make.key));
    const list = [...doomed];
    for (let index = 0; index < list.length; index += 1) {
      const key = list[index];
      const row = Math.floor(key / COLS);
      const col = key % COLS;
      const gem = grid[row][col];
      if (!gem || !gem.special || fired.has(key)) {
        continue;
      }
      fired.add(key);
      const targets = [];
      if (gem.special === BOMB) {
        const type = commonType(grid);
        grid.forEach((line, r) => line.forEach((other, c) => {
          if (typeOf(other) === type) {
            targets.push(keyOf(r, c));
          }
        }));
      } else if (gem.special === ROW) {
        for (let k = 0; k < COLS; k += 1) {
          targets.push(keyOf(row, k));
        }
      } else {
        for (let k = 0; k < ROWS; k += 1) {
          targets.push(keyOf(k, col));
        }
      }
      blasts.push({ kind: gem.special, row, col, targets });
      targets.forEach((target) => {
        if (!doomed.has(target) && !keep.has(target) && grid[Math.floor(target / COLS)][target % COLS]) {
          doomed.add(target);
          list.push(target);
        }
      });
    }
    return { doomed, makes, blasts };
  };

  // Gems a set of runs clears, and the specials it forges: 4 in a line makes a
  // line blaster, 5 makes a color bomb, placed on the swapped gem when it is in the run.
  const planClear = (grid, runs, swapCells) => {
    const doomed = new Set();
    const makes = [];
    runs.forEach((run) => run.cells.forEach(([row, col]) => doomed.add(keyOf(row, col))));
    runs.forEach((run) => {
      if (run.cells.length < 4) {
        return;
      }
      const plain = run.cells.filter(([row, col]) => !grid[row][col].special);
      if (!plain.length) {
        return;
      }
      const anchor = plain.find(([row, col]) => (swapCells || []).some((cell) => cell.row === row && cell.col === col)) ||
        plain[Math.floor(plain.length / 2)];
      const key = keyOf(anchor[0], anchor[1]);
      if (!makes.some((make) => make.key === key)) {
        makes.push({ key, special: run.cells.length >= 5 ? BOMB : run.dir === "h" ? ROW : COL });
      }
    });
    makes.forEach((make) => doomed.delete(make.key));
    return expandClear(grid, doomed, makes, new Set(), []);
  };

  // Swapping a color bomb clears every gem of the partner's color (all gems for two bombs).
  const planBomb = (grid, bomb, partner) => {
    const other = grid[partner.row][partner.col];
    const bombKey = keyOf(bomb.row, bomb.col);
    const doomed = new Set([bombKey]);
    const fired = new Set([bombKey]);
    const targets = [];
    grid.forEach((line, row) => line.forEach((gem, col) => {
      if (gem && (other.special === BOMB || typeOf(gem) === other.type)) {
        doomed.add(keyOf(row, col));
        targets.push(keyOf(row, col));
      }
    }));
    if (other.special === BOMB) {
      fired.add(keyOf(partner.row, partner.col));
    }
    return expandClear(grid, doomed, [], fired, [{ kind: BOMB, row: bomb.row, col: bomb.col, targets }]);
  };

  /* Art */

  const polygon = (g, cx, cy, points) => {
    g.beginPath();
    points.forEach(([x, y], index) => {
      if (index) {
        g.lineTo(cx + x, cy + y);
      } else {
        g.moveTo(cx + x, cy + y);
      }
    });
    g.closePath();
  };

  const ringPoints = (count, radius, inner = 0) => {
    const steps = inner ? count * 2 : count;
    const points = [];
    for (let index = 0; index < steps; index += 1) {
      const r = inner && index % 2 ? inner : radius;
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / steps;
      points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    return points;
  };

  // Each gem differs in outline as well as color, so color-blind players can still read the board.
  const gemPath = (g, type, cx, cy, R) => {
    if (type === 0) {
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
    } else if (type === 1) {
      roundRect(g, cx - R * 0.86, cy - R * 0.86, R * 1.72, R * 1.72, R * 0.3);
    } else if (type === 2) {
      polygon(g, cx, cy, [[0, -R * 1.14], [R * 0.9, 0], [0, R * 1.14], [-R * 0.9, 0]]);
    } else if (type === 3) {
      polygon(g, cx, cy + R * 0.14, ringPoints(3, R * 1.2));
    } else if (type === 4) {
      polygon(g, cx, cy, ringPoints(6, R * 1.04));
    } else {
      polygon(g, cx, cy + R * 0.06, ringPoints(5, R * 1.18, R * 0.56));
    }
  };

  const sparkle = (g, x, y, r) => {
    g.fillStyle = "rgba(255, 255, 255, 0.95)";
    g.beginPath();
    g.moveTo(x, y - r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r, y);
    g.quadraticCurveTo(x, y, x, y - r);
    g.fill();
  };

  const paintGloss = (g, cx, cy, R, path) => {
    g.save();
    path();
    g.clip();
    const gloss = g.createRadialGradient(cx - R * 0.45, cy - R * 0.6, 0, cx - R * 0.45, cy - R * 0.6, R * 1.1);
    gloss.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    gloss.addColorStop(0.5, "rgba(255, 255, 255, 0.16)");
    gloss.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = gloss;
    g.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    g.restore();
  };

  // Line widths scale with the cell so small formats keep the same look.
  const LINE = CELL / 29;

  const paintGem = (g, type, s) => {
    const cx = s / 2;
    const cy = s / 2;
    const R = s * 0.36;
    const color = PALETTE.gems[type];
    g.lineJoin = "round";
    gemPath(g, type, cx, cy + 1.4 * LINE, R);
    g.fillStyle = "rgba(0, 0, 0, 0.38)";
    g.fill();

    const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.45, R * 0.1, cx, cy, R * 1.3);
    body.addColorStop(0, shade(color, 0.6));
    body.addColorStop(0.45, color);
    body.addColorStop(1, shade(color, -0.45));
    gemPath(g, type, cx, cy, R);
    g.fillStyle = body;
    g.fill();
    g.lineWidth = Math.max(0.7, 1.1 * LINE);
    g.strokeStyle = shade(color, -0.55);
    g.stroke();

    // Inner table facet for a cut-stone look.
    const facet = g.createLinearGradient(0, cy - R * 0.6, 0, cy + R * 0.6);
    facet.addColorStop(0, shade(color, 0.45));
    facet.addColorStop(1, shade(color, -0.12));
    gemPath(g, type, cx, cy + R * 0.05, R * 0.56);
    g.globalAlpha = 0.6;
    g.fillStyle = facet;
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = Math.max(0.5, 0.8 * LINE);
    g.strokeStyle = "rgba(255, 255, 255, 0.28)";
    g.stroke();

    paintGloss(g, cx, cy, R, () => gemPath(g, type, cx, cy, R));
    sparkle(g, cx - R * 0.42, cy - R * 0.5, R * 0.3);
  };

  const paintBomb = (g, s) => {
    const cx = s / 2;
    const cy = s / 2;
    const R = s * 0.38;
    const circle = () => {
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
    };
    g.fillStyle = "rgba(0, 0, 0, 0.38)";
    g.beginPath();
    g.arc(cx, cy + 1.4 * LINE, R, 0, Math.PI * 2);
    g.fill();
    const body = g.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R * 1.2);
    body.addColorStop(0, "#7b55a3");
    body.addColorStop(1, "#160a24");
    circle();
    g.fillStyle = body;
    g.fill();
    g.lineWidth = Math.max(0.8, 1.4 * LINE);
    g.strokeStyle = PALETTE.gold;
    g.stroke();
    PALETTE.gems.forEach((color, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / TYPES;
      const x = cx + Math.cos(angle) * R * 0.58;
      const y = cy + Math.sin(angle) * R * 0.58;
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, R * 0.19, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255, 255, 255, 0.7)";
      g.beginPath();
      g.arc(x - R * 0.06, y - R * 0.06, R * 0.06, 0, Math.PI * 2);
      g.fill();
    });
    paintGloss(g, cx, cy, R, circle);
    sparkle(g, cx, cy, R * 0.32);
  };

  const paintStripes = (g, s, vertical) => {
    const c = s / 2;
    if (vertical) {
      g.translate(c, c);
      g.rotate(Math.PI / 2);
      g.translate(-c, -c);
    }
    const thick = Math.max(1.2, 2 * LINE);
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    g.strokeStyle = "rgba(0, 0, 0, 0.3)";
    g.lineWidth = Math.max(0.5, 0.8 * LINE);
    [-0.15, 0, 0.15].forEach((offset) => {
      roundRect(g, s * 0.24, c + offset * s - thick / 2, s * 0.52, thick, thick / 2);
      g.fill();
      g.stroke();
    });
    [[1, s * 0.03], [-1, s * 0.97]].forEach(([dir, tip]) => {
      polygon(g, 0, 0, [[tip, c], [tip + dir * s * 0.13, c - s * 0.11], [tip + dir * s * 0.13, c + s * 0.11]]);
      g.fill();
      g.stroke();
    });
  };

  const GEM_SPRITES = PALETTE.gems.map((_, type) => makeLayer(CELL, CELL, (g) => paintGem(g, type, CELL)));
  const BOMB_SPRITE = makeLayer(CELL, CELL, (g) => paintBomb(g, CELL));
  const STRIPE_SPRITES = { [ROW]: makeLayer(CELL, CELL, (g) => paintStripes(g, CELL, false)), [COL]: makeLayer(CELL, CELL, (g) => paintStripes(g, CELL, true)) };
  const GLOW_SPRITE = makeLayer(CELL * 1.5, CELL * 1.5, (g) => {
    const r = CELL * 0.75;
    const glow = g.createRadialGradient(r, r, 0, r, r, r);
    glow.addColorStop(0, "rgba(255, 236, 170, 0.9)");
    glow.addColorStop(1, "rgba(255, 236, 170, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, r * 2, r * 2);
  });

  const label = (g, text, x, y, size, color) => {
    g.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color;
    g.fillText(text, x, y);
  };

  const goldGradient = (g, y0, y1) => {
    const gold = g.createLinearGradient(0, y0, 0, y1);
    gold.addColorStop(0, PALETTE.goldHi);
    gold.addColorStop(0.45, PALETTE.gold);
    gold.addColorStop(1, PALETTE.goldLo);
    return gold;
  };

  const BACKGROUND = makeLayer(WIDTH, HEIGHT, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, PALETTE.bgTop);
    sky.addColorStop(1, PALETTE.bgBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.strokeStyle = "rgba(255, 220, 160, 0.035)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = -HEIGHT; x < WIDTH + HEIGHT; x += 14) {
      g.moveTo(x, 0);
      g.lineTo(x + HEIGHT, HEIGHT);
      g.moveTo(x, HEIGHT);
      g.lineTo(x + HEIGHT, 0);
    }
    g.stroke();

    // Gold bezel around a velvet tray of checkered tiles.
    const bezel = COMPACT ? 3 : 5;
    roundRect(g, GRID.x - bezel, GRID.y - bezel, GRID.w + bezel * 2, GRID.h + bezel * 2, bezel * 2);
    g.fillStyle = goldGradient(g, GRID.y - bezel, GRID.y + GRID.h + bezel);
    g.fill();
    roundRect(g, GRID.x - 1.5, GRID.y - 1.5, GRID.w + 3, GRID.h + 3, bezel + 2);
    g.fillStyle = PALETTE.board;
    g.fill();
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        roundRect(g, GRID.x + col * CELL + 1, GRID.y + row * CELL + 1, CELL - 2, CELL - 2, CELL * 0.18);
        g.fillStyle = (row + col) % 2 ? PALETTE.tileA : PALETTE.tileB;
        g.fill();
      }
    }

    roundRect(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, COMPACT ? 6 : 10);
    g.fillStyle = PALETTE.panel;
    g.fill();
    g.strokeStyle = "rgba(240, 190, 90, 0.45)";
    g.stroke();

    const badge = g.createRadialGradient(BADGE.x, BADGE.y - BADGE.r * 0.3, 1, BADGE.x, BADGE.y, BADGE.r + 1);
    badge.addColorStop(0, "#5a2378");
    badge.addColorStop(1, "#1d0a2b");
    g.beginPath();
    g.arc(BADGE.x, BADGE.y, BADGE.r, 0, Math.PI * 2);
    g.fillStyle = badge;
    g.fill();
    g.lineWidth = COMPACT ? 1.8 : 2.5;
    g.strokeStyle = goldGradient(g, BADGE.y - BADGE.r, BADGE.y + BADGE.r);
    g.stroke();
    label(g, "MOVES", BADGE.x, BADGE.labelY, FONT.label, PALETTE.textDim);
    roundRect(g, BAR.x, BAR.y, BAR.w, BAR.h, BAR.h / 2);
    g.fillStyle = "rgba(0, 0, 0, 0.4)";
    g.fill();

    if (FORMAT === "popup") {
      label(g, "LYRAE", PANEL_CX, 37, 13, PALETTE.accent);
      label(g, "RING 2", PANEL_CX, 49, 8, PALETTE.text);
      label(g, "SCORE", PANEL_CX, 132, 8, PALETTE.textDim);
      label(g, `GOAL ${CONFIG.goal}`, PANEL_CX, 174, 8, PALETTE.textDim);
      label(g, "TIME", PANEL_CX, 196, 8, PALETTE.textDim);
    } else {
      label(g, `GOAL ${CONFIG.goal}`, BAR.x + BAR.w / 2, BAR.y - 6, FONT.label, PALETTE.textDim);
    }
  });

  /* State */

  const game = {
    clock: 0,
    grid: [],             // grid[row][col] = gem; gem.x / gem.y are the drawn cell position
    popping: [],          // gems already out of the grid, playing their pop
    beams: [],
    state: "fall",        // ready | swap | unswap | clear | fall | shuffle | done
    stateAt: 0,
    pending: null,        // the swap being checked
    combo: 0,
    moves: LAYOUT.moves,
    selected: null,
    press: null,
    cursor: { row: Math.floor(ROWS / 2), col: Math.floor(COLS / 2), active: false },
    hint: null,
    idleSince: 0,
    ending: null,
    demo: { move: null, wait: 0.6 }
  };

  const newGem = (type, col, row) => ({ type, special: 0, x: col, y: row, tw: null, madeAt: -1, popAt: -1 });

  const gemAt = (cell) => game.grid[cell.row][cell.col];

  const moveGem = (gem, col, row, duration, kind = "ease", delay = 0) => {
    gem.tw = { fx: gem.x, fy: gem.y, tx: col, ty: row, t0: game.clock + delay, duration, kind };
  };

  // Advances every gem tween; true while any is still moving.
  const stepTweens = () => {
    let busy = false;
    game.grid.forEach((line) => line.forEach((gem) => {
      const tw = gem && gem.tw;
      if (!tw) {
        return;
      }
      const t = (game.clock - tw.t0) / tw.duration;
      if (t >= 1) {
        gem.x = tw.tx;
        gem.y = tw.ty;
        gem.tw = null;
        return;
      }
      busy = true;
      if (t <= 0) {
        return;
      }
      if (tw.kind === "drop" && !reduceMotion) {
        // Accelerate in, then a small rebound off the gem below.
        const fall = Math.min(1, t / 0.75);
        gem.x = tw.tx;
        gem.y = t < 0.75 ? lerp(tw.fy, tw.ty, fall * fall) : tw.ty - BOUNCE * Math.sin((Math.PI * (t - 0.75)) / 0.25);
      } else {
        const e = easeInOut(t);
        gem.x = lerp(tw.fx, tw.tx, e);
        gem.y = lerp(tw.fy, tw.ty, e);
      }
    }));
    return busy;
  };

  const anyMove = () => {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (game.grid[row][col].special === BOMB) {
          return { a: { row, col }, b: { row, col: col + 1 < COLS ? col + 1 : col - 1 } };
        }
      }
    }
    const moves = findMoves(typesOf(game.grid));
    return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
  };

  const setState = (state) => {
    game.state = state;
    game.stateAt = game.clock;
    if (state === "ready") {
      game.hint = anyMove();
      game.idleSince = game.clock;
    }
  };

  const resetGame = () => {
    const types = freshTypes();
    game.grid = types.map((line, row) => line.map((type, col) => {
      const gem = newGem(type, col, row - ROWS - 1);
      moveGem(gem, col, row, FALL_BASE_S + ROWS * FALL_ROW_S, "drop", col * (0.25 / COLS) + (ROWS - row) * 0.03);
      return gem;
    }));
    game.popping = [];
    game.beams = [];
    game.pending = null;
    game.combo = 0;
    game.moves = LAYOUT.moves;
    game.selected = null;
    game.press = null;
    game.cursor.active = false;
    game.hint = null;
    game.ending = null;
    game.demo.move = null;
    game.demo.wait = 0.6;
    setState("fall");
  };

  /* Moves */

  const swapCells = (a, b) => {
    const held = gemAt(a);
    game.grid[a.row][a.col] = gemAt(b);
    game.grid[b.row][b.col] = held;
  };

  const trySwap = (a, b) => {
    if (game.state !== "ready" || game.ending || !inBounds(a) || !inBounds(b) || !adjacent(a, b)) {
      return false;
    }
    swapCells(a, b);
    moveGem(gemAt(a), a.col, a.row, SWAP_S);
    moveGem(gemAt(b), b.col, b.row, SWAP_S);
    game.pending = { a, b };
    game.selected = null;
    setState("swap");
    return true;
  };

  const spendMove = () => {
    if (Shell.phase === "play") {
      game.moves -= 1;
    }
  };

  const cellCenter = (row, col) => ({ x: GRID.x + (col + 0.5) * CELL, y: GRID.y + (row + 0.5) * CELL });
  const gridCenter = () => ({ x: GRID.x + GRID.w / 2, y: GRID.y + GRID.h / 2 });

  const applyClear = (plan) => {
    const now = game.clock;
    let sumX = 0;
    let sumY = 0;
    plan.doomed.forEach((key) => {
      const row = Math.floor(key / COLS);
      const col = key % COLS;
      const gem = game.grid[row][col];
      if (!gem) {
        return;
      }
      game.grid[row][col] = null;
      gem.popAt = now;
      gem.tw = null;
      game.popping.push(gem);
      const center = cellCenter(row, col);
      sumX += center.x;
      sumY += center.y;
      burst(center.x, center.y, gem.special === BOMB ? PALETTE.accent : PALETTE.gems[gem.type], COMPACT ? 3 : 5, COMPACT ? 60 : 85);
    });
    plan.makes.forEach((make) => {
      const row = Math.floor(make.key / COLS);
      const col = make.key % COLS;
      const gem = game.grid[row][col];
      if (gem) {
        gem.special = make.special;
        gem.madeAt = now;
        const center = cellCenter(row, col);
        burst(center.x, center.y, "#ffffff", COMPACT ? 5 : 8, 60);
      }
    });
    plan.blasts.forEach((blast) => game.beams.push({ ...blast, t0: now }));

    const count = plan.doomed.size;
    if (Shell.phase === "play" && count) {
      const points = count * GEM_POINTS * game.combo;
      setScore(Shell.score + points);
      const margin = COMPACT ? 12 : 18;
      floatText(clamp(sumX / count, GRID.x + margin, GRID.x + GRID.w - margin), clamp(sumY / count, GRID.y + 8, GRID.y + GRID.h - 8), `+${points}`, PALETTE.accent, FONT.points);
      const center = gridCenter();
      const gap = COMPACT ? 8 : 12;
      if (game.combo >= 2) {
        floatText(center.x, center.y - gap, CALLOUTS[Math.min(game.combo, CALLOUTS.length - 1)], "#ff8ad8", FONT.callout);
      }
      if (plan.blasts.some((blast) => blast.kind === BOMB)) {
        floatText(center.x, center.y + gap, "Color bomb!", PALETTE.accent, FONT.banner);
        shake();
      } else if (plan.blasts.length) {
        floatText(center.x, center.y + gap, "Line blast!", PALETTE.accent, FONT.banner);
      }
    }
    setState("clear");
  };

  // Gems drop into the gaps and fresh ones fall in from above the board.
  const settleColumns = () => {
    for (let col = 0; col < COLS; col += 1) {
      let write = ROWS - 1;
      for (let row = ROWS - 1; row >= 0; row -= 1) {
        const gem = game.grid[row][col];
        if (!gem) {
          continue;
        }
        if (row !== write) {
          game.grid[write][col] = gem;
          game.grid[row][col] = null;
          moveGem(gem, col, write, FALL_BASE_S + (write - row) * FALL_ROW_S, "drop");
        }
        write -= 1;
      }
      const missing = write + 1;
      for (let row = write; row >= 0; row -= 1) {
        const gem = newGem(Math.floor(Math.random() * TYPES), col, row - missing);
        game.grid[row][col] = gem;
        moveGem(gem, col, row, FALL_BASE_S + missing * FALL_ROW_S, "drop");
      }
    }
  };

  const startShuffle = () => {
    const gems = [];
    game.grid.forEach((line) => line.forEach((gem) => gems.push(gem)));
    let solved = false;
    for (let tries = 0; tries < 60 && !solved; tries += 1) {
      shuffle(gems);
      const types = [];
      for (let row = 0; row < ROWS; row += 1) {
        types.push(gems.slice(row * COLS, row * COLS + COLS).map(typeOf));
      }
      solved = !findRuns(types).length && (gems.some((gem) => gem.special === BOMB) || findMoves(types).length > 0);
    }
    if (!solved) {
      const types = freshTypes();
      gems.forEach((gem, index) => {
        gem.type = types[Math.floor(index / COLS)][index % COLS];
        gem.special = 0;
      });
    }
    gems.forEach((gem, index) => {
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      game.grid[row][col] = gem;
      moveGem(gem, col, row, SHUFFLE_S, "ease", Math.random() * 0.1);
    });
    floatText(gridCenter().x, gridCenter().y, "Shuffle!", PALETTE.accent, FONT.banner);
    setState("shuffle");
  };

  const finish = (won) => {
    setState("done");
    game.selected = null;
    game.ending = { at: game.clock + (won ? WIN_DELAY_S : OVER_DELAY_S), won };
    if (!won) {
      floatText(gridCenter().x, gridCenter().y, "Out of moves!", PALETTE.bad, FONT.banner);
    }
  };

  const afterSwap = () => {
    const { a, b } = game.pending;
    if (gemAt(a).special === BOMB || gemAt(b).special === BOMB) {
      const bomb = gemAt(a).special === BOMB ? a : b;
      spendMove();
      game.combo = 1;
      applyClear(planBomb(game.grid, bomb, bomb === a ? b : a));
      return;
    }
    const runs = findRuns(typesOf(game.grid));
    if (runs.length) {
      spendMove();
      game.combo = 1;
      applyClear(planClear(game.grid, runs, [a, b]));
      return;
    }
    // No match: the pair slides back.
    swapCells(a, b);
    moveGem(gemAt(a), a.col, a.row, SWAP_S);
    moveGem(gemAt(b), b.col, b.row, SWAP_S);
    setState("unswap");
  };

  const afterFall = () => {
    const runs = findRuns(typesOf(game.grid));
    if (runs.length) {
      game.combo += 1;
      applyClear(planClear(game.grid, runs, null));
      return;
    }
    game.combo = 0;
    if (Shell.phase === "play") {
      if (Shell.score >= CONFIG.goal) {
        finish(true);
        return;
      }
      if (game.moves <= 0) {
        finish(false);
        return;
      }
    }
    if (!anyMove()) {
      startShuffle();
      return;
    }
    setState("ready");
  };

  const stepBoard = () => {
    const busy = stepTweens();
    game.popping = game.popping.filter((gem) => game.clock < gem.popAt + CLEAR_S);
    game.beams = game.beams.filter((beam) => game.clock < beam.t0 + BEAM_S);
    if (busy) {
      return;
    }
    if (game.state === "swap") {
      afterSwap();
    } else if (game.state === "unswap") {
      setState("ready");
    } else if (game.state === "clear") {
      if (game.clock - game.stateAt >= CLEAR_HOLD_S) {
        settleColumns();
        setState("fall");
      }
    } else if (game.state === "fall" || game.state === "shuffle") {
      afterFall();
    }
  };

  /* Attract demo */

  const stepDemo = (dt) => {
    const demo = game.demo;
    if (game.state !== "ready") {
      return;
    }
    demo.wait -= dt;
    if (demo.wait > 0) {
      return;
    }
    if (!demo.move) {
      demo.move = anyMove();
      game.selected = demo.move ? demo.move.a : null;
      demo.wait = DEMO_PICK_S;
      return;
    }
    const move = demo.move;
    demo.move = null;
    trySwap(move.a, move.b);
    demo.wait = DEMO_WAIT_S;
  };

  /* Loop hooks */

  // Runs only in the play phase.
  const update = (dt) => {
    game.clock += dt;
    stepBoard();
    if (game.ending && game.clock >= game.ending.at) {
      endGame(game.ending.won);
    }
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    game.clock += dt;
    game.press = null;
    game.cursor.active = false;
    if (Shell.phase === "intro") {
      stepDemo(dt);
    } else {
      game.selected = null;
    }
    stepBoard();
  };

  /* Drawing */

  const drawGem = (gem, scale) => {
    const cx = GRID.x + (gem.x + 0.5) * CELL;
    const cy = GRID.y + (gem.y + 0.5) * CELL;
    const size = CELL * scale;
    if (gem.special && gem.popAt < 0) {
      ctx.globalAlpha = 0.45 + Math.sin(game.clock * 6) * 0.15;
      ctx.drawImage(GLOW_SPRITE, cx - CELL * 0.75, cy - CELL * 0.75, CELL * 1.5, CELL * 1.5);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(gem.special === BOMB ? BOMB_SPRITE : GEM_SPRITES[gem.type], cx - size / 2, cy - size / 2, size, size);
    if (gem.special === ROW || gem.special === COL) {
      ctx.drawImage(STRIPE_SPRITES[gem.special], cx - size / 2, cy - size / 2, size, size);
    }
  };

  const drawTileMark = (cell, color, fillAlpha) => {
    const x = GRID.x + cell.col * CELL;
    const y = GRID.y + cell.row * CELL;
    roundRect(ctx, x + 1, y + 1, CELL - 2, CELL - 2, CELL * 0.18);
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = COMPACT ? 1 : 1.5;
    ctx.strokeStyle = color;
    ctx.stroke();
  };

  const hintActive = () => Shell.phase === "play" && game.state === "ready" && !!game.hint &&
    game.clock - game.idleSince > HINT_AFTER_S;

  const drawGems = () => {
    const pulse = Math.sin(game.clock * 7);
    const hint = hintActive() ? game.hint : null;
    if (hint) {
      ctx.globalAlpha = 0.35 + pulse * 0.25;
      [hint.a, hint.b].forEach((cell) => {
        const center = cellCenter(cell.row, cell.col);
        ctx.drawImage(GLOW_SPRITE, center.x - CELL * 0.75, center.y - CELL * 0.75, CELL * 1.5, CELL * 1.5);
      });
      ctx.globalAlpha = 1;
    }
    if (game.selected) {
      drawTileMark(game.selected, PALETTE.accent, 0.22);
    }
    game.grid.forEach((line, row) => line.forEach((gem, col) => {
      if (!gem) {
        return;
      }
      let scale = 1;
      if (gem.madeAt >= 0 && game.clock - gem.madeAt < MADE_S) {
        scale += 0.3 * Math.sin((Math.PI * (game.clock - gem.madeAt)) / MADE_S);
      }
      if (sameCell(game.selected, { row, col }) && game.state === "ready") {
        scale += reduceMotion ? 0.06 : 0.06 + pulse * 0.03;
      }
      if (hint && !reduceMotion && (sameCell(hint.a, { row, col }) || sameCell(hint.b, { row, col }))) {
        scale += pulse * 0.07;
      }
      drawGem(gem, scale);
    }));
  };

  const drawPopping = () => {
    game.popping.forEach((gem) => {
      const t = clamp((game.clock - gem.popAt) / CLEAR_S, 0, 1);
      const scale = t < 0.3 ? 1 + t : 1.3 * (1 - (t - 0.3) / 0.7);
      ctx.globalAlpha = 1 - t * 0.5;
      drawGem(gem, Math.max(0.02, scale));
      const cx = GRID.x + (gem.x + 0.5) * CELL;
      const cy = GRID.y + (gem.y + 0.5) * CELL;
      ctx.globalAlpha = (1 - t) * 0.85;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = COMPACT ? 1.2 : 2;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * (0.25 + t * 0.4), 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  };

  const drawBeams = () => {
    game.beams.forEach((beam) => {
      const t = clamp((game.clock - beam.t0) / BEAM_S, 0, 1);
      const origin = cellCenter(beam.row, beam.col);
      ctx.globalAlpha = (1 - t) * (reduceMotion ? 0.5 : 0.9);
      if (beam.kind === BOMB) {
        ctx.strokeStyle = PALETTE.goldHi;
        ctx.lineWidth = COMPACT ? 1 : 1.6;
        ctx.beginPath();
        beam.targets.forEach((key) => {
          const target = cellCenter(Math.floor(key / COLS), key % COLS);
          ctx.moveTo(origin.x, origin.y);
          ctx.lineTo(target.x, target.y);
        });
        ctx.stroke();
      } else {
        const thick = CELL * (0.75 - t * 0.5);
        const across = beam.kind === ROW;
        const glow = across
          ? ctx.createLinearGradient(0, origin.y - thick / 2, 0, origin.y + thick / 2)
          : ctx.createLinearGradient(origin.x - thick / 2, 0, origin.x + thick / 2, 0);
        glow.addColorStop(0, "rgba(255, 230, 160, 0)");
        glow.addColorStop(0.5, "rgba(255, 255, 255, 1)");
        glow.addColorStop(1, "rgba(255, 230, 160, 0)");
        ctx.fillStyle = glow;
        if (across) {
          ctx.fillRect(GRID.x, origin.y - thick / 2, GRID.w, thick);
        } else {
          ctx.fillRect(origin.x - thick / 2, GRID.y, thick, GRID.h);
        }
      }
    });
    ctx.globalAlpha = 1;
  };

  const drawPanel = () => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const low = game.moves <= 3 && Shell.phase === "play";
    ctx.font = `900 ${BADGE.font}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = low ? PALETTE.bad : PALETTE.text;
    ctx.fillText(String(game.moves), BADGE.x, BADGE.y + 1);

    const t = clamp(Shell.score / CONFIG.goal, 0, 1);
    if (t > 0) {
      const fill = ctx.createLinearGradient(BAR.x, 0, BAR.x + BAR.w, 0);
      fill.addColorStop(0, "#ff6fc8");
      fill.addColorStop(1, PALETTE.accent);
      roundRect(ctx, BAR.x, BAR.y, Math.max(BAR.h, BAR.w * t), BAR.h, BAR.h / 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(BAR.x + BAR.h / 2, BAR.y + BAR.h * 0.2, Math.max(0, BAR.w * t - BAR.h), BAR.h * 0.18);
    }

    if (FORMAT === "popup") {
      ctx.font = "900 14px Arial, Helvetica, sans-serif";
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(String(Shell.score), PANEL_CX, 145);
      const remaining = Math.max(0, Math.ceil((CONFIG.maxPlayMs - (Shell.phase === "intro" ? 0 : Shell.elapsed)) / 1000));
      ctx.fillStyle = remaining <= 10 && Shell.phase === "play" ? PALETTE.bad : PALETTE.text;
      ctx.fillText(String(remaining), PANEL_CX, 211);
    } else {
      ctx.font = `900 ${FONT.label}px Arial, Helvetica, sans-serif`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`${Math.floor(t * 100)}%`, BAR.x + BAR.w / 2, BAR.y + BAR.h + 7);
    }
  };

  const draw = () => {
    ctx.drawImage(BACKGROUND, 0, 0, WIDTH, HEIGHT);
    ctx.save();
    ctx.beginPath();
    ctx.rect(GRID.x - 1.5, GRID.y - 1.5, GRID.w + 3, GRID.h + 3);
    ctx.clip();
    drawGems();
    drawPopping();
    drawBeams();
    ctx.restore();
    if (game.cursor.active) {
      ctx.lineWidth = COMPACT ? 1.4 : 2;
      ctx.strokeStyle = "#ffffff";
      roundRect(ctx, GRID.x + game.cursor.col * CELL + 0.5, GRID.y + game.cursor.row * CELL + 0.5, CELL - 1, CELL - 1, CELL * 0.2);
      ctx.stroke();
    }
    drawPanel();
    drawFx();
  };

  /* Input */

  const cellAt = (point) => {
    const cell = { row: Math.floor((point.y - GRID.y) / CELL), col: Math.floor((point.x - GRID.x) / CELL) };
    return inBounds(cell) ? cell : null;
  };

  const onPointerDown = (point, event) => {
    game.idleSince = game.clock;
    game.cursor.active = false;
    if (game.press) {
      return;
    }
    const cell = cellAt(point);
    if (!cell) {
      game.selected = null;
      return;
    }
    // Taps while the board is resolving are ignored rather than queued.
    if (game.state !== "ready" || game.ending) {
      return;
    }
    const selected = game.selected;
    if (selected && adjacent(selected, cell)) {
      trySwap(selected, cell);
      return;
    }
    game.selected = cell;
    game.press = { cell, x: point.x, y: point.y, id: event ? event.pointerId : 0, again: sameCell(selected, cell), used: false };
  };

  const onPointerUp = (point, event) => {
    const press = game.press;
    if (!press || (event && event.pointerId !== press.id)) {
      return;
    }
    game.press = null;
    if (!press.used && press.again) {
      game.selected = null;
    }
  };

  const onPointerMove = (point, event) => {
    const press = game.press;
    if (!press || (event && event.pointerId !== press.id)) {
      return;
    }
    if (event && event.pointerType === "mouse" && event.buttons === 0) {
      onPointerUp(point, event);
      return;
    }
    const dx = point.x - press.x;
    const dy = point.y - press.y;
    if (press.used || Math.max(Math.abs(dx), Math.abs(dy)) < DRAG_SLOP) {
      return;
    }
    press.used = true;
    game.selected = null;
    const target = Math.abs(dx) > Math.abs(dy)
      ? { row: press.cell.row, col: press.cell.col + Math.sign(dx) }
      : { row: press.cell.row + Math.sign(dy), col: press.cell.col };
    trySwap(press.cell, target);
  };

  // Arrows move the cursor; Space/Enter picks the gem; an arrow then swaps it that way.
  const onKey = (key, down) => {
    if (!KEYS.includes(key)) {
      return false;
    }
    if (!down) {
      return true;
    }
    const cursor = game.cursor;
    game.idleSince = game.clock;
    if (!cursor.active) {
      cursor.active = true;
      return true;
    }
    if (key === " " || key === "Enter") {
      const here = { row: cursor.row, col: cursor.col };
      game.selected = sameCell(game.selected, here) ? null : here;
      return true;
    }
    const [dr, dc] = DIRS[key];
    if (game.selected) {
      const from = game.selected;
      const to = { row: from.row + dr, col: from.col + dc };
      if (trySwap(from, to)) {
        cursor.row = to.row;
        cursor.col = to.col;
      }
      return true;
    }
    cursor.row = clamp(cursor.row + dr, 0, ROWS - 1);
    cursor.col = clamp(cursor.col + dc, 0, COLS - 1);
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
