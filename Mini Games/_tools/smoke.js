// Headless smoke test for a Mini Games creative.
// usage: node "Mini Games/_tools/smoke.js" "<game folder>" [seconds=60] [popup|rail|strip|strip-close]
// Stubs DOM + canvas, boots main.js, plays with random pointer/keyboard input
// at 60fps on a fake clock, and fails on any thrown error, NaN draw args or
// negative arc radius (which throws IndexSizeError in real browsers).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = process.argv[2];
const seconds = Number(process.argv[3]) || 60;
const formatArg = process.argv[4] || "";
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const js = fs.readFileSync(path.join(dir, "main.js"), "utf8");

let now = 1000;
let failures = [];
let nanCalls = 0;
let opsThisFrame = 0;
let maxOps = 0;
const fail = (label, err) => {
  failures.push(`${label}: ${err && err.stack ? err.stack.split("\n").slice(0, 4).join("\n   ") : err}`);
};

const NUMERIC = new Set(["arc", "arcTo", "ellipse", "fillRect", "strokeRect", "clearRect", "rect", "roundRect",
  "moveTo", "lineTo", "quadraticCurveTo", "bezierCurveTo", "translate", "rotate", "scale", "setTransform",
  "transform", "drawImage", "fillText", "strokeText", "createLinearGradient", "createRadialGradient"]);

const gradient = () => ({ addColorStop(offset) { if (!(offset >= 0 && offset <= 1)) throw new RangeError(`addColorStop offset ${offset}`); } });

const makeCtx = (canvas) => {
  const store = { canvas, globalAlpha: 1, lineWidth: 1, font: "10px sans-serif", fillStyle: "#000", strokeStyle: "#000" };
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args) => {
        opsThisFrame += 1;
        if (NUMERIC.has(prop)) {
          const nums = prop === "fillText" || prop === "strokeText" ? args.slice(1, 3) : prop === "drawImage" ? args.slice(1) : args;
          if (nums.some((n) => typeof n === "number" && !Number.isFinite(n))) {
            nanCalls += 1;
            if (nanCalls <= 3) fail(`non-finite ${String(prop)}(${args.map(String).join(", ")})`, new Error().stack);
          }
        }
        if ((prop === "arc" && args[2] < 0) || (prop === "ellipse" && (args[2] < 0 || args[3] < 0))) {
          throw new RangeError(`IndexSizeError: negative radius in ${prop}(${args.join(", ")})`);
        }
        if (prop === "createLinearGradient" || prop === "createRadialGradient" || prop === "createConicGradient") return gradient();
        if (prop === "createPattern") return {};
        if (prop === "measureText") return { width: String(args[0]).length * 6, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 };
        if (prop === "getImageData" || prop === "createImageData") return { data: new Uint8ClampedArray(4 * (args[2] || 1) * (args[3] || 1)), width: args[2] || 1, height: args[3] || 1 };
        if (prop === "getTransform") return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        if (prop === "isPointInPath" || prop === "isPointInStroke") return false;
        if (prop === "getLineDash") return [];
        return undefined;
      };
    },
    set(target, prop, value) {
      if (prop === "globalAlpha" && typeof value === "number" && !Number.isFinite(value)) {
        nanCalls += 1;
        if (nanCalls <= 3) fail(`non-finite globalAlpha ${value}`, new Error().stack);
      }
      target[prop] = value;
      return true;
    }
  });
};

const makeEl = (id, tag = "div") => {
  const listeners = {};
  const classes = new Set();
  const el = {
    id, tagName: tag.toUpperCase(), dataset: {}, style: { setProperty() {}, removeProperty() {} }, textContent: "", innerHTML: "",
    hidden: false, disabled: false, width: 300, height: 250, offsetWidth: 300, offsetHeight: 250, clientWidth: 300, clientHeight: 250,
    children: [], childNodes: [], parentNode: null,
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, force) => { const on = force === undefined ? !classes.has(c) : !!force; if (on) classes.add(c); else classes.delete(c); return on; },
      contains: (c) => classes.has(c)
    },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    dispatchEvent(event) {
      (listeners[event.type] || []).slice().forEach((fn) => {
        try { fn.call(el, event); } catch (err) { fail(`listener ${event.type} on #${id}`, err); }
      });
      return true;
    },
    focus() {}, blur() {}, click() { el.dispatchEvent(evt("click", { target: el })); },
    getBoundingClientRect: () => ({ left: 0, top: 0, x: 0, y: 0, width: 300, height: 250, right: 300, bottom: 250 }),
    setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => false,
    setAttribute(k, v) { el[`attr:${k}`] = String(v); }, getAttribute(k) { return el[`attr:${k}`] ?? null; }, removeAttribute(k) { delete el[`attr:${k}`]; },
    appendChild(child) { el.children.push(child); return child; }, removeChild(child) { return child; }, remove() {}, append() {}, prepend() {},
    querySelector: () => makeEl("q"), querySelectorAll: () => [], closest: () => null, contains: () => true,
    animate: () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null }),
    getContext() { el._ctx = el._ctx || makeCtx(el); return el._ctx; },
    _listeners: listeners
  };
  return el;
};

