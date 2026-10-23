(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-sling-smash",        // CustomEvent namespace
    api: "mgSlingSmash",                  // window.<api> handle
    campaign: "trekka-t5",
    offer: "−20%",
    winTitle: "Tower down!",
    loseTitle: "So close!",
    goal: 3,                                 // bots to pop
    maxPlayMs: 45000,                        // hard stop: a session never runs past this
    idleStopMs: 30000                        // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#4aa8f0",
    skyBottom: "#d8f0ff",
    sun: "255, 246, 205",
    ridgeFar: "#9cc3e6",
    ridgeNear: "#86b4d6",
    hillBack: "#8cc56d",
    hillFront: "#6fb04f",
    grass: ["#7fd04f", "#56a834", "#3d8a26"],
    dirt: ["#8a5a30", "#5e3a1c"],
    wood: ["#e3a866", "#b5743a", "#6b3f17"],
    stone: ["#c3c8d1", "#8a929f", "#535a66"],
    glassFill: "rgba(196, 236, 255, 0.5)",
    glassEdge: "rgba(236, 251, 255, 0.95)",
    fluff: ["#ffe08a", "#f5a93a", "#c96f14"],
    fluffInk: "#3a1d06",
    bot: ["#c7a4ff", "#7f4ae8", "#3f1d8f"],
    botInk: "#24104f",
    metal: ["#d9dde6", "#7c8494", "#3b404c"],
    lens: ["#e8fdff", "#5ef0ff", "#138aa8"],
    sling: ["#b9773a", "#6e3f15"],
    band: "#5a2e2a",
    shadow: "rgba(30, 50, 20, 0.28)",
    text: "#ffffff",
    points: "#fff3b0",
    pop: "#ffe45c"
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

  // Slingshot vs. tower. The tower is "asleep": resting blocks are static and
  // only wake when something hits them hard enough or their support goes.
  // Woken blocks are small rigid bodies (boxes with spin) that collide with
  // the ground, the tower and each other, then sleep again once still. That
  // keeps an untouched tower perfectly still and the debris believable.

  // World units are the creative's authored pixels (300x250, 200x480,
  // 1456x180). Drawing is scaled by 1/K, so the scene keeps one physical size
  // in every format and the physics below is tuned once, in world units.
  const WW = WIDTH * K;
  const WH = HEIGHT * K;
  const WSAFE = { x: SAFE.x * K, y: SAFE.y * K, w: SAFE.w * K, h: SAFE.h * K };

  const TAU = Math.PI * 2;
  const STEP = 1 / 120;                 // fixed physics step
  const MAX_STEPS = 8;                  // per frame, so a slow frame cannot spiral
  const GRAVITY = 300;
  const MAX_SPIN = 14;
  const SLOP = 0.25;
  const FRICTION = 0.5;

  // Per format: where the ground and slingshot sit, how hard the band throws
  // (the rail lobs up to a ledge, the strip throws long ~35° arcs that stay
  // under its top edge), and where the fort goes. Ball mass drops as launch
  // speed rises so hits land alike. The rail's steep shots are the hardest to
  // judge, so it gets a wider bot hit pad, softer falls and a fourth shot.
  const LAYOUT = {
    popup: { ground: 222, slingX: 50, power: 6.8, mass: 4, maxSpeed: 520, aim: 0.68, preview: 0.55, fortX: 222, hut: true },
    rail: { ground: 455, slingX: 46, power: 9, mass: 3, maxSpeed: 560, aim: 1.15, keyPower: 0.85, preview: 0.55, fortX: 142, ledge: { x: 88, top: 335 }, fallKill: 55, hitPad: 6, shots: 4 },
    strip: { ground: 168, slingX: WSAFE.x + WSAFE.w * 0.16, power: 10.5, mass: 2.8, maxSpeed: 640, aim: 0.6, preview: 0.5, fortX: WSAFE.x + WSAFE.w * 0.16 + 620, hut: true }
  }[FORMAT];

  const GROUND_Y = LAYOUT.ground;
  const BASE_Y = LAYOUT.ledge ? LAYOUT.ledge.top : GROUND_Y;   // where the fort stands
  const MAX_SPEED = LAYOUT.maxSpeed;
  const SLING = {
    x: LAYOUT.slingX, y: GROUND_Y - 52, backX: LAYOUT.slingX - 6, frontX: LAYOUT.slingX + 7, prongY: GROUND_Y - 57,
    maxPull: 46, minPull: 9, power: LAYOUT.power
  };
  const BALL = { r: 8, mass: LAYOUT.mass, restitution: 0.35, maxAge: 7 };
  const FOE = { r: 9, mass: 2.5, hp: 120, fallKill: LAYOUT.fallKill || 90, hitPad: LAYOUT.hitPad || 3, points: 500 };
  const MATERIALS = {
    wood: { density: 1, hp: 1200, pass: 0.45, restitution: 0.15, points: 100 },
    glass: { density: 0.75, hp: 160, pass: 0.82, restitution: 0.1, points: 50 },
    stone: { density: 2.4, hp: 2200, pass: 0.3, restitution: 0.1, points: 150 },
    rock: { density: 1, hp: Infinity, pass: 0, restitution: 0.1, points: 0 }
  };
  const SHOTS = LAYOUT.shots || 3;
  const SETTLE = { min: 0.9, max: 4.2 };   // seconds after a launch before the next load
  const RELOAD_TIME = 0.45;
  const DAMAGE_SPEED = 28;               // slower contacts never hurt anything
  const KNOCK_SPEED = 45;                // impact a resting block needs to come loose
  const KNOCK_DV = 24;                   // ...and the speed it must gain from it
  const WAKE_SPEED = 20;
  // A body sleeps once slow, or once it has barely moved (a body wedged
  // against another can keep a little solver velocity without going anywhere).
  const SLEEP = { motion: 12, drift: 1.2, turn: 0.05, after: 0.3, maxFly: 8 };
  // Generous on purpose: a hard landing near a bot rattles it loose or pops it.
  const SPLASH = { speed: 140, radius: 18, damage: 130 };
  const PREVIEW = { dots: 11, span: LAYOUT.preview };
  const SPARE_SHOT_POINTS = 1000;
  const KEY_AIM = { angle: LAYOUT.aim, power: LAYOUT.keyPower || 0.72, turn: 0.9, charge: 0.7, minAngle: 0.08, maxAngle: 1.4 };
  // Waiting critters: [x, lift] beside the slingshot, the fourth on top.
  const QUEUE = [[SLING.x - 23, 0], [SLING.x - 37, 0], [SLING.x - 30, 11]];
  const HINT_FONT = Math.max(9, 7 * K);   // canvas text never under 7 served px

  // The fort, authored around x = 222 on a base at y = 222:
  // [material, centerX, centerY, width, height]. Every block rests exactly on
  // the one below it, which is how the support check knows what holds what.
  const TOWER = [
    ["wood", 200, 205, 8, 34],
    ["wood", 244, 205, 8, 34],
    ["wood", 222, 184, 60, 8],
    ["glass", 204, 166, 8, 28],
    ["glass", 240, 166, 8, 28],
    ["wood", 222, 148, 56, 8],
    ["stone", 202, 134, 12, 20],
    ["stone", 242, 134, 12, 20],
    ["glass", 222, 121, 54, 6]
  ];
  const HUT = [
    ["wood", 262, 211, 8, 22],
    ["wood", 292, 211, 8, 22],
    ["glass", 277, 197, 38, 6]
  ];
  // Two bots in the tower; the third sits in the hut, or (on the rail, whose
  // ledge has no room for a hut) out on the cliff's lip in front of the tower.
  const shiftX = LAYOUT.fortX - 222;
  const shiftY = BASE_Y - 222;
  const FOE_SPOTS = [[222, 171], [222, 135], LAYOUT.hut ? [277, 213] : [LAYOUT.ledge.x + 11 - shiftX, 213]];
  const LEVEL = (LAYOUT.hut ? TOWER.concat(HUT) : TOWER).map(([mat, x, y, w, h]) => [mat, x + shiftX, y + shiftY, w, h]);
  if (LAYOUT.ledge) {
    // The rail's cliff: an unbreakable, immovable resting block.
    LEVEL.unshift(["rock", (LAYOUT.ledge.x + WW) / 2, (BASE_Y + GROUND_Y) / 2, WW - LAYOUT.ledge.x, GROUND_Y - BASE_Y]);
  }
  const FOE_START = FOE_SPOTS.map(([x, y]) => [x + shiftX, y + shiftY]);

  const GROUND = { kind: "ground", x: WW / 2, y: GROUND_Y + 40, vx: 0, vy: 0, va: 0, a: 0, e: 0.2, state: "rest", dead: false };

  // Effects live in served pixels; the game speaks world units.
  const fxBurst = (x, y, color, count, speed) => burst(x / K, y / K, color, count, speed / Math.sqrt(K));
  const fxText = (x, y, text, color) => floatText(x / K, y / K, text, color);

  // Per-round state; resetGame() restores it.
  const freshState = () => ({
    bodies: [],
    ball: null,
    mode: "aim",          // aim | flight | reload | won | lost
    turnT: 0,
    reloadT: 0,
    shotsLeft: SHOTS,
    foesLeft: 0,
    points: 0,
    acc: 0,
    supportDirty: false,
    drag: null,           // { sx, sy } while a pointer pulls the band
    pullX: 0,
    pullY: 0,
    keyAim: false,
    aimAngle: KEY_AIM.angle,
    aimPower: KEY_AIM.power,
    keys: { left: false, right: false, up: false, down: false },
    bandWobble: 0,
    launched: false       // hides the "drag back" hint after the first shot
  });

  const game = { ...freshState(), blinkT: 2, hopT: 0, clouds: [] };

  // Offscreen layers so the static scenery costs one drawImage per frame.
  // Sized and painted in world units.
  const makeLayer = (w, h, paint) => {
    const layer = document.createElement("canvas");
    layer.width = Math.ceil((w / K) * DPR);
    layer.height = Math.ceil((h / K) * DPR);
    const lctx = layer.getContext("2d");
    lctx.setTransform(DPR / K, 0, 0, DPR / K, 0, 0);
    paint(lctx);
    return layer;
  };

  // Evenly spaced color stops.
  const shade = (gradient, colors) => {
    colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
    return gradient;
  };

  const seeded = (seed) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const skyLayer = makeLayer(WW, WH, (c) => {
    c.fillStyle = shade(c.createLinearGradient(0, 0, 0, GROUND_Y), [PALETTE.skyTop, PALETTE.skyBottom]);
    c.fillRect(0, 0, WW, WH);
    const sx = WW * 0.84;
    const sy = WSAFE.y + (FORMAT === "rail" ? 50 : 22);
    const sun = c.createRadialGradient(sx, sy, 4, sx, sy, 70);
    sun.addColorStop(0, `rgba(${PALETTE.sun}, 0.95)`);
    sun.addColorStop(0.18, `rgba(${PALETTE.sun}, 0.6)`);
    sun.addColorStop(1, `rgba(${PALETTE.sun}, 0)`);
    c.fillStyle = sun;
    c.fillRect(sx - 92, 0, 184, sy + 84);
  });

  const landLayer = makeLayer(WW, WH, (c) => {
    const rnd = seeded(7);
    // A filled skyline closed along the ground line.
    const skyline = (color, points, curve) => {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, GROUND_Y);
      points.forEach(([x, y], index) => {
        const [px, py] = points[Math.max(0, index - 1)];
        if (curve) {
          c.quadraticCurveTo((px + x) / 2, Math.min(py, y) - 10, x, y);
        } else {
          c.lineTo(x, y);
        }
      });
      c.lineTo(WW, GROUND_Y);
      c.fill();
    };
    const peaks = (base, amp, step, shift) => Array.from({ length: Math.ceil(WW / step) + 2 },
      (_, index) => [index * step, base - Math.abs(Math.sin(index * step * 0.021 + shift)) * amp - rnd() * 6]);
    const rolling = (base, amp) => Array.from({ length: Math.ceil(WW / 75) + 1 },
      (_, index) => [index * 75, base - (index % 2 ? amp : amp * 0.4) - rnd() * 6]);
    skyline(PALETTE.ridgeFar, peaks(GROUND_Y - 54, 46, 18, 0.4));
    skyline(PALETTE.ridgeNear, peaks(GROUND_Y - 38, 30, 14, 2.1));
    skyline(PALETTE.hillBack, rolling(GROUND_Y - 24, 14), true);
    skyline(PALETTE.hillFront, rolling(GROUND_Y - 12, 9), true);

    if (LAYOUT.ledge) {
      // Rocky cliff under the rail's ledge (the physics body is a plain box).
      const { x, top } = LAYOUT.ledge;
      c.fillStyle = shade(c.createLinearGradient(x, 0, WW, 0), ["#8d8378", "#6b6158", "#544b44"]);
      c.beginPath();
      c.moveTo(x, GROUND_Y);
      [[x - 4, GROUND_Y - 30], [x + 2, GROUND_Y - 70], [x - 3, top + 60], [x + 2, top + 22], [x, top], [WW, top], [WW, GROUND_Y]]
        .forEach(([px, py]) => c.lineTo(px, py));
      c.fill();
      c.strokeStyle = "rgba(40, 30, 24, 0.35)";
      c.lineWidth = 1.5;
      for (let y = top + 22; y < GROUND_Y - 6; y += 24) {
        c.beginPath();
        c.moveTo(x + 4, y);
        c.quadraticCurveTo((x + WW) / 2, y + 6 - rnd() * 12, WW, y + 4);
        c.stroke();
      }
      c.fillStyle = PALETTE.grass[1];
      c.fillRect(x - 2, top - 1, WW - x + 2, 6);
      c.fillStyle = PALETTE.grass[0];
      c.fillRect(x - 2, top - 2, WW - x + 2, 3);
    }

    // Ground: grass lip over layered dirt.
    c.fillStyle = shade(c.createLinearGradient(0, GROUND_Y, 0, WH), PALETTE.dirt);
    c.fillRect(0, GROUND_Y, WW, WH - GROUND_Y);
    c.fillStyle = "rgba(255, 220, 170, 0.12)";
    for (let index = 0; index < WW / 11; index += 1) {
      c.beginPath();
      c.ellipse(rnd() * WW, GROUND_Y + 8 + rnd() * Math.max(4, WH - GROUND_Y - 12), 1.5 + rnd() * 2.5, 1 + rnd(), 0, 0, TAU);
      c.fill();
    }
    c.fillStyle = shade(c.createLinearGradient(0, GROUND_Y - 3, 0, GROUND_Y + 7), [PALETTE.grass[0], PALETTE.grass[1]]);
    c.fillRect(0, GROUND_Y - 1, WW, 7);
    c.fillStyle = PALETTE.grass[2];
    c.fillRect(0, GROUND_Y + 6, WW, 1.5);
    c.fillStyle = PALETTE.grass[0];
    c.beginPath();
    for (let x = 0; x < WW; x += 3) {
      const h = 2 + rnd() * 4;
      c.moveTo(x, GROUND_Y);
      c.lineTo(x + 1.5, GROUND_Y - h);
      c.lineTo(x + 3, GROUND_Y);
    }
    c.fill();
    ["#fff4a8", "#ffffff", "#ffb3c8"].forEach((color) => {
      c.fillStyle = color;
      for (let index = 0; index < WW / 60; index += 1) {
        c.beginPath();
        c.arc(rnd() * WW, GROUND_Y - 1 - rnd() * 3, 1.1, 0, TAU);
        c.fill();
      }
    });
  });

  const makeCloud = (w, h, alpha, seed) => {
    const rnd = seeded(seed);
    return makeLayer(w, h, (c) => {
      c.globalAlpha = alpha;
      const puffs = [];
      for (let index = 0; index < 5; index += 1) {
        const r = h * (0.26 + rnd() * 0.16);
        puffs.push([r + (w - 2 * r) * (index / 4), h - r - 2 - rnd() * h * 0.22, r]);
      }
      c.fillStyle = "#dbe9f6";
      puffs.forEach(([x, y, r]) => {
        c.beginPath();
        c.arc(x, y + 1.5, r, 0, TAU);
        c.fill();
      });
      c.fillStyle = "#ffffff";
      puffs.forEach(([x, y, r]) => {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
      });
    });
  };

  // Far clouds (small, slow) and near ones (bigger, faster) for parallax.
  const CLOUD_KINDS = [[54, 20, 0.6, 3], [70, 26, 0.92, 7]];
  const cloudBand = FORMAT === "rail" ? [WSAFE.y + 20, 150] : FORMAT === "strip" ? [-4, 38] : [WSAFE.y + 6, 52];
  game.clouds = Array.from({ length: FORMAT === "strip" ? 9 : 4 }, (_, index) => {
    const [w, h, alpha, speed] = CLOUD_KINDS[index % 2];
    const scale = FORMAT === "strip" ? 0.8 : 1;
    return {
      x: ((index + 0.3) * WW) / (FORMAT === "strip" ? 9 : 4) + (index % 3) * 14,
      y: cloudBand[0] + (((index * 37) % 10) / 10) * cloudBand[1],
      w: w * scale - (index % 3) * 4,
      h: h * scale - (index % 3) * 1.5,
      speed,
      sprite: makeCloud(w * scale, h * scale, alpha, 3 + index * 8)
    };
  });

  /* ---- bodies */

  const makeBlock = ([mat, x, y, w, h]) => {
    const spec = MATERIALS[mat];
    const m = (w * h * spec.density) / 80;
    return {
      kind: "block", mat, x, y, w, h, hw: w / 2, hh: h / 2, a: 0,
      vx: 0, vy: 0, va: 0,
      m, invM: mat === "rock" ? 0 : 1 / m, invI: mat === "rock" ? 0 : 12 / (m * (w * w + h * h)),
      e: spec.restitution, hp: spec.hp, maxHp: spec.hp,
      state: "rest", restT: 0, flyT: 0, touching: false, flash: 0, dead: false,
      crack: [rand(-0.5, 0.5), rand(-0.6, 0.6), rand(-0.3, 0.3), rand(-0.6, 0.6), rand(-0.5, 0.5)],
      specks: [[rand(-0.6, 0.6), rand(-0.6, 0.6)], [rand(-0.6, 0.6), rand(-0.6, 0.6)], [rand(-0.6, 0.6), rand(-0.6, 0.6)]]
    };
  };

  const makeFoe = ([x, y]) => ({
    kind: "foe", x, y, r: FOE.r, a: 0,
    vx: 0, vy: 0, va: 0,
    m: FOE.mass, invM: 1 / FOE.mass, invI: 0,
    e: 0.3, hp: FOE.hp, maxHp: FOE.hp,
    state: "rest", restT: 0, flyT: 0, touching: false, flash: 0, dead: false,
    blinkT: rand(0.5, 3), phase: rand(0, TAU)
  });

  const makeBall = (x, y, vx, vy) => ({
    kind: "ball", x, y, r: BALL.r, a: 0,
    vx, vy, va: 0,
    m: BALL.mass, invM: 1 / BALL.mass, invI: 0,
    e: BALL.restitution,
    state: "fly", restT: 0, flyT: 0, touching: false, flash: 0, dead: false,
    age: 0, spin: 0, squash: 0, squashV: 0, squashA: 0
  });

  const invMass = (b) => (b.state === "fly" ? b.invM : 0);
  const invInertia = (b) => (b.state === "fly" ? b.invI : 0);

  const loosen = (b) => {
    if (b.state === "fly" || b.dead) {
      return;
    }
    b.state = "fly";
    b.restT = 0;
    b.flyT = 0;
    if (b.kind === "block") {
      game.supportDirty = true;
    }
  };

  const wake = (b) => {
    if (b.state === "sleep") {
      b.state = "fly";
      b.restT = 0;
      b.flyT = 0;
    }
  };

  const sleep = (b) => {
    b.state = "sleep";
    b.vx = 0;
    b.vy = 0;
    b.va = 0;
  };

  const addPoints = (value, x, y, color = PALETTE.points) => {
    if (Shell.phase !== "play") {
      return;
    }
    game.points += value;
    fxText(x, y, `+${value}`, color);
  };

  const destroy = (b) => {
    if (b.dead) {
      return;
    }
    b.dead = true;
    if (b.kind === "foe") {
      fxBurst(b.x, b.y, PALETTE.bot[1], 16, 120);
      fxBurst(b.x, b.y, PALETTE.pop, 10, 80);
      fxBurst(b.x, b.y, "#ffffff", 6, 60);
      if (Shell.phase === "play") {
        game.foesLeft -= 1;
        setScore(Shell.score + 1);
        addPoints(FOE.points, b.x, b.y - 14, PALETTE.pop);
        shake();
      }
      return;
    }
    game.supportDirty = true;
    const colors = b.mat === "glass" ? ["#e6fbff", "#9fdcf5"] : b.mat === "stone" ? PALETTE.stone : PALETTE.wood;
    fxBurst(b.x, b.y, colors[0], b.mat === "glass" ? 12 : 8, b.mat === "glass" ? 110 : 80);
    fxBurst(b.x, b.y, colors[1], 6, 70);
    addPoints(MATERIALS[b.mat].points, b.x, b.y);
  };

  // Damage from an impulse; returns true when it broke.
  const hurt = (b, j) => {
    if (b.kind !== "block" && b.kind !== "foe") {
      return false;
    }
    if (j >= b.hp) {
      destroy(b);
      return true;
    }
    if (j > b.maxHp * 0.12) {
      b.hp -= j * 0.6;
      b.flash = 0.5;
    }
    return false;
  };

  const splash = (x, y) => {
    game.bodies.forEach((f) => {
      if (f.kind !== "foe" || f.dead) {
        return;
      }
      const gap = Math.max(0, Math.hypot(f.x - x, f.y - y) - f.r);
      if (gap >= SPLASH.radius) {
        return;
      }
      const damage = SPLASH.damage * (1 - gap / SPLASH.radius);
      if (damage >= f.hp) {
        destroy(f);
      } else {
        f.hp -= damage;
        f.flash = 0.6;
        if (f.state !== "fly") {
          loosen(f);
          f.vy = -70;
          f.vx = (f.x - x) * 2;
        }
      }
    });
  };

  const applyImpulse = (b, jx, jy, rx, ry) => {
    if (b.state !== "fly") {
      return;
    }
    b.vx += jx * b.invM;
    b.vy += jy * b.invM;
    b.va += (rx * jy - ry * jx) * b.invI;
  };

  // One contact between a (always awake) and b. The normal points from b
  // toward a; (px, py) is the contact point; share splits the push-out when a
  // pair has several contact points.
  const contact = (a, b, px, py, nx, ny, depth, share) => {
    if (a.dead || b.dead) {
      return;
    }
    a.touching = true;
    b.touching = true;
    const rax = px - a.x;
    const ray = py - a.y;
    const rbx = px - b.x;
    const rby = py - b.y;
    const rvx = a.vx - a.va * ray - (b.vx - b.va * rby);
    const rvy = a.vy + a.va * rax - (b.vy + b.va * rbx);
    const impact = -(rvx * nx + rvy * ny);
    const ran = rax * ny - ray * nx;
    const rbn = rbx * ny - rby * nx;
    const e = impact > 50 ? Math.max(a.e, b.e) : 0;

    if (impact > WAKE_SPEED && b.state === "sleep") {
      wake(b);
    }
    if (impact > DAMAGE_SPEED && b.state !== "fly" && b.kind !== "ground") {
      const kStatic = invMass(a) + ran * ran * invInertia(a);
      const jStatic = kStatic > 0 ? ((1 + e) * impact) / kStatic : 0;
      if (jStatic >= b.hp) {
        // Smashed straight through: the mover keeps part of its speed.
        const keep = Math.max(b.kind === "foe" ? 0.85 : MATERIALS[b.mat].pass, 1 - b.hp / jStatic);
        destroy(b);
        a.vx *= keep;
        a.vy *= keep;
        a.va *= keep;
        if (a.kind === "ball") {
          splash(px, py);
        }
        return;
      }
      if (b.state === "rest" && impact > KNOCK_SPEED && jStatic * b.invM > KNOCK_DV) {
        loosen(b);
      }
    }

    const ima = invMass(a);
    const imb = invMass(b);
    const iia = invInertia(a);
    const iib = invInertia(b);
    const k = ima + imb + ran * ran * iia + rbn * rbn * iib;
    if (k <= 0) {
      return;
    }
    const corr = (Math.max(depth - SLOP, 0) * 0.6 * share) / (ima + imb);
    a.x += nx * corr * ima;
    a.y += ny * corr * ima;
    b.x -= nx * corr * imb;
    b.y -= ny * corr * imb;
    if (impact <= 0) {
      return;
    }

    const j = ((1 + e) * impact) / k;
    if (impact > DAMAGE_SPEED) {
      const brokeA = hurt(a, j);
      const brokeB = hurt(b, j);
      if (brokeA || brokeB) {
        return;
      }
    }
    applyImpulse(a, j * nx, j * ny, rax, ray);
    applyImpulse(b, -j * nx, -j * ny, rbx, rby);

    const tx = -ny;
    const ty = nx;
    const vt = rvx * tx + rvy * ty;
    const rat = rax * ty - ray * tx;
    const rbt = rbx * ty - rby * tx;
    const kt = ima + imb + rat * rat * iia + rbt * rbt * iib;
    if (kt > 0) {
      const jt = clamp(-vt / kt, -FRICTION * j, FRICTION * j);
      applyImpulse(a, jt * tx, jt * ty, rax, ray);
      applyImpulse(b, -jt * tx, -jt * ty, rbx, rby);
    }

    if (a.kind === "ball" && impact > 60) {
      a.squash = Math.min(0.85, impact / 260);
      a.squashV = 0;
      a.squashA = Math.atan2(ny, nx);
      if (impact > SPLASH.speed) {
        splash(px, py);
      }
    }
  };

  const corners = (b) => {
    const c = Math.cos(b.a);
    const s = Math.sin(b.a);
    const ax = c * b.hw;
    const ay = s * b.hw;
    const bx = -s * b.hh;
    const by = c * b.hh;
    return [
      [b.x - ax - bx, b.y - ay - by],
      [b.x + ax - bx, b.y + ay - by],
      [b.x + ax + bx, b.y + ay + by],
      [b.x - ax + bx, b.y - ay + by]
    ];
  };

  // Is (px, py) inside box? Returns the box's outward face normal and depth.
  const pointInBox = (px, py, box) => {
    const c = Math.cos(box.a);
    const s = Math.sin(box.a);
    const dx = px - box.x;
    const dy = py - box.y;
    const lx = dx * c + dy * s;
    const ly = -dx * s + dy * c;
    const ox = box.hw - Math.abs(lx);
    const oy = box.hh - Math.abs(ly);
    if (ox <= 0 || oy <= 0) {
      return null;
    }
    if (ox < oy) {
      const side = lx < 0 ? -1 : 1;
      return { nx: side * c, ny: side * s, depth: ox };
    }
    const side = ly < 0 ? -1 : 1;
    return { nx: -side * s, ny: side * c, depth: oy };
  };

  const reach = (b) => Math.hypot(b.hw, b.hh);

  // The critter-vs-bot hit circle is padded a little: near misses still count.
  const circleRadius = (c, other) => (c.kind === "ball" && other.kind === "foe") || (c.kind === "foe" && other.kind === "ball")
    ? c.r + FOE.hitPad
    : c.r;

  // Circle c against box: contact normal points from the box toward c.
  const circleBox = (c, box, flip) => {
    const cs = Math.cos(box.a);
    const sn = Math.sin(box.a);
    const dx = c.x - box.x;
    const dy = c.y - box.y;
    const lx = dx * cs + dy * sn;
    const ly = -dx * sn + dy * cs;
    const qx = clamp(lx, -box.hw, box.hw);
    const qy = clamp(ly, -box.hh, box.hh);
    let nlx;
    let nly;
    let depth;
    if (qx === lx && qy === ly) {
      const ox = box.hw - Math.abs(lx);
      const oy = box.hh - Math.abs(ly);
      if (ox < oy) {
        nlx = lx < 0 ? -1 : 1;
        nly = 0;
        depth = ox + c.r;
      } else {
        nlx = 0;
        nly = ly < 0 ? -1 : 1;
        depth = oy + c.r;
      }
    } else {
      const ex = lx - qx;
      const ey = ly - qy;
      const d = Math.hypot(ex, ey);
      if (d >= c.r || d === 0) {
        return;
      }
      nlx = ex / d;
      nly = ey / d;
      depth = c.r - d;
    }
    const nx = nlx * cs - nly * sn;
    const ny = nlx * sn + nly * cs;
    const px = box.x + qx * cs - qy * sn;
    const py = box.y + qx * sn + qy * cs;
    if (flip) {
      contact(box, c, px, py, -nx, -ny, depth, 1);
    } else {
      contact(c, box, px, py, nx, ny, depth, 1);
    }
  };

  const boxBox = (a, b) => {
    const hits = [];
    corners(a).forEach(([px, py]) => {
      const hit = pointInBox(px, py, b);
      if (hit) {
        hits.push([px, py, hit.nx, hit.ny, hit.depth]);
      }
    });
    corners(b).forEach(([px, py]) => {
      const hit = pointInBox(px, py, a);
      if (hit) {
        hits.push([px, py, -hit.nx, -hit.ny, hit.depth]);
      }
    });
    hits.forEach(([px, py, nx, ny, depth]) => contact(a, b, px, py, nx, ny, depth, 1 / hits.length));
  };

  const collidePair = (a, b) => {
    const ra = a.kind === "block" ? reach(a) : circleRadius(a, b);
    const rb = b.kind === "block" ? reach(b) : circleRadius(b, a);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    if (dx * dx + dy * dy > (ra + rb) * (ra + rb)) {
      return;
    }
    if (a.kind === "block" && b.kind === "block") {
      boxBox(a, b);
    } else if (a.kind === "block") {
      circleBox(b, a, true);
    } else if (b.kind === "block") {
      circleBox(a, b, false);
    } else {
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      contact(a, b, b.x + (dx / d) * rb, b.y + (dy / d) * rb, dx / d, dy / d, ra + rb - d, 1);
    }
  };

  const collideGround = (b) => {
    if (b.kind === "block") {
      const low = corners(b).filter(([, py]) => py > GROUND_Y);
      low.forEach(([px, py]) => contact(b, GROUND, px, py, 0, -1, py - GROUND_Y, 1 / low.length));
      return;
    }
    const depth = b.y + b.r - GROUND_Y;
    if (depth <= 0) {
      return;
    }
    if (b.kind === "foe" && b.vy > FOE.fallKill) {
      destroy(b);
      return;
    }
    contact(b, GROUND, b.x, GROUND_Y, 0, -1, depth, 1);
  };

  const stepBodies = (h) => {
    const list = game.bodies;
    list.forEach((b) => {
      if (b.state !== "fly" || b.dead) {
        return;
      }
      b.vy += GRAVITY * h;
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > MAX_SPEED) {
        b.vx *= MAX_SPEED / speed;
        b.vy *= MAX_SPEED / speed;
      }
      b.va = clamp(b.va * 0.998, -MAX_SPIN, MAX_SPIN);
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.a += b.va * h;
      if (b.kind !== "block") {
        b.a += b.vx * h * (b.kind === "ball" ? 0.12 : 0.05);
      }
      b.touching = false;
    });

    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      if (a.state !== "fly" || a.dead) {
        continue;
      }
      collideGround(a);
      for (let j = 0; j < list.length && !a.dead; j += 1) {
        const b = list[j];
        if (j === i || b.dead || (b.state === "fly" && j < i)) {
          continue;
        }
        collidePair(a, b);
      }
    }

    list.forEach((b) => {
      if (b.dead) {
        return;
      }
      if (b.kind === "ball") {
        b.age += h;
        b.squashV += (-b.squash * 320 - b.squashV * 16) * h;
        b.squash += b.squashV * h;
        if (b.age > BALL.maxAge) {
          poofBall();
          return;
        }
      }
      if (b.state !== "fly") {
        return;
      }
      if (b.x < -60 || b.x > WW + 60 || b.y > WH + 80) {
        if (b.kind === "foe") {
          destroy(b);
        }
        b.dead = true;
        return;
      }
      const motion = Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.va) * (b.kind === "block" ? Math.max(b.hw, b.hh) : b.r);
      if (!b.touching) {
        b.restT = 0;
      } else if (b.restT === 0) {
        b.restX = b.x;
        b.restY = b.y;
        b.restA = b.a;
        b.restT = h;
      } else {
        const drifted = Math.abs(b.x - b.restX) + Math.abs(b.y - b.restY) >= SLEEP.drift
          || Math.abs(b.a - b.restA) >= SLEEP.turn;
        if (motion >= SLEEP.motion && drifted) {
          b.restT = 0;
        } else {
          b.restT += h;
          if (b.restT > SLEEP.after) {
            sleep(b);
          }
        }
      }
      b.flyT += h;
      if (b.flyT > SLEEP.maxFly) {
        sleep(b);
      }
    });

    if (game.supportDirty) {
      recheckSupport();
    }
  };

  // Union of resting tops directly under [left, right] at height bottom.
  const supportSpan = (self, bottom, left, right) => {
    if (bottom >= GROUND_Y - 1.5) {
      return { lo: -Infinity, hi: Infinity };
    }
    let lo = Infinity;
    let hi = -Infinity;
    game.bodies.forEach((s) => {
      if (s === self || s.kind !== "block" || s.state !== "rest" || s.dead) {
        return;
      }
      if (Math.abs(s.y - s.hh - bottom) > 1.5) {
        return;
      }
      const l = Math.max(left, s.x - s.hw);
      const r = Math.min(right, s.x + s.hw);
      if (r - l > 0.5) {
        lo = Math.min(lo, l);
        hi = Math.max(hi, r);
      }
    });
    return lo <= hi ? { lo, hi } : null;
  };

  const recheckSupport = () => {
    let changed = true;
    let guard = 0;
    while (changed && guard < 12) {
      changed = false;
      guard += 1;
      game.bodies.forEach((b) => {
        if (b.dead || b.state !== "rest") {
          return;
        }
        if (b.kind === "block") {
          const span = supportSpan(b, b.y + b.hh, b.x - b.hw, b.x + b.hw);
          if (!span || b.x < span.lo - 0.5 || b.x > span.hi + 0.5) {
            // Off balance: tip toward the unsupported side.
            const dir = !span ? 0 : b.x < span.lo ? -1 : 1;
            loosen(b);
            b.va += dir * 1.4;
            b.vx += dir * 6;
            changed = true;
          }
        } else if (b.kind === "foe" && !supportSpan(b, b.y + b.r, b.x - b.r * 0.5, b.x + b.r * 0.5)) {
          loosen(b);
          changed = true;
        }
      });
    }
    game.bodies.forEach(wake);
    game.supportDirty = false;
  };

  const poofBall = () => {
    const ball = game.ball;
    if (!ball || ball.dead) {
      return;
    }
    ball.dead = true;
    fxBurst(ball.x, ball.y, PALETTE.fluff[0], 8, 60);
    fxBurst(ball.x, ball.y, "#ffffff", 4, 40);
  };

  const levelFoes = () => game.bodies.filter((b) => b.kind === "foe" && !b.dead).length;

  const resetGame = () => {
    Object.assign(game, freshState());
    game.bodies = LEVEL.map(makeBlock).concat(FOE_START.map(makeFoe));
    game.foesLeft = levelFoes();
  };

  const clampPull = (x, y) => {
    let px = Math.min(x, 6);
    let py = y;
    const len = Math.hypot(px, py);
    if (len > SLING.maxPull) {
      px *= SLING.maxPull / len;
      py *= SLING.maxPull / len;
    }
    return { x: px, y: Math.min(py, GROUND_Y - BALL.r - 1 - SLING.y) };
  };

  const keyPull = () => {
    const len = game.aimPower * SLING.maxPull;
    return clampPull(-Math.cos(game.aimAngle) * len, Math.sin(game.aimAngle) * len);
  };

  // Where the loaded critter sits relative to the band's rest point.
  const currentPull = () => {
    if (Shell.phase === "intro") {
      const t = 0.5 - 0.5 * Math.cos(performance.now() / 1000 * 1.7);
      const len = (0.3 + 0.5 * t) * SLING.maxPull;
      return { x: -Math.cos(KEY_AIM.angle) * len, y: Math.sin(KEY_AIM.angle) * len };
    }
    if (game.drag) {
      return { x: game.pullX, y: game.pullY };
    }
    if (game.keyAim && game.mode === "aim") {
      return keyPull();
    }
    return { x: 0, y: 0 };
  };

  const launch = (pull) => {
    if (Math.hypot(pull.x, pull.y) < SLING.minPull) {
      game.bandWobble = 0.4;
      return;
    }
    poofBall();
    game.mode = "flight";
    game.turnT = 0;
    game.launched = true;
    game.shotsLeft -= 1;
    const ball = makeBall(SLING.x + pull.x, SLING.y + pull.y, -pull.x * SLING.power, -pull.y * SLING.power);
    game.ball = ball;
    game.bodies.push(ball);
    game.bandWobble = 1;
    fxBurst(ball.x, ball.y, PALETTE.fluff[0], 5, 50);
  };

  const startReload = () => {
    poofBall();
    game.mode = "reload";
    game.reloadT = 0;
  };

  const stepWorld = (dt) => {
    game.acc = Math.min(game.acc + dt, STEP * MAX_STEPS);
    while (game.acc >= STEP) {
      stepBodies(STEP);
      game.acc -= STEP;
    }
    if (game.bodies.some((b) => b.dead)) {
      game.bodies = game.bodies.filter((b) => !b.dead);
    }
    if (game.ball && game.ball.dead) {
      game.ball = null;
    }
  };

  // Cheap animation shared by every phase (attract mode included).
  const animate = (dt) => {
    const drift = reduceMotion ? 0.3 : 1;
    game.clouds.forEach((cloud) => {
      cloud.x += cloud.speed * drift * dt;
      if (cloud.x > WW + 8) {
        cloud.x = -cloud.w - 8;
      }
    });
    game.bandWobble = Math.max(0, game.bandWobble - dt * 2.4);
    game.blinkT -= dt;
    if (game.blinkT < -0.14) {
      game.blinkT = rand(1.8, 3.6);
    }
    game.hopT += dt;
    game.bodies.forEach((b) => {
      b.flash = Math.max(0, b.flash - dt * 2.5);
      if (b.kind === "foe") {
        b.blinkT -= dt;
        if (b.blinkT < -0.16) {
          b.blinkT = rand(1.4, 3.4);
        }
      }
    });
  };

  const stepTurn = (dt) => {
    if (game.foesLeft <= 0 && game.mode !== "won") {
      game.mode = "won";
      game.turnT = 0;
      game.drag = null;
      for (let index = 0; index < game.shotsLeft; index += 1) {
        addPoints(SPARE_SHOT_POINTS, SLING.x + 6, SLING.y - 22 - index * 14, PALETTE.pop);
      }
    }
    game.turnT += dt;
    if (game.mode === "aim" && game.keyAim) {
      const keys = game.keys;
      game.aimAngle = clamp(game.aimAngle + ((keys.up ? 1 : 0) - (keys.down ? 1 : 0)) * KEY_AIM.turn * dt, KEY_AIM.minAngle, KEY_AIM.maxAngle);
      game.aimPower = clamp(game.aimPower + ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * KEY_AIM.charge * dt, 0.25, 1);
    } else if (game.mode === "flight") {
      const moving = game.bodies.some((b) => b.state === "fly");
      if ((game.turnT > SETTLE.min && !moving) || game.turnT > SETTLE.max) {
        if (game.shotsLeft > 0) {
          startReload();
        } else {
          game.mode = "lost";
          game.turnT = 0;
        }
      }
    } else if (game.mode === "reload") {
      game.reloadT += dt;
      if (game.reloadT >= RELOAD_TIME) {
        game.mode = "aim";
      }
    } else if (game.mode === "won" && game.turnT > 1.1) {
      endGame(true);
    } else if (game.mode === "lost" && game.turnT > 0.8) {
      endGame(false);
    }
  };

  const endSummary = () => `${Shell.score}/${CONFIG.goal} bots · ${game.points} pts`;

  // Runs only in the play phase.
  const update = (dt) => {
    animate(dt);
    stepWorld(dt);
    stepTurn(dt);
  };

  // Attract motion behind the intro and end panels.
  const idle = (dt) => {
    animate(dt);
    if (Shell.phase === "end") {
      stepWorld(dt);
    }
  };

  /* ---- drawing */

  const dot = (x, y, r, color) => {
    if (color) {
      ctx.fillStyle = color;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };

  const strokePath = (points, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };

  const drawCloudLayer = (layer) => {
    game.clouds.forEach((cloud, index) => {
      if ((index < 2) === (layer === 0)) {
        ctx.drawImage(cloud.sprite, cloud.x, cloud.y, cloud.w, cloud.h);
      }
    });
  };

  const drawShadows = () => {
    ctx.fillStyle = PALETTE.shadow;
    game.bodies.forEach((b) => {
      if (b.mat === "rock") {
        return;
      }
      const bottom = b.kind === "block" ? b.y + Math.max(b.hw, b.hh) : b.y + b.r;
      const floor = LAYOUT.ledge && b.x > LAYOUT.ledge.x && bottom <= BASE_Y + 4 ? BASE_Y : GROUND_Y;
      const lift = floor - bottom;
      if (lift > 40) {
        return;
      }
      const width = (b.kind === "block" ? Math.max(b.hw, b.hh * 0.6) : b.r) * (1 - Math.max(0, lift) / 60);
      if (width <= 0.5) {
        return;
      }
      ctx.beginPath();
      ctx.ellipse(b.x, floor + 1, width, 2.2, 0, 0, TAU);
      ctx.fill();
    });
  };

  const drawBlock = (b) => {
    if (b.mat === "rock") {
      return;
    }
    // Drawn lying along the long axis; upright blocks are turned a quarter.
    const upright = b.h > b.w;
    const w = upright ? b.h : b.w;
    const h = upright ? b.w : b.h;
    const x = -w / 2;
    const y = -h / 2;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a - (upright ? Math.PI / 2 : 0));
    if (b.mat === "glass") {
      ctx.fillStyle = PALETTE.glassFill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = PALETTE.glassEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      strokePath([[x + w * 0.14, -y - 1.5], [x + w * 0.22, y + 1.5]], "rgba(255, 255, 255, 0.85)", 1);
      strokePath([[x + w * 0.27, -y - 1.5], [x + w * 0.31, y + 1.5]], "rgba(255, 255, 255, 0.85)", 1);
    } else {
      const tone = PALETTE[b.mat];
      const fill = shade(ctx.createLinearGradient(x, y, x + w * 0.3, -y), [tone[0], tone[1]]);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      if (b.mat === "wood") {
        strokePath([[x + 3, y + h * 0.38], [x + w * 0.55, y + h * 0.38]], "rgba(92, 52, 18, 0.4)", 0.8);
        strokePath([[x + w * 0.4, y + h * 0.7], [-x - 3, y + h * 0.7]], "rgba(92, 52, 18, 0.4)", 0.8);
      } else {
        ctx.fillStyle = "rgba(60, 66, 78, 0.45)";
        b.specks.forEach(([sx, sy]) => dot(sx * -x, sy * -y, 1));
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(x, y, w, 1.4);
      ctx.strokeStyle = tone[2];
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    if (b.hp < b.maxHp * 0.75) {
      const [c0, c1, c2, c3, c4] = b.crack;
      const ink = b.mat === "glass" ? "rgba(255, 255, 255, 0.9)" : "rgba(40, 22, 8, 0.65)";
      strokePath([[c0 * -x, y], [c1 * -x, c2 * -y], [c3 * -x, c4 * -y - y * 0.4]], ink, 0.8);
    }
    if (b.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${b.flash * 0.7})`;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  };

  // The critter: a grumpy fluffball of an original design.
  const drawFluff = (x, y, r, look, opts = {}) => {
    const sq = opts.squash || 0;
    ctx.save();
    ctx.translate(x, y);
    if (sq) {
      ctx.rotate(opts.squashA || 0);
      ctx.scale(1 - 0.32 * sq, 1 + 0.24 * sq);
      ctx.rotate(-(opts.squashA || 0));
    }
    ctx.rotate(opts.spin || 0);
    const body = shade(ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.25), PALETTE.fluff);
    ctx.fillStyle = body;
    ctx.beginPath();
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * TAU;
      const rr = index % 2 ? r : r * 1.2;
      ctx.lineTo(Math.cos(angle) * rr, Math.sin(angle) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-(opts.spin || 0));

    ctx.fillStyle = "rgba(255, 244, 214, 0.6)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 0.55, r * 0.36, 0, 0, TAU);
    ctx.fill();

    const ex = r * 0.38;
    const ey = -r * 0.12;
    const er = r * 0.3;
    const lx = look ? look.x * er * 0.42 : 0;
    const ly = look ? look.y * er * 0.42 : 0;
    [-1, 1].forEach((side) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      if (opts.blink) {
        ctx.ellipse(side * ex, ey, er, Math.max(0.3, er * 0.18), 0, 0, TAU);
      } else {
        ctx.arc(side * ex, ey, er, 0, TAU);
      }
      ctx.fill();
      if (!opts.blink) {
        dot(side * ex + lx, ey + ly, er * 0.52, PALETTE.fluffInk);
      }
    });
    const effort = opts.effort || 0;
    ctx.strokeStyle = PALETTE.fluffInk;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(0.6, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(-ex - er * 1.05, ey - er * 1.3);
    ctx.lineTo(-ex + er * 0.7, ey - er * (0.62 - effort * 0.3));
    ctx.moveTo(ex + er * 1.05, ey - er * 1.3);
    ctx.lineTo(ex - er * 0.7, ey - er * (0.62 - effort * 0.3));
    ctx.stroke();
    ctx.lineWidth = Math.max(0.5, r * 0.12);
    ctx.beginPath();
    ctx.arc(0, r * 0.66, r * 0.22, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();
  };

  // The bots: purple jelly domes with one big goggle, also original.
  const drawFoe = (f, time) => {
    const r = f.r;
    const wob = reduceMotion ? 0 : Math.sin(time * 4 + f.phase) * 0.05;
    const blink = f.blinkT < 0 ? 1 - Math.abs(f.blinkT + 0.08) / 0.08 : 0;
    const ball = game.ball;
    let lookX = -0.8;
    let lookY = 0.2;
    if (ball && !ball.dead) {
      const d = Math.hypot(ball.x - f.x, ball.y - f.y) || 1;
      lookX = (ball.x - f.x) / d;
      lookY = (ball.y - f.y) / d;
    }
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.a);
    ctx.scale(1 + wob, 1 - wob);

    ctx.fillStyle = PALETTE.metal[1];
    ctx.beginPath();
    ctx.ellipse(-r * 0.45, r * 0.92, r * 0.3, r * 0.16, 0, 0, TAU);
    ctx.ellipse(r * 0.45, r * 0.92, r * 0.3, r * 0.16, 0, 0, TAU);
    ctx.fill();

    strokePath([[0, -r * 0.92], [r * 0.28, -r * 1.48]], PALETTE.metal[2], 1);
    dot(r * 0.28, -r * 1.52, r * 0.18, Math.sin(time * 5 + f.phase) > 0 ? "#fff27a" : "#ff9a3a");

    const body = shade(ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.12, 0, 0, r * 1.1), PALETTE.bot);
    dot(0, 0, r, body);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = PALETTE.metal[2];
    ctx.fillRect(-r, -r * 0.34, r * 2, r * 0.26);
    ctx.fillStyle = PALETTE.metal[1];
    ctx.fillRect(-r, r * 0.6, r * 2, r * 0.24);
    ctx.restore();

    const ly = -r * 0.21;
    dot(0, ly, r * 0.5, PALETTE.metal[0]);
    const lens = shade(ctx.createRadialGradient(-r * 0.12, ly - r * 0.14, r * 0.04, 0, ly, r * 0.4), PALETTE.lens);
    dot(0, ly, r * 0.4, lens);
    dot(lookX * r * 0.15, ly + lookY * r * 0.15, r * 0.17, PALETTE.botInk);
    dot(-r * 0.15, ly - r * 0.15, r * 0.08, "rgba(255, 255, 255, 0.9)");
    if (blink > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, ly, r * 0.41, 0, TAU);
      ctx.clip();
      ctx.fillStyle = PALETTE.bot[1];
      ctx.fillRect(-r * 0.5, ly - r * 0.45, r, r * 0.9 * blink);
      ctx.restore();
    }

    ctx.fillStyle = PALETTE.botInk;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.3, r * 0.3, r * 0.14, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-r * 0.18, r * 0.3, r * 0.13, r * 0.08);
    ctx.fillRect(r * 0.05, r * 0.3, r * 0.13, r * 0.08);

    if (f.flash > 0) {
      dot(0, 0, r, `rgba(255, 255, 255, ${f.flash * 0.8})`);
    }
    ctx.restore();
  };

  // Both bands run behind the critter so its face stays readable; the front
  // arm of the fork is drawn after it so it still sits inside the fork.
  const drawSlingBack = (pouchX, pouchY, grip, bandWidth) => {
    ctx.lineCap = "round";
    const fork = [[SLING.x, GROUND_Y + 2], [SLING.x, GROUND_Y - 32], [SLING.backX, SLING.prongY]];
    strokePath(fork, PALETTE.sling[1], 6.5);
    strokePath(fork.map(([x, y]) => [x - 0.6, y]), PALETTE.sling[0], 4);
    ctx.fillStyle = PALETTE.band;
    ctx.fillRect(SLING.backX - 3, SLING.prongY - 1, 5, 4);
    strokePath([[SLING.backX, SLING.prongY + 1], [pouchX - grip, pouchY], [SLING.frontX, SLING.prongY + 1]], PALETTE.band, bandWidth);
    ctx.fillStyle = "#3b1b17";
    ctx.beginPath();
    ctx.ellipse(pouchX - grip, pouchY, 2.6, grip ? 6 : 3, 0, 0, TAU);
    ctx.fill();
  };

  const drawSlingFront = () => {
    strokePath([[SLING.x + 2, GROUND_Y - 30], [SLING.frontX, SLING.prongY]], PALETTE.sling[1], 6.5);
    strokePath([[SLING.x + 2, GROUND_Y - 30], [SLING.frontX - 0.6, SLING.prongY]], PALETTE.sling[0], 4);
    ctx.fillStyle = PALETTE.band;
    ctx.fillRect(SLING.frontX - 2.5, SLING.prongY - 1, 5, 4);
  };

  const drawPreview = (pull) => {
    const x0 = SLING.x + pull.x;
    const y0 = SLING.y + pull.y;
    const vx = -pull.x * SLING.power;
    const vy = -pull.y * SLING.power;
    for (let index = 1; index <= PREVIEW.dots; index += 1) {
      const t = (index / PREVIEW.dots) * PREVIEW.span;
      const x = x0 + vx * t;
      const y = y0 + vy * t + 0.5 * GRAVITY * t * t;
      const fade = 1 - index / (PREVIEW.dots + 1);
      ctx.globalAlpha = 0.25 + fade * 0.7;
      dot(x + 0.6, y + 0.6, 1 + fade * 1.3, "rgba(40, 30, 10, 0.5)");
      dot(x, y, 1 + fade * 1.3, "#ffffff");
    }
    ctx.globalAlpha = 1;
  };

  const drawHint = (time) => {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 5);
    ctx.lineCap = "round";
    strokePath([[SLING.x - 12, SLING.y + 6], [SLING.x - 29, SLING.y + 19]], "#ffffff", 2);
    strokePath([[SLING.x - 29, SLING.y + 13], [SLING.x - 30, SLING.y + 20], [SLING.x - 23, SLING.y + 21]], "#ffffff", 2);
    ctx.globalAlpha = 1;
    // The strip is too short for a label above the sling: put it beside.
    const side = FORMAT === "strip";
    const tx = side ? SLING.x + 22 : SLING.x;
    const ty = side ? SLING.y - 30 : SLING.y - 14 - HINT_FONT;
    ctx.font = `900 ${HINT_FONT}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = side ? "left" : "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(20, 40, 20, 0.55)";
    ctx.fillText("DRAG BACK", tx + 1, ty + 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("DRAG BACK", tx, ty);
  };

  const draw = (time) => {
    ctx.save();
    ctx.scale(1 / K, 1 / K);
    ctx.drawImage(skyLayer, 0, 0, WW, WH);
    drawCloudLayer(0);
    drawCloudLayer(1);
    ctx.drawImage(landLayer, 0, 0, WW, WH);
    drawShadows();

    const loaded = Shell.phase === "intro" || game.mode === "aim";
    const pull = loaded ? currentPull() : { x: 0, y: 0 };
    const wobble = reduceMotion ? 0 : game.bandWobble * Math.sin(time * 48) * 7;
    const pouchX = SLING.x + pull.x + wobble;
    const pouchY = SLING.y + pull.y - wobble * 0.3;
    const grip = loaded ? BALL.r * 0.7 : 0;
    const bandWidth = 3.4 - (Math.hypot(pouchX - SLING.x, pouchY - SLING.y) / SLING.maxPull) * 1.4;
    drawSlingBack(pouchX, pouchY, grip, bandWidth);

    const queued = game.shotsLeft - (game.mode === "aim" || game.mode === "reload" ? 1 : 0);
    for (let index = 0; index < queued && index < QUEUE.length; index += 1) {
      const hop = reduceMotion ? 0 : Math.max(0, Math.sin(game.hopT * 3 + index * 1.7)) * 3;
      drawFluff(QUEUE[index][0], GROUND_Y - 7 - QUEUE[index][1] - hop, 6.5, { x: 1, y: -0.3 }, { blink: game.blinkT < 0 });
    }

    game.bodies.forEach((b) => {
      if (b.kind === "block") {
        drawBlock(b);
      }
    });
    game.bodies.forEach((b) => {
      if (b.kind === "foe") {
        drawFoe(b, time);
      }
    });
    const ball = game.ball;
    if (ball && !ball.dead) {
      const speed = Math.hypot(ball.vx, ball.vy) || 1;
      drawFluff(ball.x, ball.y, ball.r, { x: ball.vx / speed, y: ball.vy / speed }, {
        squash: reduceMotion ? 0 : clamp(ball.squash, -0.4, 0.85),
        squashA: ball.squashA,
        spin: ball.a,
        blink: ball.state !== "fly"
      });
    }

    if (game.mode === "reload" && Shell.phase === "play") {
      const t = clamp(game.reloadT / RELOAD_TIME, 0, 1);
      const ease = t * t * (3 - 2 * t);
      const x = QUEUE[0][0] + (SLING.x - QUEUE[0][0]) * ease;
      const y = GROUND_Y - 7 + (SLING.y - GROUND_Y + 7) * ease - Math.sin(t * Math.PI) * 26;
      drawFluff(x, y, 6.5 + 1.5 * ease, { x: 1, y: -0.2 });
    } else if (loaded) {
      const effort = Math.hypot(pull.x, pull.y) / SLING.maxPull;
      drawFluff(pouchX, pouchY, BALL.r, { x: 1, y: -0.3 }, { blink: game.blinkT < 0, effort, squash: effort * 0.25, squashA: Math.atan2(pull.y, pull.x) });
    }
    drawSlingFront();

    if (loaded && Math.hypot(pull.x, pull.y) >= SLING.minPull) {
      drawPreview(pull);
    }
    if (Shell.phase === "play" && game.mode === "aim" && !game.launched && !game.drag && !game.keyAim) {
      drawHint(time);
    }

    ctx.restore();
    drawFx();
  };

  const KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

  // Pointer hooks get served pixels; the game works in world units.
  const toWorld = (point) => ({ x: point.x * K, y: point.y * K });

  // Generous drag zones: the whole slingshot side of the stage.
  const inDragZone = (p) => (FORMAT === "rail"
    ? p.y > WH * 0.5
    : FORMAT === "strip" ? p.x < WSAFE.x + WSAFE.w * 0.4 : p.x < WW * 0.45);

  const onPointerDown = (served) => {
    const point = toWorld(served);
    if ((game.mode !== "aim" && game.mode !== "reload") || !inDragZone(point)) {
      return;
    }
    game.drag = { sx: point.x, sy: point.y };
    game.keyAim = false;
    game.pullX = 0;
    game.pullY = 0;
  };

  const onPointerMove = (served) => {
    if (!game.drag) {
      return;
    }
    const point = toWorld(served);
    const pull = clampPull(point.x - game.drag.sx, point.y - game.drag.sy);
    game.pullX = pull.x;
    game.pullY = pull.y;
  };

  const onPointerUp = (point, event) => {
    if (!game.drag) {
      return;
    }
    const cancelled = event && event.type === "pointercancel";
    if (!cancelled) {
      onPointerMove(point);
    }
    const pull = { x: game.pullX, y: game.pullY };
    game.drag = null;
    game.pullX = 0;
    game.pullY = 0;
    if (cancelled || (game.mode !== "aim" && game.mode !== "reload")) {
      return;
    }
    launch(pull);
  };

  const onKey = (key, down, event) => {
    const dir = KEYS[key];
    if (dir) {
      game.keys[dir] = down;
      if (down && !game.drag) {
        game.keyAim = true;
      }
      return true;
    }
    if (key === " " || key === "Spacebar" || key === "Enter") {
      if (down && !(event && event.repeat) && game.mode === "aim" && !game.drag) {
        launch(keyPull());
      }
      return true;
    }
    return false;
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
    endEyebrow.textContent = endSummary();
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
