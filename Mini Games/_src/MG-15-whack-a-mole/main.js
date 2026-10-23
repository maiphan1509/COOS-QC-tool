(() => {
  "use strict";

  /* ------------------------------------------------------------------- CONFIG */

  // Re-skin the ad here. Game rules live in the GAME section below.
  const CONFIG = {
    eventPrefix: "mg-whack-a-mole",           // CustomEvent namespace
    api: "mgWhackAMole",                      // window.<api> handle
    campaign: "moko-snacks",
    offer: "−30%",
    winTitle: "Mole master!",
    loseTitle: "Nice try!",
    goal: 15,                                 // points that count as a win (12 on the strip)
    maxPlayMs: 30000,                         // hard stop: a session never runs past this
    idleStopMs: 30000                         // stop the attract loop after this long untouched
  };

  const PALETTE = {
    skyTop: "#5ec8ff",
    skyBottom: "#c9f0ff",
    hillFar: "#5fbf4a",
    hillNear: "#4aa83a",
    grassTop: "#7fd651",
    grassBottom: "#3f9a2c",
    stripe: "rgba(255, 255, 255, 0.06)",
    hole: "#2a1608",
    holeInner: "#140a03",
    dirt: "#8a5a2b",
    dirtLight: "#b07a3e",
    mole: ["#9a6236", "#7a4a26"],
    belly: "#e8c59a",
    gold: ["#ffe27a", "#e0a81a"],
    nose: "#ff7d9a",
    bomb: "#1d2330",
    spark: "#ffd23f",
    hammerHead: "#d8443a",
    hammerHandle: "#c8935a",
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

  // Hole field per format; lower rows sit closer to the viewer, so they scale
  // up. The strip gets a single row of six.
  const HOLES = {
    popup: [
      { x: 62, y: 96, s: 0.82 }, { x: 150, y: 96, s: 0.82 }, { x: 238, y: 96, s: 0.82 },
      { x: 56, y: 150, s: 0.93 }, { x: 150, y: 150, s: 0.93 }, { x: 244, y: 150, s: 0.93 },
      { x: 50, y: 210, s: 1.05 }, { x: 150, y: 210, s: 1.05 }, { x: 250, y: 210, s: 1.05 }
    ],
    rail: [86, 128, 170, 212].flatMap((y, row) => [27, 73].map((x) => ({ x, y, s: 0.52 + row * 0.03 }))),
    strip: Array.from({ length: 6 }, (_, index) => ({ x: SAFE.x + (SAFE.w * (index + 0.5)) / 6, y: 44, s: 0.5 }))
  }[FORMAT];

  const SCENE = {
    popup: { horizon: 70, hammer: 1, clouds: [[40, 40, 1], [210, 34, 0.8], [270, 50, 0.6]] },
    rail: { horizon: 60, hammer: 0.55, clouds: [[12, 44, 0.42], [64, 50, 0.34]] },
    strip: { horizon: 16, hammer: 0.5, clouds: [[110, 6, 0.3], [250, 9, 0.25], [370, 5, 0.3]] }
  }[FORMAT];

  if (FORMAT === "strip") {
    CONFIG.goal = 12;
  }
  const HOLE_RX = 34;
  const HOLE_RY = 11;
  const MOLE_H = 46;              // body height at full pop, before row scale
  const RISE_TIME = 0.14;
  const FALL_TIME = 0.16;
  const HIT_HOLD = 0.38;          // dazed pose before it sinks
  const SPAWN = { start: 0.8, end: 0.48 };          // seconds between pop-ups
  const STAY = { mole: [1.05, 0.72], gold: [0.62, 0.5], bomb: [1.25, 1.0] };
  const POINTS = { mole: 1, gold: 3 };
  const COMBO_WINDOW = 0.9;
  const LIVES = 3;
  const BOMB_GRACE = 3;           // seconds before the first bomb can appear
  const HAMMER_TIME = 0.16;

  // Digits pick holes in reading order; the 3x3 popup also takes QWE/ASD/ZXC.
  const KEY_HOLES = {};
  HOLES.forEach((_, index) => {
    KEY_HOLES[String(index + 1)] = index;
    if (HOLES.length === 9) {
      KEY_HOLES["qweasdzxc"[index]] = index;
    }
  });

  const lifePips = document.querySelectorAll(".hp i");

  const game = {
    holes: HOLES.map(() => ({ state: "down", t: 0, kind: "mole", stay: 1 })),
    clock: 0,
    playTime: 0,
    spawnTimer: 0.4,
    lives: LIVES,
    combo: 0,
    lastHitAt: -9,
    hammer: { x: 150, y: 150, t: 1 },
    flash: 0
  };

  const renderLives = () => {
    lifePips.forEach((pip, index) => pip.classList.toggle("is-lost", index >= game.lives));
  };

  const ramp = () => clamp(game.playTime / (CONFIG.maxPlayMs / 1000), 0, 1);

  const pickKind = (withBombs) => {
    const roll = Math.random();
    if (withBombs && game.playTime > BOMB_GRACE && roll < 0.18) {
      return "bomb";
    }
    return roll > 0.86 ? "gold" : "mole";
  };

  const spawn = (withBombs) => {
    const free = [];
    game.holes.forEach((hole, index) => {
      if (hole.state === "down") {
        free.push(index);
      }
    });
    if (!free.length) {
      return;
    }
    const hole = game.holes[free[Math.floor(Math.random() * free.length)]];
    hole.kind = pickKind(withBombs);
    const [slow, fast] = STAY[hole.kind];
    hole.stay = slow + (fast - slow) * ramp();
    hole.state = "rising";
    hole.t = 0;
  };

  // How far out of the hole the occupant is, 0..1.
  const popAmount = (hole) => {
    if (hole.state === "rising") {
      const t = clamp(hole.t / RISE_TIME, 0, 1);
      return 1 - Math.pow(1 - t, 3);
    }
    if (hole.state === "up" || hole.state === "hit") {
      return 1;
    }
    if (hole.state === "falling") {
      return 1 - clamp(hole.t / FALL_TIME, 0, 1);
    }
    return 0;
  };

  const stepHoles = (dt, withBombs) => {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      game.spawnTimer = SPAWN.start + (SPAWN.end - SPAWN.start) * ramp();
      spawn(withBombs);
      // Later in the round, sometimes two pop at once.
      if (ramp() > 0.45 && Math.random() < 0.35) {
        spawn(withBombs);
      }
    }
    game.holes.forEach((hole) => {
      hole.t += dt;
      if (hole.state === "rising" && hole.t >= RISE_TIME) {
        hole.state = "up";
        hole.t = 0;
      } else if (hole.state === "up" && hole.t >= hole.stay) {
        hole.state = "falling";
        hole.t = 0;
      } else if (hole.state === "hit" && hole.t >= HIT_HOLD) {
        hole.state = "falling";
        hole.t = 0;
      } else if (hole.state === "falling" && hole.t >= FALL_TIME) {
        hole.state = "down";
        hole.t = 0;
      }
    });
  };

  const whack = (index) => {
    const hole = game.holes[index];
    const spot = HOLES[index];
    if (hole.state !== "rising" && hole.state !== "up") {
      return false;
    }
    hole.state = "hit";
    hole.t = 0;
    const headY = spot.y - MOLE_H * spot.s * 0.75;
    if (hole.kind === "bomb") {
      game.lives -= 1;
      game.flash = 1;
      renderLives();
      burst(spot.x, headY, "#ff6b3a", 24, 150);
      burst(spot.x, headY, PALETTE.spark, 14, 100);
      floatText(spot.x, headY - 14, "BOOM!", "#ff6b3a");
      shake();
      game.combo = 0;
      if (game.lives <= 0) {
        endGame(Shell.score >= CONFIG.goal);
      }
      return true;
    }
    game.combo = game.clock - game.lastHitAt <= COMBO_WINDOW ? game.combo + 1 : 1;
    game.lastHitAt = game.clock;
    let gain = POINTS[hole.kind];
    if (game.combo >= 3) {
      gain += 1;
    }
    setScore(Shell.score + gain);
    burst(spot.x, headY, hole.kind === "gold" ? PALETTE.gold[0] : "#ffffff", hole.kind === "gold" ? 18 : 10, 90);
    floatText(spot.x, headY - 12, game.combo >= 3 ? `+${gain} COMBO x${game.combo}` : `+${gain}`,
      hole.kind === "gold" ? PALETTE.gold[0] : PALETTE.text);
    return true;
  };

  // Generous hit box: the whole visible body plus a margin above it.
  const holeAt = (point) => {
    for (let index = HOLES.length - 1; index >= 0; index -= 1) {
      const spot = HOLES[index];
      const hole = game.holes[index];
      const pop = popAmount(hole);
      const margin = 8 * SCENE.hammer;
      const top = spot.y - MOLE_H * spot.s * Math.max(pop, 0.4) - margin * 1.25;
      if (Math.abs(point.x - spot.x) <= HOLE_RX * spot.s + margin && point.y >= top && point.y <= spot.y + HOLE_RY * spot.s + margin) {
        return index;
      }
    }
    return -1;
  };

  const swing = (x, y) => {
    game.hammer.x = x;
    game.hammer.y = y;
    game.hammer.t = 0;
  };

  const resetGame = () => {
    game.holes.forEach((hole) => {
      hole.state = "down";
      hole.t = 0;
    });
    game.playTime = 0;
    game.spawnTimer = 0.5;
    game.lives = LIVES;
    game.combo = 0;
    game.lastHitAt = -9;
    game.hammer.t = 1;
    game.flash = 0;
    renderLives();
  };

  const tickClock = (dt) => {
    game.clock += dt;
    game.hammer.t = Math.min(1, game.hammer.t + dt / HAMMER_TIME);
    game.flash = Math.max(0, game.flash - dt * 3);
  };

  // Runs only in the play phase.
  const update = (dt) => {
    tickClock(dt);
    game.playTime += dt;
    stepHoles(dt, true);
    if (Shell.score >= CONFIG.goal) {
      endGame(true);
    }
  };

  // Attract mode: moles keep popping behind the intro card, no bombs.
  const idle = (dt) => {
    tickClock(dt);
    if (Shell.phase === "intro") {
      stepHoles(dt, false);
    }
  };

  /* -------------------------------------------------------------- RENDERING */

  const BACKDROP = (() => {
    const layer = document.createElement("canvas");
    layer.width = Math.round(WIDTH * DPR);
    layer.height = Math.round(HEIGHT * DPR);
    const g = layer.getContext("2d");
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const horizon = SCENE.horizon;
    const u = horizon / 70;

    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, WIDTH, horizon);

    g.fillStyle = "rgba(255, 255, 255, 0.85)";
    SCENE.clouds.forEach(([x, y, size]) => {
      g.beginPath();
      g.arc(x, y, 9 * size, 0, Math.PI * 2);
      g.arc(x + 11 * size, y - 4 * size, 11 * size, 0, Math.PI * 2);
      g.arc(x + 24 * size, y, 8 * size, 0, Math.PI * 2);
      g.fill();
    });

    g.fillStyle = PALETTE.hillFar;
    g.beginPath();
    g.moveTo(0, horizon);
    g.quadraticCurveTo(WIDTH * 0.2, horizon - 28 * u, WIDTH * 0.43, horizon - 6 * u);
    g.quadraticCurveTo(WIDTH * 0.7, horizon - 32 * u, WIDTH, horizon - 8 * u);
    g.lineTo(WIDTH, horizon + 10 * u);
    g.lineTo(0, horizon + 10 * u);
    g.fill();

    const grass = g.createLinearGradient(0, horizon - 8 * u, 0, HEIGHT);
    grass.addColorStop(0, PALETTE.grassTop);
    grass.addColorStop(1, PALETTE.grassBottom);
    g.fillStyle = grass;
    g.beginPath();
    g.moveTo(0, horizon + 2 * u);
    g.quadraticCurveTo(WIDTH / 2, horizon - 10 * u, WIDTH, horizon + 2 * u);
    g.lineTo(WIDTH, HEIGHT);
    g.lineTo(0, HEIGHT);
    g.fill();

    g.fillStyle = PALETTE.stripe;
    for (let x = -60; x < WIDTH + 60; x += 40) {
      g.beginPath();
      g.moveTo(x, horizon);
      g.lineTo(x + 20, horizon);
      g.lineTo(x + 60, HEIGHT);
      g.lineTo(x + 30, HEIGHT);
      g.fill();
    }

    g.fillStyle = "rgba(255, 255, 255, 0.18)";
    for (let index = 0; index < (WIDTH * (HEIGHT - horizon)) / 1100; index += 1) {
      const x = Math.random() * WIDTH;
      const y = horizon + 10 * u + Math.random() * (HEIGHT - horizon - 10 * u);
      g.fillRect(x, y, 1, 3 * Math.max(u, 0.5));
    }

    HOLES.forEach((spot) => {
      const rx = HOLE_RX * spot.s;
      const ry = HOLE_RY * spot.s;
      const lip = 6 * spot.s;
      g.fillStyle = "rgba(0, 0, 0, 0.18)";
      g.beginPath();
      g.ellipse(spot.x, spot.y + 4 * spot.s, rx + lip * 1.4, ry + 5 * spot.s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = PALETTE.dirt;
      g.beginPath();
      g.ellipse(spot.x, spot.y, rx + lip, ry + 4 * spot.s, 0, 0, Math.PI * 2);
      g.fill();
      const pit = g.createRadialGradient(spot.x, spot.y + ry * 0.4, 1, spot.x, spot.y, rx);
      pit.addColorStop(0, PALETTE.holeInner);
      pit.addColorStop(1, PALETTE.hole);
      g.fillStyle = pit;
      g.beginPath();
      g.ellipse(spot.x, spot.y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    });
    return layer;
  })();

  const drawMole = (x, baseY, s, pop, hole) => {
    const gold = hole.kind === "gold";
    const dazed = hole.state === "hit";
    const squash = dazed ? 1 - 0.18 * Math.max(0, 1 - hole.t / 0.12) : 1;
    const h = MOLE_H * s * squash;
    const w = 26 * s * (dazed ? 1 + (1 - squash) : 1);
    const top = baseY - h * pop;
    const colors = gold ? PALETTE.gold : PALETTE.mole;

    const body = ctx.createLinearGradient(x - w, 0, x + w, 0);
    body.addColorStop(0, colors[1]);
    body.addColorStop(0.45, colors[0]);
    body.addColorStop(1, colors[1]);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - w, top + h + 10);
    ctx.lineTo(x - w, top + w * 0.9);
    ctx.quadraticCurveTo(x - w, top, x, top);
    ctx.quadraticCurveTo(x + w, top, x + w, top + w * 0.9);
    ctx.lineTo(x + w, top + h + 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = PALETTE.belly;
    ctx.beginPath();
    ctx.ellipse(x, top + h * 0.78, w * 0.62, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const eyeY = top + h * 0.3;
    const eyeDX = w * 0.36;
    ctx.strokeStyle = "#1a0d05";
    ctx.fillStyle = "#1a0d05";
    ctx.lineWidth = 1.6 * s;
    if (dazed) {
      [-1, 1].forEach((side) => {
        const ex = x + side * eyeDX;
        ctx.beginPath();
        ctx.moveTo(ex - 3 * s, eyeY - 3 * s);
        ctx.lineTo(ex + 3 * s, eyeY + 3 * s);
        ctx.moveTo(ex + 3 * s, eyeY - 3 * s);
        ctx.lineTo(ex - 3 * s, eyeY + 3 * s);
        ctx.stroke();
      });
    } else {
      const blink = (game.clock * 0.7 + x * 0.01) % 3 < 0.08;
      [-1, 1].forEach((side) => {
        const ex = x + side * eyeDX;
        if (blink) {
          ctx.fillRect(ex - 3 * s, eyeY, 6 * s, 1.5 * s);
        } else {
          ctx.beginPath();
          ctx.arc(ex, eyeY, 3.2 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(ex + 1 * s, eyeY - 1 * s, 1.1 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1a0d05";
        }
      });
    }

    ctx.fillStyle = PALETTE.nose;
    ctx.beginPath();
    ctx.ellipse(x, eyeY + 8 * s, 5 * s, 3.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 2.5 * s, eyeY + 12 * s, 2.2 * s, 3.5 * s);
    ctx.fillRect(x + 0.3 * s, eyeY + 12 * s, 2.2 * s, 3.5 * s);

    if (gold) {
      // Hard hat with a lamp marks the bonus mole.
      ctx.fillStyle = "#ff8a1f";
      ctx.beginPath();
      ctx.ellipse(x, top + 5 * s, w * 0.95, 9 * s, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - w * 1.05, top + 4 * s, w * 2.1, 3 * s);
      ctx.fillStyle = "#fff6c2";
      ctx.beginPath();
      ctx.arc(x, top - 1 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    if (dazed) {
      ctx.fillStyle = PALETTE.spark;
      for (let star = 0; star < 3; star += 1) {
        const angle = game.clock * 7 + (star * Math.PI * 2) / 3;
        const sx = x + Math.cos(angle) * w * 0.9;
        const sy = top - 4 * s + Math.sin(angle) * 4 * s;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Paws resting on the rim once fully up.
    if (pop > 0.85) {
      ctx.fillStyle = colors[1];
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.ellipse(x + side * w * 0.75, baseY - 1 * s, 6 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  };

  const drawBomb = (x, baseY, s, pop, hole) => {
    const r = 17 * s;
    const cy = baseY - (r * 2 + 4 * s) * pop + r;
    const pulse = hole.state === "hit" ? 1.3 : 1 + Math.sin(game.clock * 18) * 0.04;
    ctx.fillStyle = PALETTE.bomb;
    ctx.beginPath();
    ctx.arc(x, cy, r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.beginPath();
    ctx.arc(x - r * 0.35, cy - r * 0.35, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a4152";
    ctx.fillRect(x - 4 * s, cy - r - 4 * s, 8 * s, 5 * s);
    ctx.strokeStyle = "#c8935a";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(x, cy - r - 4 * s);
    ctx.quadraticCurveTo(x + 6 * s, cy - r - 12 * s, x + 10 * s, cy - r - 9 * s);
    ctx.stroke();
    ctx.fillStyle = Math.floor(game.clock * 20) % 2 ? PALETTE.spark : "#ff6b3a";
    ctx.beginPath();
    ctx.arc(x + 10 * s, cy - r - 9 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5a5a";
    ctx.font = `900 ${Math.round(11 * s)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", x + 1 * s, cy + 1 * s);
  };

  const drawRim = (spot) => {
    const rx = HOLE_RX * spot.s;
    const ry = HOLE_RY * spot.s;
    ctx.fillStyle = PALETTE.dirt;
    ctx.beginPath();
    ctx.ellipse(spot.x, spot.y, rx + 6 * spot.s, ry + 4 * spot.s, 0, 0, Math.PI);
    ctx.ellipse(spot.x, spot.y, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.dirtLight;
    ctx.beginPath();
    ctx.ellipse(spot.x, spot.y + spot.s, rx + 2 * spot.s, ry + 1.5 * spot.s, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.ellipse(spot.x, spot.y, rx, ry, 0, 0.85 * Math.PI, 0.15 * Math.PI, true);
    ctx.closePath();
    ctx.fill();
  };

  const drawHammer = () => {
    const hammer = game.hammer;
    if (hammer.t >= 1) {
      return;
    }
    // Swing down fast, then lift away.
    const t = hammer.t;
    const angle = t < 0.35 ? -0.9 + (t / 0.35) * 0.9 : ((t - 0.35) / 0.65) * -0.6;
    const size = SCENE.hammer;
    ctx.save();
    ctx.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    ctx.translate(hammer.x + 26 * size, hammer.y + 18 * size);
    ctx.rotate(angle);
    ctx.scale(size, size);
    ctx.fillStyle = PALETTE.hammerHandle;
    ctx.fillRect(-3, -4, 34, 7);
    ctx.fillStyle = PALETTE.hammerHead;
    ctx.fillRect(-34, -14, 30, 26);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(-34, -14, 30, 5);
    ctx.fillStyle = "#a0302a";
    ctx.fillRect(-34, 8, 30, 4);
    ctx.restore();
  };

  const draw = () => {
    ctx.drawImage(BACKDROP, 0, 0, WIDTH, HEIGHT);

    HOLES.forEach((spot, index) => {
      const hole = game.holes[index];
      const pop = popAmount(hole);
      if (pop > 0.01) {
        const rx = HOLE_RX * spot.s;
        const ry = HOLE_RY * spot.s;
        ctx.save();
        ctx.beginPath();
        const reach = MOLE_H * spot.s * 2;
        ctx.rect(spot.x - rx - 10 * spot.s, spot.y - reach, (rx + 10 * spot.s) * 2, reach);
        ctx.ellipse(spot.x, spot.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip();
        if (hole.kind === "bomb") {
          drawBomb(spot.x, spot.y + ry, spot.s, pop, hole);
        } else {
          drawMole(spot.x, spot.y + ry, spot.s, pop, hole);
        }
        ctx.restore();
      }
      drawRim(spot);
    });

    drawHammer();

    if (game.flash > 0 && !reduceMotion) {
      ctx.fillStyle = `rgba(255, 90, 60, ${game.flash * 0.35})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    drawFx();
  };

  /* --------------------------------------------------------------- GAME INPUT */

  const onPointerDown = (point) => {
    swing(point.x, point.y);
    const index = holeAt(point);
    if (index >= 0) {
      whack(index);
    } else {
      game.combo = 0;
    }
  };

  const onPointerMove = () => {};
  const onPointerUp = () => {};

  const onKey = (key, down) => {
    const index = KEY_HOLES[key.toLowerCase ? key.toLowerCase() : key];
    if (index === undefined) {
      return false;
    }
    if (down) {
      const spot = HOLES[index];
      swing(spot.x, spot.y - MOLE_H * spot.s * 0.6);
      whack(index);
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
    endEyebrow.textContent = `${Shell.score} points`;
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