const elements = {};
for (const match of html.matchAll(/<(\w+)\s([^>]*?)\bid="([^"]+)"([^>]*)>/g)) {
  const el = makeEl(match[3], match[1]);
  const attrs = match[2] + " " + match[4];
  for (const data of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g)) {
    el.dataset[data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = data[2];
  }
  elements[match[3]] = el;
}
if (formatArg) {
  elements.ad.dataset.format = formatArg.replace("-close", "");
  if (formatArg.endsWith("-close") && !elements.closeButton) elements.closeButton = makeEl("closeButton", "button");
}
const ad = elements.ad;
const canvas = elements.stage;
if (!ad || !canvas) {
  console.log("FAIL: index.html must contain #ad and #stage");
  process.exit(1);
}

const evt = (type, extra = {}) => ({
  type, bubbles: true, defaultPrevented: false, timeStamp: now,
  preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...extra
});

let rafQueue = [];
let rafId = 0;
let timers = [];
let timerId = 0;
const docListeners = {};
const winListeners = {};

const documentStub = {
  hidden: false, visibilityState: "visible",
  getElementById: (id) => elements[id] || null,
  querySelector: (sel) => (sel.startsWith("#") ? elements[sel.slice(1)] || null : null),
  querySelectorAll: () => [],
  createElement: (tag) => makeEl(`created-${tag}`, tag),
  documentElement: makeEl("html", "html"), body: makeEl("body", "body"),
  addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
  removeEventListener() {}
};

const sandbox = {
  console, Math, Date, JSON, Array, Object, Number, String, Boolean, Map, Set, WeakMap, Symbol, Promise, Error, RangeError, TypeError,
  Float32Array, Uint8Array, Uint8ClampedArray, Int8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float64Array, URLSearchParams,
  parseFloat, parseInt, isNaN, isFinite,
  document: documentStub,
  location: { search: "", href: "http://localhost/" },
  navigator: { vibrate() { return true; }, userAgent: "smoke" },
  devicePixelRatio: 2,
  clickTag: null,
  performance: { now: () => now },
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  requestAnimationFrame: (cb) => { rafId += 1; rafQueue.push({ id: rafId, cb }); return rafId; },
  cancelAnimationFrame: (id) => { rafQueue = rafQueue.filter((r) => r.id !== id); },
  setTimeout: (fn, ms = 0) => { timerId += 1; timers.push({ id: timerId, fn, at: now + ms }); return timerId; },
  clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id); },
  setInterval: (fn, ms) => { timerId += 1; const id = timerId; const loop = () => { fn(); timers.push({ id, fn: loop, at: now + ms }); }; timers.push({ id, fn: loop, at: now + ms }); return id; },
  clearInterval: (id) => { timers = timers.filter((t) => t.id !== id); },
  open: (url) => { opened.push(url); return null; },
  addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
  removeEventListener() {},
  CustomEvent: function CustomEvent(type, init = {}) { return evt(type, { detail: init.detail }); },
  Event: function Event(type) { return evt(type); },
  Path2D: function Path2D() { return new Proxy({}, { get: () => () => {} }); },
  Image: function Image() { return makeEl("img", "img"); },
  OffscreenCanvas: function OffscreenCanvas(w, h) { const c = makeEl("offscreen", "canvas"); c.width = w; c.height = h; return c; },
  IntersectionObserver: function IntersectionObserver() { return { observe() {}, disconnect() {}, unobserve() {} }; },
  ResizeObserver: function ResizeObserver() { return { observe() {}, disconnect() {}, unobserve() {} }; }
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
const opened = [];

const emitted = [];
const realDispatch = ad.dispatchEvent;
ad.dispatchEvent = (event) => { if (event.type.includes(":")) emitted.push(event.type); return realDispatch(event); };

