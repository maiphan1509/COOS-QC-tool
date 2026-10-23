(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-fruit-slash",        // CustomEvent namespace
    api: "mgFruitSlash",                  // window.<api> handle
    campaign: "blendr-go",
    offer: "−25%",
    winTitle: "Juicy win!",
    loseTitle: "So close!",
    goal: 250,                               // score that counts as a win
    maxPlayMs: 40000,                        // hard stop: a session never runs past this
    idleStopMs: 30000                        // stop the attract loop after this long untouched
  };

  const PALETTE = {
    plank: [["#7a4a28", "#61391d"], ["#6e4222", "#58331a"], ["#80502c", "#663d20"]],
    grainDark: "rgba(48, 22, 6, 0.32)",
    grainLight: "rgba(255, 210, 160, 0.09)",
    seam: "rgba(28, 12, 2, 0.75)",
    seamHi: "rgba(255, 214, 170, 0.14)",
    shadow: "rgba(30, 12, 0, 0.3)",
    blade: "#ffffff",
    bladeGlow: "#9ff3ff",
    bomb: "#2e323d",
    fuse: "#d8b27a",
    spark: "#ffd36a",
    danger: "#ff3b30",
    fire: "#ffb347",
    smoke: "#4a4a50",
    miss: "#ff5a4a",
    combo: "#fff15a",
    text: "#fff8ec"
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
  const strikePips = document.querySelectorAll("#strikesValue i");
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

  // Fruit art is authored once (popup size) and scaled by `fruit`. The strip
  // swaps tall tosses for short, floaty arcs across the band.
  const LAYOUT = {
    popup: {
      fruit: 1, gravity: 300, launchPad: 22, apexTop: 30, apexBottom: 96,
      spawnInset: 50, landInset: 40, bladePad: 8, blade: 1, combo: 17, missBand: 50,
      ramp: [
        { until: 5, gap: 1.0, min: 1, max: 1, bomb: 0 },
        { until: 14, gap: 1.15, min: 1, max: 2, bomb: 0.22 },
        { until: Infinity, gap: 1.3, min: 2, max: 3, bomb: 0.3 }
      ]
    },
    rail: {
      fruit: 0.62, gravity: 260, launchPad: 16, apexTop: 14, apexBottom: 80,
      spawnInset: 22, landInset: 14, bladePad: 6, blade: 0.7, combo: 11, missBand: 34,
      ramp: [
        { until: 5, gap: 0.95, min: 1, max: 1, bomb: 0 },
        { until: 14, gap: 1.05, min: 1, max: 2, bomb: 0.2 },
        { until: Infinity, gap: 1.15, min: 1, max: 3, bomb: 0.28 }
      ]
    },
    strip: {
      fruit: 0.5, gravity: 110, launchPad: 12, apexTop: 3, apexBottom: 22,
      spawnInset: 24, landInset: 24, bladePad: 6, blade: 0.65, combo: 10, missBand: 16,
      ramp: [
        { until: 5, gap: 0.95, min: 1, max: 1, bomb: 0 },
        { until: 14, gap: 1.05, min: 1, max: 2, bomb: 0.2 },
        { until: Infinity, gap: 1.15, min: 1, max: 3, bomb: 0.28 }
      ]
    }
  }[FORMAT];

  const FS = LAYOUT.fruit;
  const GRAVITY = LAYOUT.gravity;
  const SLICE_SPEED = 140 * Math.max(0.6, FS);   // px/s; slower drags only move the blade
  const TRAIL_MAX = 8;
  const TRAIL_LIFE = 0.16;
  const COMBO_WINDOW = 0.3;      // fruits sliced this close together share a swipe
  const COMBO_MIN = 3;
  const FRUIT_POINTS = 10;
  const MAX_STRIKES = 3;
  const END_DELAY = 0.8;
  const KEY_LINE_SPEED = (170 * SAFE.h) / 226;
  const KEY_SLASH_COOLDOWN = 0.28;
  const MAX_ITEMS = 10;
  const MAX_HALVES = 16;
  const MAX_STAINS = 10;
  const CELL = 46;               // authored atlas cell
  const BOMB_R = 13;             // authored bomb radius
  const FRUITS = [
    { name: "melon", r: 17, juice: "#ff3d55", flesh: "#ff8a96" },
    { name: "orange", r: 13.5, juice: "#ffa21a", flesh: "#ffd27a" },
    { name: "apple", r: 13.5, juice: "#ffe08a", flesh: "#fff4d2" },
    { name: "kiwi", r: 12.5, juice: "#9ad94a", flesh: "#d8f59a" }
  ];
  const TAU = Math.PI * 2;

  const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

  // Draw-time transform in served units without save/restore churn.
  const setXf = (x, y, rot = 0, s = 1) => {
    const cos = Math.cos(rot) * s;
    const sin = Math.sin(rot) * s;
    ctx.setTransform(DPR * cos, DPR * sin, -DPR * sin, DPR * cos, DPR * x, DPR * y);
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
        g.save();
        paint(g, col, row);
        g.restore();
      }
    }
    return { canvas: sheet, cw, ch };
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

  const board = makeLayer(WIDTH, HEIGHT);

  const paintBoard = () => {
    const g = board.g;
    const planks = Math.max(2, Math.round(HEIGHT / 50));
    const plankH = HEIGHT / planks;
    const k = Math.min(1, plankH / 50);
    for (let p = 0; p < planks; p += 1) {
      const y0 = p * plankH;
      const tone = PALETTE.plank[p % PALETTE.plank.length];
      const grad = g.createLinearGradient(0, y0, 0, y0 + plankH);
      grad.addColorStop(0, tone[0]);
      grad.addColorStop(1, tone[1]);
      g.fillStyle = grad;
      g.fillRect(0, y0, WIDTH, plankH);
      g.lineWidth = 0.8;
      const lines = Math.max(4, Math.round(plankH / 5));
      for (let n = 0; n < lines; n += 1) {
        const gy = y0 + 3 * k + (n * (plankH - 6 * k)) / (lines - 1) + rand(-1.5, 1.5) * k;
        const amp = rand(0.6, 2.4) * k;
        const freq = rand(0.015, 0.045);
        const phase = rand(0, TAU);
        g.strokeStyle = n % 3 === 0 ? PALETTE.grainDark : PALETTE.grainLight;
        g.beginPath();
        g.moveTo(0, gy);
        for (let x = 10; x <= WIDTH + 10; x += 10) {
          g.lineTo(x, gy + Math.sin(x * freq + phase) * amp);
        }
        g.stroke();
      }
      if (p % 2 === 0) {
        const kx = rand(30, WIDTH - 30);
        const ky = y0 + plankH * rand(0.3, 0.7);
        g.strokeStyle = PALETTE.grainDark;
        for (let ring = 0; ring < 4; ring += 1) {
          g.beginPath();
          g.ellipse(kx, ky, (3 + ring * 2.8) * k, (1.5 + ring * 1.3) * k, 0, 0, TAU);
          g.stroke();
        }
        g.fillStyle = "rgba(40, 18, 4, 0.55)";
        oval(g, kx, ky, 2.2 * k, 1.1 * k, 0);
      }
      g.fillStyle = PALETTE.seam;
      g.fillRect(0, y0, WIDTH, 1.5);
      g.fillStyle = PALETTE.seamHi;
      g.fillRect(0, y0 + 1.5, WIDTH, 0.8);
    }
    // Old knife scratches
    g.strokeStyle = "rgba(255, 232, 200, 0.08)";
    g.lineWidth = 0.8;
    g.beginPath();
    for (let n = 0; n < Math.round((WIDTH * HEIGHT) / 4700); n += 1) {
      const x = rand(10, WIDTH - 10);
      const y = rand(4, HEIGHT - 4);
      const a = rand(-0.6, 0.6);
      const len = rand(10, 34) * Math.max(0.5, FS);
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
    g.stroke();
    const cx = SAFE.x + SAFE.w / 2;
    const cy = SAFE.y + SAFE.h / 2;
    const reach = Math.max(WIDTH, HEIGHT) * 0.75;
    const vignette = g.createRadialGradient(cx, cy, reach * 0.35, cx, cy, reach);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(20, 8, 0, 0.6)");
    g.fillStyle = vignette;
    g.fillRect(0, 0, WIDTH, HEIGHT);
  };

  const shine = (g, x, y, rx, ry, rot) => {
    g.fillStyle = "rgba(255, 255, 255, 0.32)";
    oval(g, x, y, rx, ry, rot);
  };

  const paintMelon = (g, r) => {
    const ry = r * 0.9;
    g.fillStyle = "#0d3510";
    oval(g, 0, 0, r + 1, ry + 1, 0);
    const base = g.createRadialGradient(-r * 0.35, -ry * 0.4, 1, 0, 0, r * 1.1);
    base.addColorStop(0, "#9be064");
    base.addColorStop(0.5, "#3f9e2e");
    base.addColorStop(1, "#1a541b");
    g.fillStyle = base;
    oval(g, 0, 0, r, ry, 0);
    g.save();
    g.clip();
    g.strokeStyle = "rgba(14, 64, 18, 0.8)";
    g.lineWidth = 2.6;
    g.lineJoin = "round";
    g.beginPath();
    for (let k = -3; k <= 3; k += 1) {
      const x0 = k * r * 0.3;
      for (let j = 0; j <= 10; j += 1) {
        const y = -ry + (j * 2 * ry) / 10;
        const bulge = Math.sqrt(Math.max(0, 1 - (y / ry) ** 2));
        const x = x0 * (0.35 + bulge * 0.65) + (j % 2 ? 1.1 : -1.1);
        if (j === 0) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }
    }
    g.stroke();
    g.restore();
    shine(g, -r * 0.4, -ry * 0.48, r * 0.34, ry * 0.18, -0.5);
  };

  const paintOrange = (g, r) => {
    g.fillStyle = "#7a3300";
    disc(g, 0, 0, r + 1);
    const base = g.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r * 1.1);
    base.addColorStop(0, "#ffd88a");
    base.addColorStop(0.45, "#ff9d1c");
    base.addColorStop(1, "#cc560a");
    g.fillStyle = base;
    disc(g, 0, 0, r);
    g.fillStyle = "rgba(150, 64, 0, 0.25)";
    for (let n = 0; n < 22; n += 1) {
      const a = rand(0, TAU);
      const d = Math.sqrt(Math.random()) * (r - 1.5);
      g.fillRect(Math.cos(a) * d, Math.sin(a) * d, 0.9, 0.9);
    }
    g.fillStyle = "#5a3a12";
    disc(g, 0, -r + 1.6, 1.5);
    g.fillStyle = "#4cae3a";
    oval(g, 4, -r - 0.4, 4.2, 1.8, -0.4);
    shine(g, -r * 0.4, -r * 0.42, r * 0.3, r * 0.18, -0.6);
  };

  const paintApple = (g, r) => {
    const k = r / 13.5;
    g.save();
    g.scale(k, k);
    g.beginPath();
    g.moveTo(0, -9.5);
    g.bezierCurveTo(7, -15, 15.5, -9, 13.5, 2);
    g.bezierCurveTo(12.2, 10.5, 6, 15, 0, 12.6);
    g.bezierCurveTo(-6, 15, -12.2, 10.5, -13.5, 2);
    g.bezierCurveTo(-15.5, -9, -7, -15, 0, -9.5);
    g.closePath();
    g.strokeStyle = "#5c0710";
    g.lineWidth = 2;
    g.stroke();
    const base = g.createRadialGradient(-4, -5, 1, 0, 0, 16);
    base.addColorStop(0, "#ff9a8f");
    base.addColorStop(0.5, "#e3232f");
    base.addColorStop(1, "#8e0e1a");
    g.fillStyle = base;
    g.fill();
    g.strokeStyle = "#5a3512";
    g.lineWidth = 1.6;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(0, -9);
    g.quadraticCurveTo(0.4, -13, 1.8, -16);
    g.stroke();
    g.fillStyle = "#58b83a";
    oval(g, 5.4, -14.2, 4.2, 1.9, -0.5);
    shine(g, -6.2, -3.5, 2.4, 4.4, 0.4);
    g.restore();
  };

  const paintKiwi = (g, r) => {
    const ry = r * 0.82;
    g.fillStyle = "#33200c";
    oval(g, 0, 0, r + 1, ry + 1, 0);
    const base = g.createRadialGradient(-r * 0.3, -ry * 0.4, 1, 0, 0, r * 1.1);
    base.addColorStop(0, "#c9a066");
    base.addColorStop(0.5, "#8f6638");
    base.addColorStop(1, "#5a3c1e");
    g.fillStyle = base;
    oval(g, 0, 0, r, ry, 0);
    g.strokeStyle = "rgba(245, 220, 170, 0.35)";
    g.lineWidth = 0.6;
    g.beginPath();
    for (let n = 0; n < 30; n += 1) {
      const a = rand(0, TAU);
      const d = Math.sqrt(Math.random()) * 0.9;
      const x = Math.cos(a) * d * r;
      const y = Math.sin(a) * d * ry;
      g.moveTo(x, y);
      g.lineTo(x + rand(-1.2, 1.2), y + rand(-1.2, 1.2));
    }
    g.stroke();
    g.fillStyle = "#3a250e";
    disc(g, r - 0.8, 0, 1.3);
    shine(g, -r * 0.35, -ry * 0.45, r * 0.3, ry * 0.16, -0.3);
  };

  const paintBomb = (g) => {
    const r = BOMB_R;
    g.fillStyle = "#6b7080";
    g.fillRect(-4.2, -r - 3.5, 8.4, 5);
    g.fillStyle = "#b4bccb";
    g.fillRect(-4.2, -r - 3.5, 8.4, 1.2);
    g.fillStyle = "#000000";
    disc(g, 0, 0, r + 1);
    const base = g.createRadialGradient(-4, -5, 1, 0, 0, r * 1.15);
    base.addColorStop(0, "#8a92a6");
    base.addColorStop(0.4, PALETTE.bomb);
    base.addColorStop(1, "#0b0c10");
    g.fillStyle = base;
    disc(g, 0, 0, r);
    // Rim light so the bomb never melts into the dark wood.
    g.strokeStyle = "rgba(255, 120, 100, 0.55)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(0, 0, r - 0.8, 0.2, Math.PI - 0.2);
    g.stroke();
    shine(g, -4.6, -5.2, 3.4, 2, -0.6);
  };

  const paintFace = (g, index, rx, ry) => {
    const ellipse = (w, h, color) => {
      g.fillStyle = color;
      oval(g, 0, 0, w, h, 0);
    };
    if (index === 0) {
      ellipse(rx, ry, "#1f6b22");
      ellipse(rx - 1.6, ry - 1, "#d8f5b0");
      const flesh = g.createRadialGradient(0, 0, 1, 0, 0, rx);
      flesh.addColorStop(0, "#ff7a88");
      flesh.addColorStop(1, "#e3203a");
      g.fillStyle = flesh;
      oval(g, 0, 0, rx - 3.4, ry - 2.2, 0);
      g.fillStyle = "#1a0d0d";
      for (let n = 0; n < 8; n += 1) {
        const a = (n / 8) * TAU + 0.3;
        oval(g, Math.cos(a) * rx * 0.5, Math.sin(a) * ry * 0.45, 1, 0.55, a);
      }
    } else if (index === 1) {
      ellipse(rx, ry, "#ff9d1c");
      ellipse(rx - 1.5, ry - 0.9, "#fff1d6");
      ellipse(rx - 2.8, ry - 1.8, "#ffb43a");
      g.strokeStyle = "rgba(255, 240, 210, 0.85)";
      g.lineWidth = 0.6;
      g.beginPath();
      for (let n = 0; n < 10; n += 1) {
        const a = (n / 10) * TAU;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * (rx - 3), Math.sin(a) * (ry - 2));
      }
      g.stroke();
      ellipse(1.6, 0.8, "#fff1d6");
    } else if (index === 2) {
      ellipse(rx, ry, "#c8182a");
      ellipse(rx - 1.2, ry - 0.8, "#fff4d2");
      ellipse(rx * 0.36, ry * 0.42, "#f0dc9c");
      g.fillStyle = "#5a3512";
      g.beginPath();
      g.ellipse(-1.6, 0, 1.3, 0.7, 0, 0, TAU);
      g.ellipse(1.6, 0, 1.3, 0.7, 0, 0, TAU);
      g.fill();
    } else {
      ellipse(rx, ry, "#7a5530");
      const flesh = g.createRadialGradient(0, 0, 1, 0, 0, rx);
      flesh.addColorStop(0, "#d4f58a");
      flesh.addColorStop(1, "#5fb526");
      g.fillStyle = flesh;
      oval(g, 0, 0, rx - 1.2, ry - 0.8, 0);
      ellipse(rx * 0.3, ry * 0.32, "#f5f8dc");
      g.fillStyle = "#14140a";
      for (let n = 0; n < 12; n += 1) {
        const a = (n / 12) * TAU;
        g.fillRect(Math.cos(a) * rx * 0.48 - 0.5, Math.sin(a) * ry * 0.52 - 0.5, 1, 1);
      }
    }
  };

  // Row 0: whole fruits + bomb. Row 1: cut halves (dome up, face on y = 0).
  const PAINTERS = [paintMelon, paintOrange, paintApple, paintKiwi];
  const atlas = makeAtlas(5, 2, CELL, CELL, FS, (g, col, row) => {
    if (col === 4) {
      if (row === 0) {
        paintBomb(g);
      }
      return;
    }
    const r = FRUITS[col].r;
    if (row === 1) {
      g.beginPath();
      g.rect(-CELL / 2, -CELL / 2, CELL, CELL / 2);
      g.save();
      g.clip();
      PAINTERS[col](g, r);
      g.restore();
      paintFace(g, col, r * 0.96, r * 0.4);
      return;
    }
    PAINTERS[col](g, r);
  });

  paintBoard();

  const missGlow = ctx.createLinearGradient(0, HEIGHT - LAYOUT.missBand, 0, HEIGHT);
  missGlow.addColorStop(0, "rgba(255, 50, 40, 0)");
  missGlow.addColorStop(1, "rgba(255, 50, 40, 0.6)");

  /* -- State */

  const game = {
    time: 0,
    items: [],
    halves: [],
    stains: [],
    trail: [],
    ghosts: [],
    spawnTimer: 0,
    strikes: 0,
    endDelay: 0,
    flash: 0,
    missFlash: 0,
    swipeHits: 0,
    comboTimer: 0,
    comboX: 0,
    comboY: 0,
    comboText: "",
    comboAge: 1,
    blading: false,
    bladeId: 0,
    keyUp: false,
    keyDown: false,
    keyY: 0,
    keyShow: 0,
    keyCooldown: 0
  };

  const updateStrikes = () => {
    strikePips.forEach((pip, index) => {
      pip.classList.toggle("on", index < game.strikes);
    });
  };

  // floatText kept inside the play area so short formats never clip it.
  const say = (x, y, text, color) => {
    floatText(clamp(x, SAFE.x + 20, SAFE.x + SAFE.w - 20), clamp(y, SAFE.y + 8, SAFE.y + SAFE.h - 6), text, color);
  };

  const resetGame = () => {
    game.time = 0;
    game.items.length = 0;
    game.halves.length = 0;
    game.stains.length = 0;
    game.trail.length = 0;
    game.ghosts.length = 0;
    game.spawnTimer = 0.5;
    game.strikes = 0;
    game.endDelay = 0;
    game.flash = 0;
    game.missFlash = 0;
    game.swipeHits = 0;
    game.comboTimer = 0;
    game.comboAge = 1;
    game.blading = false;
    game.keyUp = false;
    game.keyDown = false;
    game.keyY = SAFE.y + SAFE.h * 0.45;
    game.keyShow = 0;
    game.keyCooldown = 0;
    updateStrikes();
  };

  /* -- Spawning */

  const launch = (bomb, delay) => {
    if (game.items.length >= MAX_ITEMS) {
      return;
    }
    const type = bomb ? -1 : Math.floor(Math.random() * FRUITS.length);
    const r = (bomb ? BOMB_R : FRUITS[type].r) * FS;
    const launchY = HEIGHT + r + LAYOUT.launchPad;
    const x = rand(SAFE.x + LAYOUT.spawnInset, SAFE.x + SAFE.w - LAYOUT.spawnInset);
    const apex = rand(SAFE.y + LAYOUT.apexTop + r, SAFE.y + Math.max(LAYOUT.apexBottom, LAYOUT.apexTop + r + 4));
    const vy = -Math.sqrt(2 * GRAVITY * (launchY - apex));
    const flight = (-2 * vy) / GRAVITY;
    const land = rand(SAFE.x + LAYOUT.landInset, SAFE.x + SAFE.w - LAYOUT.landInset);
    game.items.push({
      bomb,
      type,
      r,
      x,
      y: launchY,
      vx: (land - x) / flight,
      vy,
      rot: rand(0, TAU),
      vr: rand(-3, 3) * (bomb ? 0.4 : 1),
      delay,
      apexed: false
    });
  };

  const launchVolley = (live) => {
    const t = live ? Shell.elapsed / 1000 : 8;
    const step = LAYOUT.ramp.find((entry) => t < entry.until);
    const count = step.min + Math.floor(Math.random() * (step.max - step.min + 1));
    for (let n = 0; n < count; n += 1) {
      launch(false, n * 0.14);
    }
    const bombLive = game.items.some((item) => item.bomb);
    if (live && !bombLive && Math.random() < step.bomb) {
      launch(true, count * 0.14);
    }
    game.spawnTimer = step.gap * rand(0.85, 1.15);
  };

  /* -- Slicing */

  const addStain = (x, y, color, r) => {
    if (game.stains.length >= MAX_STAINS) {
      game.stains.shift();
    }
    const blobs = [[0, 0, r * 0.85]];
    for (let n = 0; n < 4; n += 1) {
      const a = rand(0, TAU);
      const d = rand(r * 0.7, r * 1.5);
      blobs.push([Math.cos(a) * d, Math.sin(a) * d, rand(1.5, 3.5) * Math.max(0.5, FS)]);
    }
    game.stains.push({ x, y, color, blobs, age: 0, life: 1.3 });
  };

  const addHalf = (item, angle, side) => {
    if (game.halves.length >= MAX_HALVES) {
      game.halves.shift();
    }
    // Normal of the cut; each half drifts away on its own side of the blade.
    const nx = -Math.sin(angle) * side;
    const ny = Math.cos(angle) * side;
    const kick = 60 * Math.max(0.5, FS);
    game.halves.push({
      type: item.type,
      x: item.x + nx * 2 * FS,
      y: item.y + ny * 2 * FS,
      vx: item.vx * 0.4 + nx * kick + Math.cos(angle) * 18 * FS,
      vy: Math.min(item.vy, 0) * 0.3 + ny * kick - 40 * FS,
      rot: angle + (side > 0 ? Math.PI : 0),
      vr: side * rand(2.5, 5.5)
    });
  };

  const splitFruit = (item, angle) => {
    const spec = FRUITS[item.type];
    const speed = Math.max(0.6, FS);
    addHalf(item, angle, -1);
    addHalf(item, angle, 1);
    burst(item.x, item.y, spec.juice, 14, 150 * speed);
    burst(item.x, item.y, spec.flesh, 5, 90 * speed);
    addStain(item.x, item.y, spec.juice, item.r);
  };

  const settleCombo = () => {
    if (game.swipeHits >= COMBO_MIN) {
      const bonus = game.swipeHits * FRUIT_POINTS;
      setScore(Shell.score + bonus);
      game.comboText = `${game.swipeHits}x COMBO +${bonus}`;
      game.comboAge = 0;
      burst(game.comboX, game.comboY, PALETTE.combo, 12, 120 * Math.max(0.6, FS));
    }
    game.swipeHits = 0;
    game.comboTimer = 0;
  };

  const addStrike = (x, bomb) => {
    game.strikes += 1;
    updateStrikes();
    if (!bomb) {
      game.missFlash = 1;
      say(x, HEIGHT - LAYOUT.missBand * 0.36, "MISS", PALETTE.miss);
    }
    if (game.strikes >= MAX_STRIKES && game.endDelay <= 0) {
      // Let the hit read for a beat before the end card covers it.
      game.endDelay = END_DELAY;
      game.blading = false;
    }
  };

  const hitBomb = (item) => {
    const speed = Math.max(0.6, FS);
    burst(item.x, item.y, PALETTE.fire, 22, 170 * speed);
    burst(item.x, item.y, PALETTE.smoke, 12, 90 * speed);
    burst(item.x, item.y, "#ffffff", 8, 120 * speed);
    say(item.x, item.y - item.r - 6, "BOOM!", PALETTE.fire);
    shake();
    game.flash = reduceMotion ? 0.2 : 1;
    game.swipeHits = 0;
    game.comboTimer = 0;
    addStrike(item.x, true);
  };

  const sliceFruit = (item, angle) => {
    const spec = FRUITS[item.type];
    const half = LAYOUT.combo * 3.4;   // about half the combo text width
    splitFruit(item, angle);
    setScore(Shell.score + FRUIT_POINTS);
    say(item.x, item.y - item.r - 4, `+${FRUIT_POINTS}`, spec.juice);
    game.swipeHits += 1;
    game.comboTimer = COMBO_WINDOW;
    game.comboX = clamp(item.x, SAFE.x + half, SAFE.x + SAFE.w - half);
    game.comboY = clamp(item.y - item.r * 1.5, SAFE.y + LAYOUT.combo, SAFE.y + SAFE.h - LAYOUT.combo);
  };

  // Segment-circle test against every airborne item.
  const sliceSegment = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 0.01 || game.endDelay > 0) {
      return;
    }
    const angle = Math.atan2(dy, dx);
    for (let index = game.items.length - 1; index >= 0; index -= 1) {
      const item = game.items[index];
      if (item.delay > 0 || item.y > HEIGHT + item.r) {
        continue;
      }
      const t = clamp(((item.x - x1) * dx + (item.y - y1) * dy) / len2, 0, 1);
      const ox = x1 + dx * t - item.x;
      const oy = y1 + dy * t - item.y;
      const reach = item.r + LAYOUT.bladePad;
      if (ox * ox + oy * oy <= reach * reach) {
        game.items.splice(index, 1);
        if (item.bomb) {
          hitBomb(item);
          return;
        }
        sliceFruit(item, angle);
      }
    }
  };

  const addGhost = (x1, y1, x2, y2) => {
    game.ghosts.push({ x1, y1, x2, y2, age: 0 });
  };

  /* -- Simulation steps */

  const stepItems = (dt, live) => {
    for (let index = game.items.length - 1; index >= 0; index -= 1) {
      const item = game.items[index];
      if (item.delay > 0) {
        item.delay -= dt;
        continue;
      }
      item.vy += GRAVITY * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.rot += item.vr * dt;
      if (!item.apexed && item.vy >= 0) {
        item.apexed = true;
        // Attract mode: a ghost blade slices most fruit at the top of the arc.
        if (!live && Shell.phase === "intro" && !item.bomb && Math.random() < 0.7) {
          const angle = rand(-0.5, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI);
          const reach = item.r * 2.2;
          const cx = Math.cos(angle) * reach;
          const cy = Math.sin(angle) * reach;
          addGhost(item.x - cx, item.y - cy, item.x + cx, item.y + cy);
          game.items.splice(index, 1);
          splitFruit(item, angle);
          continue;
        }
      }
      if (item.vy > 0 && item.y > HEIGHT + item.r + 6) {
        game.items.splice(index, 1);
        if (live && !item.bomb && game.endDelay <= 0) {
          addStrike(item.x, false);
        }
      }
    }
  };

  const stepDebris = (dt) => {
    for (let index = game.halves.length - 1; index >= 0; index -= 1) {
      const half = game.halves[index];
      half.vy += GRAVITY * dt;
      half.x += half.vx * dt;
      half.y += half.vy * dt;
      half.rot += half.vr * dt;
      if (half.y > HEIGHT + CELL * FS) {
        game.halves.splice(index, 1);
      }
    }
    for (let index = game.stains.length - 1; index >= 0; index -= 1) {
      const stain = game.stains[index];
      stain.age += dt;
      if (stain.age >= stain.life) {
        game.stains.splice(index, 1);
      }
    }
    for (let index = game.trail.length - 1; index >= 0; index -= 1) {
      game.trail[index].age += dt;
    }
    while (game.trail.length && game.trail[0].age > TRAIL_LIFE) {
      game.trail.shift();
    }
    for (let index = game.ghosts.length - 1; index >= 0; index -= 1) {
      const ghost = game.ghosts[index];
      ghost.age += dt;
      if (ghost.age > 0.2) {
        game.ghosts.splice(index, 1);
      }
    }
    game.flash = Math.max(0, game.flash - dt * 2.6);
    game.missFlash = Math.max(0, game.missFlash - dt * 2.2);
    game.comboAge += dt;
  };

  // Runs only in the play phase.
  const update = (dt) => {
    if (dt <= 0) {
      return;
    }
    game.time += dt;
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0 && game.endDelay <= 0) {
      launchVolley(true);
    }
    stepItems(dt, true);
    stepDebris(dt);

    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) {
        settleCombo();
      }
    }

    if (game.keyUp) {
      game.keyY -= KEY_LINE_SPEED * dt;
    }
    if (game.keyDown) {
      game.keyY += KEY_LINE_SPEED * dt;
    }
    game.keyY = clamp(game.keyY, SAFE.y + 8, SAFE.y + SAFE.h - 8);
    game.keyShow = Math.max(0, game.keyShow - dt);
    game.keyCooldown = Math.max(0, game.keyCooldown - dt);

    if (Shell.score >= CONFIG.goal) {
      endGame(true);
      return;
    }
    if (game.endDelay > 0) {
      game.endDelay -= dt;
      if (game.endDelay <= 0) {
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
    if (Shell.phase === "intro") {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        launchVolley(false);
      }
    }
    stepItems(dt, false);
    stepDebris(dt);
  };

  /* -- Rendering */

  const drawSprite = (col, row, x, y, rot) => {
    setXf(x, y, rot, FS);
    ctx.drawImage(atlas.canvas, col * atlas.cw, row * atlas.ch, atlas.cw, atlas.ch, -CELL / 2, -CELL / 2, CELL, CELL);
  };

  const drawStains = () => {
    game.stains.forEach((stain) => {
      ctx.globalAlpha = 0.55 * (1 - stain.age / stain.life);
      ctx.fillStyle = stain.color;
      ctx.beginPath();
      stain.blobs.forEach(([dx, dy, r]) => {
        ctx.moveTo(stain.x + dx + r, stain.y + dy);
        ctx.arc(stain.x + dx, stain.y + dy, r, 0, TAU);
      });
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  };

  const drawItems = (time) => {
    // Soft drop shadows first, so every fruit floats above the board.
    const sx = 5 * FS;
    const sy = 8 * FS;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    game.items.forEach((item) => {
      if (item.delay <= 0 && item.y < HEIGHT + item.r) {
        ctx.moveTo(item.x + sx + item.r, item.y + sy);
        ctx.ellipse(item.x + sx, item.y + sy, item.r, item.r * 0.85, 0, 0, TAU);
      }
    });
    ctx.fill();

    game.items.forEach((item) => {
      if (item.delay > 0 || item.y > HEIGHT + item.r + 10) {
        return;
      }
      if (!item.bomb) {
        drawSprite(item.type, 0, item.x, item.y, item.rot);
        return;
      }
      // Bomb: pulsing danger ring, sprite, fuse and live sparks (authored units).
      resetXf();
      const pulse = 0.5 + Math.sin(time * 12) * 0.5;
      ctx.strokeStyle = PALETTE.danger;
      ctx.globalAlpha = 0.35 + pulse * 0.45;
      ctx.lineWidth = 2 * Math.max(0.6, FS);
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r + (4 + pulse * 2) * FS, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawSprite(4, 0, item.x, item.y, item.rot);
      ctx.strokeStyle = PALETTE.fuse;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, -BOMB_R - 3);
      ctx.quadraticCurveTo(1, -BOMB_R - 9, 6, -BOMB_R - 10);
      ctx.stroke();
      const tipX = 6;
      const tipY = -BOMB_R - 10;
      ctx.fillStyle = "rgba(255, 160, 60, 0.45)";
      disc(ctx, tipX, tipY, 3.5 + Math.random() * 1.5);
      ctx.strokeStyle = PALETTE.spark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let n = 0; n < 4; n += 1) {
        const a = rand(0, TAU);
        const len = rand(2.5, 6);
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + Math.cos(a) * len, tipY + Math.sin(a) * len);
      }
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      disc(ctx, tipX, tipY, 1.3);
    });
    resetXf();
  };

  const drawHalves = () => {
    game.halves.forEach((half) => {
      drawSprite(half.type, 1, half.x, half.y, half.rot);
    });
    resetXf();
  };

  const strokeSegment = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawBlade = () => {
    const b = LAYOUT.blade;
    ctx.lineCap = "round";
    const n = game.trail.length;
    for (let index = 1; index < n; index += 1) {
      const a = game.trail[index - 1];
      const p = game.trail[index];
      const k = index / (n - 1);
      const fade = clamp(1 - p.age / TRAIL_LIFE, 0, 1);
      ctx.globalAlpha = fade * 0.4;
      ctx.strokeStyle = PALETTE.bladeGlow;
      ctx.lineWidth = (2 + 7 * k) * b;
      strokeSegment(a.x, a.y, p.x, p.y);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = PALETTE.blade;
      ctx.lineWidth = (0.8 + 3 * k) * b;
      strokeSegment(a.x, a.y, p.x, p.y);
    }
    game.ghosts.forEach((ghost) => {
      const fade = clamp(1 - ghost.age / 0.2, 0, 1);
      ctx.globalAlpha = fade * 0.4;
      ctx.strokeStyle = PALETTE.bladeGlow;
      ctx.lineWidth = (7 * fade + 1) * b;
      strokeSegment(ghost.x1, ghost.y1, ghost.x2, ghost.y2);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = PALETTE.blade;
      ctx.lineWidth = (2.5 * fade + 0.5) * b;
      strokeSegment(ghost.x1, ghost.y1, ghost.x2, ghost.y2);
    });
    ctx.globalAlpha = 1;
  };

  const drawKeyGuide = () => {
    if (game.keyShow <= 0) {
      return;
    }
    const y = game.keyY;
    const left = SAFE.x + 4;
    const right = SAFE.x + SAFE.w - 4;
    ctx.globalAlpha = Math.min(1, game.keyShow) * 0.6;
    ctx.strokeStyle = PALETTE.bladeGlow;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    strokeSegment(left + 8, y, right - 8, y);
    ctx.setLineDash([]);
    ctx.fillStyle = PALETTE.bladeGlow;
    ctx.beginPath();
    ctx.moveTo(left, y - 5);
    ctx.lineTo(left + 7, y);
    ctx.lineTo(left, y + 5);
    ctx.moveTo(right, y - 5);
    ctx.lineTo(right - 7, y);
    ctx.lineTo(right, y + 5);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const drawCombo = () => {
    if (game.comboAge >= 0.9) {
      return;
    }
    const t = game.comboAge;
    const s = Math.max(0.01, easeOutBack(clamp(t / 0.25, 0, 1)));
    ctx.globalAlpha = clamp((0.9 - t) / 0.3, 0, 1);
    setXf(game.comboX, game.comboY - t * LAYOUT.combo * 0.8, -0.06, s);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${LAYOUT.combo}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = "#7a1a00";
    ctx.fillText(game.comboText, 0, LAYOUT.combo * 0.12);
    ctx.fillStyle = PALETTE.combo;
    ctx.fillText(game.comboText, 0, 0);
    resetXf();
    ctx.globalAlpha = 1;
  };

  const draw = (time) => {
    ctx.drawImage(board.canvas, 0, 0, WIDTH, HEIGHT);
    drawStains();
    drawHalves();
    drawItems(time);
    drawFx();
    drawKeyGuide();
    drawBlade();
    drawCombo();

    if (game.missFlash > 0) {
      ctx.globalAlpha = game.missFlash;
      ctx.fillStyle = missGlow;
      ctx.fillRect(0, HEIGHT - LAYOUT.missBand, WIDTH, LAYOUT.missBand);
      ctx.globalAlpha = 1;
    }
    if (game.flash > 0) {
      ctx.globalAlpha = game.flash * 0.6;
      ctx.fillStyle = "#fff1dc";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    }
  };

  /* -- Input */

  const stamp = (event) => (event && event.timeStamp > 0 ? event.timeStamp : performance.now());

  const pushTrail = (x, y, ts) => {
    game.trail.push({ x, y, ts, age: 0 });
    if (game.trail.length > TRAIL_MAX) {
      game.trail.shift();
    }
  };

  const onPointerDown = (point, event) => {
    if (game.endDelay > 0) {
      return;
    }
    settleCombo();
    game.blading = true;
    game.bladeId = event && event.pointerId !== undefined ? event.pointerId : 0;
    game.trail.length = 0;
    pushTrail(point.x, point.y, stamp(event));
  };

  const onPointerMove = (point, event) => {
    if (!game.blading || (event && event.pointerId !== undefined && event.pointerId !== game.bladeId)) {
      return;
    }
    const ts = stamp(event);
    const prev = game.trail[game.trail.length - 1];
    if (!prev) {
      pushTrail(point.x, point.y, ts);
      return;
    }
    const dist = Math.hypot(point.x - prev.x, point.y - prev.y);
    if (dist < 0.5) {
      return;
    }
    const seconds = Math.max(ts - prev.ts, 4) / 1000;
    pushTrail(point.x, point.y, ts);
    if (dist / seconds >= SLICE_SPEED) {
      sliceSegment(prev.x, prev.y, point.x, point.y);
    }
  };

  const onPointerUp = (point, event) => {
    if (!event || event.pointerId === undefined || event.pointerId === game.bladeId) {
      game.blading = false;
    }
  };

  // Keyboard play: Up/Down aim a slash line, Space/Enter/Left/Right swing it.
  const onKey = (key, down) => {
    if (key === "ArrowUp" || key === "ArrowDown") {
      game[key === "ArrowUp" ? "keyUp" : "keyDown"] = down;
      game.keyShow = 2.5;
      return true;
    }
    if (key === " " || key === "Enter" || key === "ArrowLeft" || key === "ArrowRight") {
      if (down && game.keyCooldown <= 0 && game.endDelay <= 0) {
        settleCombo();
        const tilt = Math.min(6, SAFE.h * 0.05);
        const fromRight = key === "ArrowLeft";
        const x1 = fromRight ? SAFE.x + SAFE.w - 6 : SAFE.x + 6;
        const x2 = fromRight ? SAFE.x + 6 : SAFE.x + SAFE.w - 6;
        sliceSegment(x1, game.keyY - tilt, x2, game.keyY + tilt);
        addGhost(x1, game.keyY - tilt, x2, game.keyY + tilt);
        game.keyCooldown = KEY_SLASH_COOLDOWN;
        game.keyShow = 2.5;
      }
      return true;
    }
    return false;
  };

  // Seed the attract scene: fruit already tossing behind the intro panel.
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
