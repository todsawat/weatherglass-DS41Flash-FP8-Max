/* ===== 00_boot.js — namespace, quality, state, noise, plumbing ===== */
(function () {
'use strict';
const qs = new URLSearchParams(location.search);
const WG = window.WG = Object.create(null);
WG.version = '1.0';
WG.buildInfo = 'DeepSeek V4.1 Flash 1017 · FP8 weights · max effort · 4× DGX Spark · experiment run 2 · 7 h 30 min';
console.info('[Weatherglass]', WG.buildInfo);
WG.scenario = (qs.get('scenario') || 'calm').toLowerCase();
WG.debug = qs.has('debug');
WG.built = Date.now();

/* ---------- quality ---------- */
const ua = navigator.userAgent;
const coarse = matchMedia('(pointer:coarse)').matches;
const mobile = coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
const small = Math.min(innerWidth, innerHeight) < 620;
const cores = navigator.hardwareConcurrency || 4;
let level = mobile ? 0 : (small ? 0 : (cores >= 8 ? 2 : 1));
const qp = qs.get('q');
if (qp !== null && /^[012]$/.test(qp)) level = +qp;
const Q = WG.quality = {
  level,
  mobile, coarse, small,
  maxDpr: [1.35, 1.7, 2][level],
  grass: [20000, 60000, 120000][level],
  trees: [16, 23, 30][level],
  bushes: [14, 22, 32][level],
  flowers: [500, 1600, 3800][level],
  particles: [1000, 2600, 5200][level],
  stars: [300, 450, 600][level],
  animals: [0.55, 0.8, 1][level],
  cloudLobes: [8, 10, 13][level],
  cloudSegs: [8, 12, 16][level],
  shadowMap: [1024, 2048, 4096][level],
  reflections: level >= 1,
  tiltShift: level >= 1,
  blur: level >= 1,
  mistRes: [256, 384, 512][level],
  envSize: [64, 128, 256][level],
  animateClouds: true,
  dpr: Math.min(devicePixelRatio || 1, [1.35, 1.7, 2][level]),
  scale: 1
};
if (qp !== null) { Q.dpr = Math.min(devicePixelRatio || 1, Q.maxDpr); Q.forced = true; }

/* ---------- state ---------- */
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
WG.state = {
  time: 15.233, playing: false, sceneTime: 0,
  season: 0, seasonVel: 0, seasonTarget: null,
  temp: 18, humidity: 0.46,
  wet: 0.12, snow: 0, frost: 0, fog: 0.04, mist: 0.05, ice: 0, waterY: 0.1, flow: 1,
  wind: 0.3, windAngle: 0.55, windVec: V3(0.26, 0, 0.16), windGust: 0,
  cloudCover: 0.12, storm: 0, rain: 0, snowfall: 0, hail: 0,
  daylight: 1, golden: 0, night: 0, dusk: 0, overcast: 0,
  sunAlt: 32, sunAz: 0.84, moonAlt: -20, moonAz: 0,
  sunPos: V3(-18, 16, 15), moonPos: V3(18, -16, -15),
  sunVis: 1, moonVis: 0, cloudShadow: 0, flash: 0, flashCool: 0,
  leaves: 0.85, blossom: 0.8, grassH: 0.6, snowline: 9,
  fires: 0.1, streak: 0, frames: 0, fps: 60, dtAvg: 1 / 60,
  lastInput: 0, exposure: 1.05, hourGlide: null,
  readyOnce: false, hidden: false, tool: 'hand',
  gaugeTemp: 18, gaugeHum: 46,
  windSweep: 0, windDirJitter: 0,
  dpiDirty: true, qualityShift: 0
};
WG.state.tempAt = function (y) { return this.temp - (y - 0.1) * 5; };

/* ---------- small maths ---------- */
const U = WG.util = {
  TAU: Math.PI * 2,
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  clamp01: v => v < 0 ? 0 : v > 1 ? 1 : v,
  lerp: (a, b, t) => a + (b - a) * t,
  smoothstep: (a, b, x) => { const t = U.clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); },
  smootherstep: (a, b, x) => { const t = U.clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); },
  damp: (a, b, lambda, dt) => U.lerp(a, b, 1 - Math.exp(-lambda * dt)),
  approach: (a, b, step) => a < b ? Math.min(a + step, b) : Math.max(a - step, b),
  easeOut: t => 1 - Math.pow(1 - t, 3),
  easeInOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  sign: v => v < 0 ? -1 : v > 0 ? 1 : 0,
  randRange: (a, b) => a + (b - a) * Math.random(),
  pick: arr => arr[(Math.random() * arr.length) | 0],
  polar: (angle, r) => [Math.cos(angle) * r, Math.sin(angle) * r]
};
WG.util.remap = (v, a, b, c, d) => c + (d - c) * U.clamp01((v - a) / (b - a));