vm.createContext(sandbox);
try {
  vm.runInContext(js, sandbox, { filename: "main.js" });
} catch (err) {
  fail("boot", err);
}

const apiName = (js.match(/api:\s*"([^"]+)"/) || [])[1];
const api = apiName && sandbox[apiName];

const runTimers = () => {
  const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at);
  timers = timers.filter((t) => t.at > now);
  due.forEach((t) => { try { t.fn(); } catch (err) { fail("timer", err); } });
};

const frame = () => {
  now += 1000 / 60;
  runTimers();
  const queue = rafQueue;
  rafQueue = [];
  opsThisFrame = 0;
  queue.forEach((r) => { try { r.cb(now); } catch (err) { fail("frame", err); } });
  maxOps = Math.max(maxOps, opsThisFrame);
};

const fireAll = (event) => {
  [canvas, ad].forEach((el) => el.dispatchEvent({ ...event, target: canvas, currentTarget: el }));
  (docListeners[event.type] || []).forEach((fn) => { try { fn(event); } catch (err) { fail(`document ${event.type}`, err); } });
  (winListeners[event.type] || []).forEach((fn) => { try { fn(event); } catch (err) { fail(`window ${event.type}`, err); } });
};

const pointer = (type, x, y) => evt(type, { clientX: x, clientY: y, pointerId: 1, pointerType: "touch", button: 0, buttons: type === "pointerup" ? 0 : 1, isPrimary: true });
const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"];

// Attract mode for 2s.
for (let i = 0; i < 120; i += 1) frame();
const loopAliveInIntro = rafQueue.length > 0;

const phases = new Set([ad.dataset.phase]);
let ends = 0;
let gesture = null;
const playButton = elements.playButton;
if (playButton) playButton.click();
phases.add(ad.dataset.phase);

const totalFrames = seconds * 60;
for (let i = 0; i < totalFrames; i += 1) {
  if (!gesture && Math.random() < 0.08) {
    const x = Math.random() * 300;
    const y = 30 + Math.random() * 215;
    gesture = { x, y, dx: (Math.random() - 0.5) * 12, dy: (Math.random() - 0.5) * 12, left: 2 + Math.floor(Math.random() * 25) };
    fireAll(pointer("pointerdown", x, y));
  } else if (gesture) {
    gesture.x += gesture.dx;
    gesture.y += gesture.dy;
    gesture.left -= 1;
    fireAll(pointer("pointermove", gesture.x, gesture.y));
    if (gesture.left <= 0) {
      fireAll(pointer("pointerup", gesture.x, gesture.y));
      fireAll(evt("click", { clientX: gesture.x, clientY: gesture.y }));
      gesture = null;
    }
  }
  if (Math.random() < 0.05) {
    const key = KEYS[Math.floor(Math.random() * KEYS.length)];
    fireAll(evt("keydown", { key, code: key, repeat: false }));
    const keyUpAt = Math.floor(Math.random() * 20);
    sandbox.setTimeout(() => fireAll(evt("keyup", { key, code: key })), keyUpAt * 16);
  }
  frame();
  phases.add(ad.dataset.phase);
  if (ad.dataset.phase === "end") {
    ends += 1;
    for (let k = 0; k < 60; k += 1) frame();
    if (elements.replayButton) elements.replayButton.click();
  }
  if (failures.length > 6) break;
}

// Force a win path through the public API.
if (api && typeof api.start === "function" && typeof api.end === "function") {
  api.start();
  for (let i = 0; i < 30; i += 1) frame();
  api.end(true);
  for (let i = 0; i < 200; i += 1) frame();
  phases.add(ad.dataset.phase);
} else {
  fail("api", `window.${apiName} with start/end not found`);
}
const loopParkedAfterEnd = rafQueue.length === 0;
if (elements.ctaButton) elements.ctaButton.click();

const size = fs.readdirSync(dir).reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
const report = {
  folder: path.basename(dir),
  format: ad.dataset.format || "popup",
  bytes: size,
  phasesSeen: [...phases].join(","),
  naturalEnds: ends,
  events: [...new Set(emitted)].join(","),
  loopAliveInIntro,
  loopParkedAfterEnd,
  maxCanvasOpsPerFrame: maxOps,
  nanDrawCalls: nanCalls
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.log(`\nFAIL (${failures.length})`);
  failures.slice(0, 8).forEach((f) => console.log(" - " + f));
  process.exit(1);
}
if (!phases.has("play") || !phases.has("end")) {
  console.log("\nFAIL: never reached play and end phases");
  process.exit(1);
}
console.log("\nPASS");
