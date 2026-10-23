(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-stack-tower",        // CustomEvent namespace
    api: "mgStackTower",                  // window.<api> handle
    campaign: "kubo-k3",
    offer: "−25%",
    winTitle: "Top floor!",
    loseTitle: "Tower toppled!",
    goal: 12,                             // floors that count as a win
    maxPlayMs: 45000,                     // hard stop: a session never runs past this
    idleStopMs: 30000                     // stop the attract loop after this long untouched
  };

  const PALETTE = {
    pedestal: { top: "#4a4370", left: "#2f2a50", right: "#211c3b", rim: "rgba(255, 255, 255, 0.22)" },
    sun: "#ffd98a",
    sunGlow: "rgba(255, 196, 120, 0.4)",
    hillBack: "rgba(120, 52, 110, 0.75)",
    hillFront: "#3a1f4f",
    window: "rgba(255, 214, 140, 0.8)",
    cloud: "rgba(255, 255, 255, 0.09)",
    star: "#fff6e6",
    ring: "#ffffff",
    perfect: "#ffe27a",
    miss: "#ff6b6b",
    shadow: "rgba(10, 4, 30, 0.22)",
    hintBg: "rgba(26, 16, 51, 0.62)",
    text: "#fff6ec"
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

  // Per-format tuning. Popup and rail look at the stack isometrically and
  // alternate the slide axis; the 53 px strip uses a low side view where every
  // slab slides left-right across the wide band. proj maps world x/z to screen:
  // [x->sx, z->sx, x->sy, z->sy]. World units are about one served px.
  const LAYOUT = {
    popup: {
      decor: 1, proj: [0.866, -0.866, 0.5, 0.5], axes: ["x", "z"],
      origin: [SAFE.x + SAFE.w / 2, SAFE.y + 126], base: { w: 56, d: 56 }, slabH: 10, hover: 7,
      slide: { range: 62, enter: 18, speed: 66, step: 4 }, perfect: 3, grow: 6, winZoom: 0.7,
      hint: "TAP · SPACE TO DROP", hintFont: 9
    },
    rail: {
      decor: 0.55, proj: [0.72, -0.72, 0.46, 0.46], axes: ["x", "z"],
      origin: [SAFE.x + SAFE.w / 2, SAFE.y + SAFE.h * 0.55], base: { w: 30, d: 30 }, slabH: 7, hover: 5,
      slide: { range: 30, enter: 6, speed: 36, step: 2.2 }, perfect: 2.2, grow: 3.5, winZoom: 0.62,
      hint: "TAP TO DROP", hintFont: 7.5
    },
    strip: {
      decor: 0.45, proj: [1, -0.55, 0, 0.35], axes: ["x"],
      origin: [SAFE.x + SAFE.w / 2, HEIGHT * 0.62], base: { w: 72, d: 10 }, slabH: 4.2, hover: 3,
      slide: { range: 100, enter: 10, speed: 70, step: 3.5 }, perfect: 3.5, grow: 7, winZoom: 0.7,
      hint: "TAP · SPACE TO DROP", hintFont: 7.5
    }
  }[FORMAT];

  const TAU = Math.PI * 2;
  const PROJ = LAYOUT.proj;
  const ORIGIN = { x: LAYOUT.origin[0], y: LAYOUT.origin[1] };  // screen point of the stack top center
  const BASE = LAYOUT.base;                // starting slab footprint in world units
  const SLAB_H = LAYOUT.slabH;
  const PEDESTAL_H = 400;
  const HOVER = LAYOUT.hover;              // sliding slab floats this far above the stack
  const SLIDE = LAYOUT.slide;
  const PERFECT = LAYOUT.perfect;          // |offset| that snaps as a perfect drop
  const GROW = { streak: 3, amount: LAYOUT.grow };
  const GRAVITY = 620 * Math.max(0.6, LAYOUT.decor);
  const DROP_COOLDOWN = 0.18;              // swallows an accidental double tap on a fresh slab
  const FAIL_DELAY = 1.1;
  const WIN_DELAY = 0.55;
  const DEMO_FLOORS = 14;
  const SLAB_HUE = 172;
  const SLAB_HUE_STEP = 13;
  const D = LAYOUT.decor;                  // background art / particle scale
  // Sky stops [hue, sat, light] at ground level -> at goal height: sunset into night.
  const SKY = {
    top: [[272, 48, 24], [232, 52, 9]],
    mid: [[330, 60, 40], [262, 48, 16]],
    low: [[375, 82, 60], [290, 55, 26]]
  };
  const CLOUD_H = Math.max(HEIGHT * 1.2, 60);
  const HILL_H = Math.max(22, Math.min(96, HEIGHT * 0.4));

  const lerp = (a, b, t) => a + (b - a) * t;

  const makeCanvas = (w, h, paint) => {
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(w * DPR);
    layer.height = Math.ceil(h * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    paint(g, w, h);
    return layer;
  };

  const pillPath = (g, x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };

  const starLayer = makeCanvas(WIDTH, HEIGHT, (g, w, h) => {
    g.fillStyle = PALETTE.star;
    const count = Math.round((w * h) / 1070);
    for (let index = 0; index < count; index += 1) {
      const size = rand(0.6, 1.6) * Math.max(0.6, D);
      g.globalAlpha = rand(0.25, 1);
      g.fillRect(rand(0, w), rand(0, h), size, size);
    }
    g.globalAlpha = 1;
  });

  // Soft cloud puffs, wrapped top/bottom so the layer tiles vertically.
  const cloudLayer = makeCanvas(WIDTH, CLOUD_H, (g, w, h) => {
    g.fillStyle = PALETTE.cloud;
    const count = Math.max(3, Math.round(h / 50));
    for (let index = 0; index < count; index += 1) {
      const cx = rand(10, w - 10);
      const cy = (index + 0.5) * (h / count) + rand(-0.3, 0.3) * (h / count);
      const puffs = [[0, 0, 26, 8], [-16, 2, 16, 6], [15, 1, 18, 7], [4, -5, 14, 7]];
      [-h, 0, h].forEach((wrap) => {
        puffs.forEach((p) => {
          g.beginPath();
          g.ellipse(cx + p[0] * D, cy + p[1] * D + wrap, p[2] * D, p[3] * D, 0, 0, TAU);
          g.fill();
        });
      });
    }
  });

  const hillLayer = makeCanvas(WIDTH, HILL_H, (g, w, h) => {
    const sunX = w * 0.3;
    const sunY = h * 0.65;
    // glow radius stays inside the layer so its top edge never shows
    const glow = g.createRadialGradient(sunX, sunY, h * 0.06, sunX, sunY, h * 0.6);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, "rgba(255, 160, 120, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    g.fillStyle = PALETTE.sun;
    g.beginPath();
    g.arc(sunX, sunY, h * 0.16, 0, TAU);
    g.fill();
    g.fillStyle = PALETTE.hillBack;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 10 * D) {
      g.lineTo(x, h * 0.6 + (Math.sin(x * 0.03 / D) * 8 + Math.sin(x * 0.081 / D) * 5) * (h / 96));
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.fillStyle = PALETTE.hillFront;
    for (let x = 0; x < w;) {
      const bw = rand(10, 22) * D;
      const bh = rand(0.12, 0.31) * h;
      g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = PALETTE.window;
      for (let wy = h - bh + 4 * D; wy < h - 3 * D; wy += 6 * D) {
        for (let wx = x + 3 * D; wx < x + bw - 3 * D; wx += 5 * D) {
          if (Math.random() < 0.25) {
            g.fillRect(wx, wy, 1.6 * Math.max(0.6, D), 2 * Math.max(0.6, D));
          }
        }
      }
      g.fillStyle = PALETTE.hillFront;
      x += bw + rand(0, 3) * D;
    }
  });

  const slabColors = (index) => {
    const hue = (SLAB_HUE + index * SLAB_HUE_STEP) % 360;
    return {
      top: `hsl(${hue}, 82%, 68%)`,
      left: `hsl(${hue}, 70%, 54%)`,
      right: `hsl(${hue}, 64%, 41%)`,
      rim: `hsla(${hue}, 100%, 90%, 0.9)`,
      spark: `hsl(${hue}, 90%, 74%)`
    };
  };

  const game = {
    mode: "demo",     // demo | slide | fail | won
    t: 0,
    stack: [],        // [0] is the pedestal, then placed slabs bottom to top
    cur: null,        // the sliding slab
    debris: [],
    rings: [],
    floors: 0,
    streak: 0,
    speed: SLIDE.speed,
    cam: 0,           // world height the camera is centered on
    zoom: 1,
    cooldown: 0,
    endT: 0,
    aiAim: 0,
    prevOff: 0
  };

  const sx = (x, z) => ORIGIN.x + x * PROJ[0] + z * PROJ[1];
  const sy = (x, y, z) => ORIGIN.y + x * PROJ[2] + z * PROJ[3] - (y - game.cam);

  const topSlab = () => game.stack[game.stack.length - 1];

  const textAt = (x, y, text, color) => {
    floatText(clamp(x, SAFE.x + 28, SAFE.x + SAFE.w - 28), Math.max(SAFE.y + 9, y), text, color);
  };

  const spawnSlab = () => {
    const top = topSlab();
    const n = game.floors;
    const axes = LAYOUT.axes;
    const axis = axes[n % axes.length];
    // One axis: come from alternate sides every floor; two axes: every other floor.
    const side = Math.floor(n / axes.length) % 2 === 0 ? -1 : 1;
    const cur = {
      x: top.x,
      z: top.z,
      w: top.w,
      d: top.d,
      y: top.y + top.h,
      h: SLAB_H,
      axis,
      dir: -side,
      colors: slabColors(n + 1),
      land: 0,
      glow: 0
    };
    cur[axis] = top[axis] + side * (SLIDE.range + SLIDE.enter);
    game.cur = cur;
    game.speed = SLIDE.speed + n * SLIDE.step;
    game.cooldown = DROP_COOLDOWN;
    game.aiAim = rand(-1.5, 1.5) * PERFECT;
    game.prevOff = cur[axis] - top[axis];
  };

  const resetStack = () => {
    game.stack.length = 0;
    game.stack.push({ x: 0, z: 0, w: BASE.w, d: BASE.d, y: -PEDESTAL_H, h: PEDESTAL_H, colors: PALETTE.pedestal, land: 0, glow: 0 });
    game.debris.length = 0;
    game.rings.length = 0;
    game.floors = 0;
    game.streak = 0;
    game.endT = 0;
    spawnSlab();
  };

  const startDemo = () => {
    game.mode = "demo";
    resetStack();
  };

  const resetGame = () => {
    game.mode = "slide";
    game.cam = 0;
    game.zoom = 1;
    resetStack();
  };

  const addDebris = (box, axis, sign) => {
    if (game.debris.length >= 6) {
      game.debris.shift();
    }
    game.debris.push({
      x: box.x,
      z: box.z,
      w: box.w,
      d: box.d,
      y: box.y + HOVER,   // starts where the hovering slab was drawn
      h: SLAB_H,
      colors: box.colors,
      axis,
      v: sign * rand(18, 30) * D,
      vy: 0,
      rot: 0,
      // screen-space tumble: +x falls off to the right, +z to the lower left
      spin: sign * rand(1.6, 3.2) * (axis === "x" ? 1 : -1),
      front: sign > 0,
      land: 0,
      glow: 0
    });
  };

  const drop = () => {
    const cur = game.cur;
    if (!cur || game.cooldown > 0) {
      return;
    }
    const top = topSlab();
    const axis = cur.axis;
    const dim = axis === "x" ? "w" : "d";
    const size = cur[dim];
    const delta = cur[axis] - top[axis];
    const playing = game.mode === "slide";
    const sign = delta < 0 ? -1 : 1;
    const level = cur.y;
    game.cur = null;

    if (Math.abs(delta) >= size) {
      addDebris(cur, axis, sign);
      if (playing) {
        game.mode = "fail";
        game.endT = 0;
        textAt(sx(cur.x, cur.z), sy(cur.x, level + HOVER, cur.z) - 10 * Math.max(0.6, D), "MISS!", PALETTE.miss);
        shake();
      } else {
        resetStack();
      }
      return;
    }

    const placed = { x: cur.x, z: cur.z, w: cur.w, d: cur.d, y: level, h: SLAB_H, colors: cur.colors, land: 1, glow: 1 };
    const cx = sx(top.x, top.z);
    const cy = sy(top.x, level + SLAB_H, top.z);
    if (Math.abs(delta) <= PERFECT) {
      placed[axis] = top[axis];
      game.streak += 1;
      let big = false;
      if (game.streak >= GROW.streak && placed[dim] < BASE[dim]) {
        placed[dim] = Math.min(BASE[dim], placed[dim] + GROW.amount);
        big = true;
      }
      game.rings.push({ x: placed.x, z: placed.z, w: placed.w, d: placed.d, y: level + SLAB_H, age: 0, life: big ? 0.7 : 0.5, big });
      burst(cx, cy, PALETTE.perfect, big ? 16 : 10, (big ? 110 : 80) * D);
      if (playing) {
        const label = big ? "GROW!" : game.streak > 1 ? `PERFECT x${game.streak}` : "PERFECT!";
        textAt(cx, cy - 26 * D, label, PALETTE.perfect);
      }
    } else {
      game.streak = 0;
      const cut = Math.abs(delta);
      placed[dim] = size - cut;
      placed[axis] = top[axis] + delta / 2;
      const piece = Object.assign({}, cur, { y: level });
      piece[dim] = cut;
      piece[axis] = top[axis] + (sign * (size + cut)) / 2;
      addDebris(piece, axis, sign);
      const edge = top[axis] + (sign * size) / 2;
      const ex = axis === "x" ? edge : placed.x;
      const ez = axis === "z" ? edge : placed.z;
      burst(sx(ex, ez), sy(ex, level + SLAB_H / 2, ez), cur.colors.spark, 6, 60 * D);
    }

    game.stack.push(placed);
    game.floors += 1;
    if (playing) {
      setScore(game.floors);
      if (game.floors >= CONFIG.goal) {
        game.mode = "won";
        game.endT = 0;
        burst(cx, cy, PALETTE.perfect, 18, 140 * D);
        burst(cx, cy, placed.colors.spark, 18, 120 * D);
        return;
      }
    } else if (game.floors >= DEMO_FLOORS) {
      resetStack();
      return;
    }
    spawnSlab();
  };

  const slide = (dt) => {
    const cur = game.cur;
    if (!cur) {
      return;
    }
    const top = topSlab();
    const axis = cur.axis;
    cur[axis] += cur.dir * game.speed * dt;
    const off = cur[axis] - top[axis];
    if (off > SLIDE.range && cur.dir > 0) {
      cur.dir = -1;
    } else if (off < -SLIDE.range && cur.dir < 0) {
      cur.dir = 1;
    }
  };

  const stepWorld = (dt) => {
    game.cooldown -= dt;
    if (game.mode === "slide" || game.mode === "demo") {
      slide(dt);
    }
    game.stack.forEach((s) => {
      s.land = Math.max(0, s.land - dt * 8);
      s.glow = Math.max(0, s.glow - dt * 2.5);
    });
    for (let index = game.debris.length - 1; index >= 0; index -= 1) {
      const d = game.debris[index];
      d.vy -= GRAVITY * dt;
      d.y += d.vy * dt;
      d[d.axis] += d.v * dt;
      d.rot += d.spin * dt;
      if (d.y < game.cam - HEIGHT * 1.4 - 40) {
        game.debris.splice(index, 1);
      }
    }
    for (let index = game.rings.length - 1; index >= 0; index -= 1) {
      const r = game.rings[index];
      r.age += dt;
      if (r.age >= r.life) {
        game.rings.splice(index, 1);
      }
    }
    // Ease the camera so the top stays in view; on a win pull back to show the tower.
    const top = topSlab();
    const level = top.y + top.h;
    const won = game.mode === "won";
    game.cam += ((won ? level * 0.55 : level) - game.cam) * (1 - Math.exp(-dt * 5));
    game.zoom += ((won ? LAYOUT.winZoom : 1) - game.zoom) * (1 - Math.exp(-dt * 3));
  };

  // Runs only in the play phase.
  const update = (dt) => {
    game.t += dt;
    stepWorld(dt);
    if (game.mode === "fail" || game.mode === "won") {
      game.endT += dt;
      if (game.mode === "fail" && game.endT >= FAIL_DELAY) {
        endGame(false);
      } else if (game.mode === "won" && game.endT >= WIN_DELAY) {
        endGame(true);
      }
    }
  };

  // Attract motion behind the intro and end panels: an autoplay builder.
  const idle = (dt) => {
    game.t += dt;
    stepWorld(dt);
    const cur = game.cur;
    if (game.mode === "demo" && cur) {
      const off = cur[cur.axis] - topSlab()[cur.axis];
      const crossed = (game.prevOff - game.aiAim) * (off - game.aiAim) <= 0;
      game.prevOff = off;
      if (crossed && game.cooldown <= 0) {
        drop();
      }
    }
  };

  const diamond = (x0, x1, z0, z1, y) => {
    ctx.beginPath();
    ctx.moveTo(sx(x0, z0), sy(x0, y, z0));
    ctx.lineTo(sx(x1, z0), sy(x1, y, z0));
    ctx.lineTo(sx(x1, z1), sy(x1, y, z1));
    ctx.lineTo(sx(x0, z1), sy(x0, y, z1));
    ctx.closePath();
  };

  // Front (z = z1) face, right (x = x1) face and top face: the three a viewer
  // above and in front of the stack can see in both projections.
  const drawBox = (b, lift) => {
    const c = b.colors;
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    const yt = b.y + b.h + lift;
    const lx = sx(x0, z1);
    const fx = sx(x1, z1);
    const rx = sx(x1, z0);
    const ly = sy(x0, yt, z1);
    const fy = sy(x1, yt, z1);
    const ry = sy(x1, yt, z0);

    ctx.fillStyle = c.left;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(fx, fy);
    ctx.lineTo(fx, fy + b.h);
    ctx.lineTo(lx, ly + b.h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = c.right;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(rx, ry);
    ctx.lineTo(rx, ry + b.h);
    ctx.lineTo(fx, fy + b.h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = c.top;
    diamond(x0, x1, z0, z1, yt);
    ctx.fill();
    if (b.glow > 0) {
      ctx.globalAlpha = b.glow * 0.7;
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = c.rim;
    ctx.lineWidth = Math.max(0.6, D);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(fx, fy);
    ctx.lineTo(rx, ry);
    ctx.stroke();
  };

  const drawDebris = (d) => {
    const cx = sx(d.x, d.z);
    const cy = sy(d.x, d.y + d.h / 2, d.z);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(d.rot);
    ctx.translate(-cx, -cy);
    drawBox(d, 0);
    ctx.restore();
  };

  // Where the sliding slab would land: its overlap with the top face.
  const drawAimShadow = () => {
    const cur = game.cur;
    const top = topSlab();
    const x0 = Math.max(cur.x - cur.w / 2, top.x - top.w / 2);
    const x1 = Math.min(cur.x + cur.w / 2, top.x + top.w / 2);
    const z0 = Math.max(cur.z - cur.d / 2, top.z - top.d / 2);
    const z1 = Math.min(cur.z + cur.d / 2, top.z + top.d / 2);
    if (x1 <= x0 || z1 <= z0) {
      return;
    }
    ctx.fillStyle = PALETTE.shadow;
    diamond(x0, x1, z0, z1, top.y + top.h);
    ctx.fill();
  };

  const drawRing = (r) => {
    const k = r.age / r.life;
    const grow = 1 + (1 - (1 - k) * (1 - k)) * (r.big ? 0.8 : 0.45);
    const hw = (r.w / 2) * grow;
    const hd = (r.d / 2) * grow;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.big ? PALETTE.perfect : PALETTE.ring;
    ctx.lineWidth = (2.5 * (1 - k) + 0.5) * Math.max(0.6, D);
    diamond(r.x - hw, r.x + hw, r.z - hd, r.z + hd, r.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawSky = () => {
    const t = clamp(game.cam / (CONFIG.goal * SLAB_H), 0, 1.3);
    const k = Math.min(t, 1);
    const tone = (stop) => {
      const a = stop[0];
      const b = stop[1];
      return `hsl(${(lerp(a[0], b[0], k) % 360).toFixed(1)}, ${lerp(a[1], b[1], k).toFixed(1)}%, ${lerp(a[2], b[2], k).toFixed(1)}%)`;
    };
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, tone(SKY.top));
    sky.addColorStop(0.6, tone(SKY.mid));
    sky.addColorStop(1, tone(SKY.low));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.globalAlpha = clamp(0.15 + t * 0.8, 0, 1);
    ctx.drawImage(starLayer, 0, 0, WIDTH, HEIGHT);

    const cloudY = ((game.cam * 0.45) % CLOUD_H + CLOUD_H) % CLOUD_H;
    ctx.globalAlpha = clamp(1 - t * 0.5, 0.3, 1);
    ctx.drawImage(cloudLayer, 0, cloudY - CLOUD_H, WIDTH, CLOUD_H);
    ctx.drawImage(cloudLayer, 0, cloudY, WIDTH, CLOUD_H);
    ctx.globalAlpha = 1;

    const hillY = HEIGHT - HILL_H + game.cam * 0.8;
    if (hillY < HEIGHT) {
      ctx.drawImage(hillLayer, 0, hillY, WIDTH, HILL_H);
    }
  };

  const drawHint = () => {
    const size = LAYOUT.hintFont;
    ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText(LAYOUT.hint).width + size * 2;
    const h = size * 2;
    // strip: bottom-right of the band, clear of the slab path
    const x = FORMAT === "strip" ? SAFE.x + SAFE.w - w / 2 - 6 : SAFE.x + SAFE.w / 2;
    const y = HEIGHT - h / 2 - (FORMAT === "strip" ? 2 : 8);
    ctx.globalAlpha = 0.6 + Math.sin(game.t * 5) * 0.25;
    ctx.fillStyle = PALETTE.hintBg;
    pillPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(LAYOUT.hint, x, y + size * 0.05);
  };

  const draw = () => {
    drawSky();

    ctx.save();
    ctx.translate(ORIGIN.x, ORIGIN.y);
    ctx.scale(game.zoom, game.zoom);
    ctx.translate(-ORIGIN.x, -ORIGIN.y);
    game.debris.forEach((d) => {
      if (!d.front) {
        drawDebris(d);
      }
    });
    game.stack.forEach((s) => drawBox(s, HOVER * s.land * s.land));
    if (game.cur) {
      drawAimShadow();
    }
    game.rings.forEach(drawRing);
    if (game.cur) {
      drawBox(game.cur, HOVER);
    }
    game.debris.forEach((d) => {
      if (d.front) {
        drawDebris(d);
      }
    });
    ctx.restore();

    drawFx();
    if (Shell.phase === "play" && game.mode === "slide" && game.floors === 0) {
      drawHint();
    }
  };

  const onPointerDown = () => {
    if (game.mode === "slide") {
      drop();
    }
  };

  const onPointerMove = () => {};
  const onPointerUp = () => {};

  const DROP_KEYS = [" ", "Spacebar", "Enter", "ArrowDown", "s", "S"];

  // Return true to swallow the key.
  const onKey = (key, down, event) => {
    if (DROP_KEYS.indexOf(key) === -1) {
      return false;
    }
    if (down && !(event && event.repeat) && game.mode === "slide") {
      drop();
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