/* ---------- seeded rng + noise ---------- */
WG.rng = function (seed) {
  let a = 0;
  for (let i = 0; i < String(seed).length; i++) a = (a * 31 + String(seed).charCodeAt(i)) >>> 0;
  a ^= 0x9e3779b9;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
const hash2 = (x, y) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};
const fade = t => t * t * (3 - 2 * t);
WG.noise2 = function (x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = fade(xf), v = fade(yf);
  return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
};
WG.noise3 = function (x, y, z) {
  const zi = Math.floor(z), zf = z - zi;
  return U.lerp(WG.noise2(x, y + zi * 37.7), WG.noise2(x + 19.3, y - zi * 17.1), fade(zf));
};
WG.fbm2 = function (x, y, oct = 4) {
  let s = 0, amp = .5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += WG.noise2(x * f, y * f) * amp; norm += amp; amp *= .5; f *= 2.03; }
  return s / norm;
};
WG.ridged2 = function (x, y, oct = 4) {
  let s = 0, amp = .55, f = 1;
  for (let i = 0; i < oct; i++) { s += (1 - Math.abs(WG.noise2(x * f, y * f) * 2 - 1)) * amp; amp *= .5; f *= 2.11; }
  return s;
};

/* ---------- register / events ---------- */
WG.modules = Object.create(null);
WG.readyModules = [];
WG.failedModules = [];
WG.ordered = [];
WG.register = function (name, def) {
  if (WG.modules[name]) { WG.warn('boot', new Error('duplicate module ' + name)); return; }
  WG.modules[name] = def; WG.ordered.push({ name, def });
};
WG.events = Object.create(null);
WG.on = function (type, fn) {
  (WG.events[type] || (WG.events[type] = [])).push(fn);
  return () => WG.off(type, fn);
};
WG.off = function (type, fn) {
  const a = WG.events[type]; if (!a) return;
  const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
};
WG.emit = function (type, data) {
  const a = WG.events[type]; if (!a) return;
  for (let i = 0; i < a.length; i++) { try { a[i](data); } catch (e) { WG.warn('event:' + type, e); } }
};
WG.warn = function (scope, err) {
  if (!WG.warns) WG.warns = [];
  if (WG.warns.length < 200) WG.warns.push(scope + ': ' + (err && err.message || err));
  if (WG.debug || WG.warns.length < 40) console.warn('[WG ' + scope + ']', err);
};
WG.run = function (scope, fn) {
  try { return fn(); } catch (e) { WG.warn(scope, e); }
};

/* ---------- groups (attached by engine once scene exists) ---------- */
WG.groups = Object.create(null);
['root', 'studio', 'case', 'glass', 'land', 'water', 'flora', 'props', 'sky', 'clouds', 'weather', 'glassfx', 'animals', 'fx'].forEach(n => {
  WG.groups[n] = new THREE.Group(); WG.groups[n].name = n;
  WG.groups[n].matrixAutoUpdate = true;
});

/* ---------- palette ---------- */
const P = WG.palette = {
  brassLight: '#ae9365', brassShade: '#5b4428', brassPatina: '#5d6552', brassGlow: '#ffd98a',
  glassEdge: '#518f7d', glassTint: '#87b7a1',
  walnut: '#33241b', walnutLight: '#5a4030', table: '#241a13', backdrop: '#28231e', backdropWarm: '#423b33',
  grass: '#8aa16f', grassShade: '#31442b', grassAutumn: '#9c8550', grassWinter: '#b7a985',
  pine: '#263e2b', oak: '#3f5c33', birch: '#6c7f3f', cherry: '#b4949a',
  rock: '#9a9791', rockShade: '#434444', soil: '#3a2a1e', loam: '#5a402c', clay: '#a8683c',
  gravel: '#7b7973', bedrock: '#6e6960', lake: '#397f86', lakeDeep: '#123b43', river: '#3d7f82',
  foam: '#e9f3ef', cloud: '#dddbd8', log: '#6e6054', shingle: '#5c544b', cream: '#e4dcc6',
  door: '#7a2c22', shutter: '#3c5e48', sun: '#ffe6bd', sunlight: '#fff8ef', moon: '#adc5ff',
  stormCloud: '#52585e', nightSky: '#0c141c', starA: '#dfe9ff', starB: '#ffe9c4',
  smoke: '#c8c2b8', firefly: '#d8ff8a', ui: '#f4efe6',
  leafColors: ['#c8461a', '#e07b1f', '#e9a92b', '#b5301c', '#f0c24a']
};
WG.col = hex => new THREE.Color(hex).convertSRGBToLinear();
WG.cols = Object.create(null);
for (const k in P) if (typeof P[k] === 'string') WG.cols[k] = WG.col(P[k]);

/* ---------- shared temps ---------- */
WG.tmp = { v1: V3(), v2: V3(), v3: V3(), q1: new THREE.Quaternion(), e1: new THREE.Euler(), m1: new THREE.Matrix4(), c1: new THREE.Color(), box: new THREE.Box3() };

/* ---------- loading / hints stubs ---------- */
WG.ready = false;
WG.markReady = function () {
  if (WG.ready) return; WG.ready = true;
  const l = document.getElementById('loading');
  if (l) { l.classList.add('done'); setTimeout(() => l.classList.add('gone'), 1700); }
  setTimeout(() => { window.__WG_READY__ = true; }, 500);
};

/* ---------- expose basics ---------- */
WG.getTool = () => WG.state.tool;
WG.isTouch = coarse;
})();