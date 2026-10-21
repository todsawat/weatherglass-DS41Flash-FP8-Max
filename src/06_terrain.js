/* ===== 06_terrain.js — landscape block, mountains, soil cross-section, rocks ===== */
/* Owner: terrain. WG.terrain API per contract §6. */
(function () {
'use strict';
const WG = window.WG, U = WG.util;
const R = WG.rng('terrain');
const TAU = U.TAU;
const QL = WG.quality.level;

/* ---------- bounds ---------- */
const X0 = -6, X1 = 6, Z0 = -4, Z1 = 4;
const BOTTOM = -1.8;
const NX = [228, 270, 316][QL];
const NZ = [154, 180, 212][QL];
const DX = (X1 - X0) / (NX - 1), DZ = (Z1 - Z0) / (NZ - 1);
const WALL_ROWS = [18, 22, 26][QL];
const TEX = WG.tex;

/* ---------- layout ---------- */
const PEAKS = [
  [-3.4, -3.75, 4.0, 1.55, 3.7],
  [-0.5, -3.6, 3.0, 1.35, 11.2],
  [2.0, -3.35, 3.3, 1.35, 5.3],
  [4.5, -3.5, 2.5, 1.25, 17.9],
  [-5.4, -3.5, 1.5, 1.0, 23.4]
];
const LAKE = { x: 2.75, z: 2.65, rx: 2.35, rz: 1.75 };
const POOL = { x: -1.5, z: -0.9, r: 0.42, surfaceY: 1.06 };
const LIP = { x: -1.5, z: -1.44, y: 2.16 };
const RIVER = [
  [-1.5, -0.9], [-1.12, -0.3], [-0.62, 0.12], [-0.04, 0.48],
  [0.55, 0.84], [1.1, 1.26], [1.58, 1.68], [2.0, 2.04]
];
const RIVER_T = [];
(function () {
  let acc = 0; RIVER_T.push(0);
  for (let i = 1; i < RIVER.length; i++) {
    acc += Math.hypot(RIVER[i][0] - RIVER[i - 1][0], RIVER[i][1] - RIVER[i - 1][1]);
    RIVER_T.push(acc);
  }
  for (let i = 0; i < RIVER_T.length; i++) RIVER_T[i] /= acc;
})();
const PATHS = [
  { w: 0.20, pts: [[-2.8, 1.72], [-2.15, 1.98], [-1.4, 2.22], [-0.62, 2.4], [0.0, 2.42]] },
  { w: 0.135, pts: [[-2.62, 1.08], [-1.9, 0.74], [-1.07, 0.55], [-0.28, 0.36]] },
  { w: 0.12, pts: [[2.62, 1.55], [2.88, 1.3], [3.02, 1.12]] }
];
const BOULDERS = [
  [-4.7, 2.75, 0.44], [-1.35, 3.05, 0.40], [4.95, 0.35, 0.38],
  [0.95, -0.6, 0.33], [-4.3, -0.15, 0.42], [3.6, -0.1, 0.36]
];
const BOULDER_FIN = 24;
const FOREST = [[-4.4, 2.2, 1.7], [-4.6, -0.4, 1.4], [0.6, -1.9, 1.2], [4.6, 0.3, 1.5], [-4.2, 3.2, 1.2]];

/* ---------- surface kinds ---------- */
const K_GRASS = 0, K_PATH = 1, K_SAND = 2, K_MUD = 3, K_ROCK = 4, K_LAKEBED = 5, K_RIVERBED = 6;

/* ---------- small distance helpers ---------- */
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l = dx * dx + dz * dz || 1e-6;
  let t = ((px - ax) * dx + (pz - az) * dz) / l;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}
function riverQuery(x, z) {
  let bd = 1e3, bt = 0;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const ax = RIVER[i][0], az = RIVER[i][1], bx = RIVER[i + 1][0], bz = RIVER[i + 1][1];
    const dx = bx - ax, dz = bz - az;
    const l = dx * dx + dz * dz || 1e-6;
    let s = ((x - ax) * dx + (z - az) * dz) / l;
    s = s < 0 ? 0 : s > 1 ? 1 : s;
    const qx = ax + dx * s - x, qz = az + dz * s - z;
    const d = Math.sqrt(qx * qx + qz * qz);
    if (d < bd) { bd = d; bt = RIVER_T[i] + (RIVER_T[i + 1] - RIVER_T[i]) * s; }
  }
  return { d: bd, t: bt };
}
function riverWidth(t) { return 0.2 + 0.36 * U.clamp01(t); }
function riverLevel(t) {
  const span = 1.06 - 0.14, steps = 7;
  const raw = U.clamp01(t) * steps;
  const q = Math.floor(raw), f = raw - q;
  return 1.06 - span * (q + U.smoothstep(0.62, 1.0, f)) / steps;
}
function poolDist(x, z) { return Math.hypot(x - POOL.x, z - POOL.z); }
function lakeD(x, z) {
  const ex = (x - LAKE.x) / LAKE.rx, ez = (z - LAKE.z) / LAKE.rz;
  const a = Math.atan2(ez, ex);
  const wob = 1 + 0.055 * Math.sin(a * 3 + 1.1) + 0.035 * Math.sin(a * 5 - 2.0)
    + (WG.noise2(Math.cos(a) * 2 + 4, Math.sin(a) * 2 - 1) - 0.5) * 0.1;
  return Math.hypot(ex, ez) / wob;
}
function pathQuery(x, z) {
  let bd = 99, bw = 0.2;
  for (let p = 0; p < PATHS.length; p++) {
    const pts = PATHS[p].pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < bd) { bd = d; bw = PATHS[p].w; }
    }
  }
  return { d: bd, w: bw };
}

/* ---------- height field ---------- */
function meadowBase(x, z) {
  let h = 0.6 + (WG.fbm2(x * 0.34 + 7.3, z * 0.34 - 2.1, 3) - 0.5) * 0.17;
  h += 0.12 * Math.exp(-(((x + 3.35) * (x + 3.35)) / 2.2 + ((z - 1.9) * (z - 1.9)) / 2.4));
  h += 0.095 * U.smoothstep(-4.2, -6, x);
  h += 0.03 * U.smoothstep(3.4, 5.6, x);
  const apron = U.smoothstep(0.5, -3.0, z);
  h += apron * 0.92 + apron * (WG.fbm2(x * 0.5, z * 0.5, 3) - 0.5) * 0.3;
  h += 0.5 * Math.exp(-(((x + 1.5) * (x + 1.5)) / 5.2)) * U.smoothstep(0.6, -1.15, z);
  return h;
}
const PEAK_BASE = PEAKS.map(p => Math.max(0.3, meadowBase(p[0], p[1])));
function heightField(x, z) {
  let h = meadowBase(x, z);

  /* mountains */
  let m = 0;
  for (let i = 0; i < PEAKS.length; i++) {
    const p = PEAKS[i];
    const a = p[4] * 0.37;
    const ca = Math.cos(a), sa = Math.sin(a);
    const dx = x - p[0], dz = z - p[1];
    const rx = (dx * ca + dz * sa) / (p[3] * 1.12);
    const rz = (-dx * sa + dz * ca) / (p[3] * 0.82);
    const r = Math.sqrt(rx * rx + rz * rz);
    if (r > 1.35) continue;
    if (r < 0.0001) { m = Math.max(m, p[2] - PEAK_BASE[i]); continue; }
    let cone = Math.pow(U.clamp01(1 - r / 1.2), 1.18);
    cone *= 0.9 + 0.18 * WG.ridged2(x * 1.7 + p[4], z * 1.7 - p[4], 3);
    m = Math.max(m, cone * (p[2] - PEAK_BASE[i]) * 1.1);
  }
  // broad massif linking the peaks to the back wall
  const massif = U.smoothstep(-1.1, -2.9, z) * (0.34 + 0.7 * WG.fbm2(x * 0.42 + 9, z * 0.42 - 2, 3));
  h += Math.max(m, massif) + 0.28 * U.smoothstep(-2.4, -3.4, z);
  const mf = U.smoothstep(0.12, 1.15, m);
  if (mf > 0.002) {
    const rg = WG.ridged2(x * 2.7 + 11, z * 2.7 - 3, 4);
    h += mf * (rg - 0.42) * 0.55;
    h -= mf * Math.pow(U.clamp01(1 - Math.abs(WG.noise2(x * 6.2 + 4, z * 6.2) * 2 - 1)), 5) * 0.34;
    h -= mf * Math.pow(U.clamp01(1 - Math.abs(WG.noise2(x * 4.4, z * 4.4) * 2 - 1)), 3) * 0.26;
    const band = 0.185;
    const tilt = x * 0.11 + z * 0.04;
    const qv = (h + tilt) / band;
    const ledged = (Math.floor(qv) + U.smoothstep(0.56, 1.0, qv - Math.floor(qv))) * band - tilt;
    h = U.lerp(h, ledged, 0.5 * mf);
  }

  /* cliff shelf at the waterfall */
  const sxn = (x - LIP.x) / 0.95, szn = (z + 1.9) / 0.55;
  const shelf = Math.exp(-(sxn * sxn * sxn * sxn) - (szn * szn * szn * szn));
  h = U.lerp(h, 2.2 + (WG.noise2(x * 3.1, z * 3.1) - 0.5) * 0.06, U.smoothstep(0.42, 0.92, shelf));
  const spring = Math.exp(-(((x - LIP.x) * (x - LIP.x)) / 0.012)) * U.smoothstep(-1.35, -2.15, z);
  h -= spring * 0.07;

  /* pool bowl */
  const pd = poolDist(x, z);
  if (pd < 0.95) {
    const bed = 0.935 + (WG.noise2(x * 4, z * 4) - 0.5) * 0.03;
    h = Math.min(h, U.lerp(bed, h, U.smoothstep(0.4, 0.95, pd)));
  }

  /* river channel with terraces */
  const lk = lakeD(x, z);
  const rq = riverQuery(x, z);
  if (rq.d < 0.85 && lk > 0.62) {
    const half = riverWidth(rq.t) * 0.5;
    const lvl = riverLevel(rq.t);
    const bed = lvl - 0.15 + (WG.noise2(x * 9, z * 9) - 0.5) * 0.035;
    const bankTop = Math.max(h, lvl + 0.2);
    const outside = U.smoothstep(half + 0.45, half + 0.02, rq.d);
    const k = U.smoothstep(half + 0.16, half - 0.02, rq.d) * U.smoothstep(0.62, 0.95, lk);
    h = U.lerp(h, bankTop, outside * 0.85);
    h = U.lerp(h, bed, k);
  }

  /* lake basin */
  if (lk < 1.0) {
    const bed = U.lerp(-0.92, 0.34, U.smoothstep(0.33, 1.0, lk));
    h = Math.min(h, bed + (WG.noise2(x * 3.2, z * 3.2) - 0.5) * 0.045);
  } else if (lk < 1.42) {
    h = U.lerp(0.35, h, U.smoothstep(1.0, 1.42, lk));
  }

  /* footpaths */
  const pq = pathQuery(x, z);
  if (pq.d < pq.w + 0.2) h -= 0.022 * U.smoothstep(pq.w + 0.2, pq.w * 0.5, pq.d);

  if (h > 4.05) h = 4.05 + (h - 4.05) * 0.35;
  if (h < -0.94) h = -0.94;
  return h;
}

/* ---------- grid sampling ---------- */
let HG = null, KG = null, SLG = null, built = false;
function sgrid(x, z) {
  let gx = (x - X0) / DX, gz = (z - Z0) / DZ;
  if (gx < 0) gx = 0; else if (gx > NX - 1.001) gx = NX - 1.001;
  if (gz < 0) gz = 0; else if (gz > NZ - 1.001) gz = NZ - 1.001;
  const i = gx | 0, j = gz | 0;
  return { i, j, u: gx - i, v: gz - j };
}
function heightAt(x, z) {
  if (!HG) return heightField(x, z);
  const g = sgrid(x, z), i = g.i, j = g.j, u = g.u, v = g.v;
  const i0 = j * NX + i;
  const h00 = HG[i0], h10 = HG[i0 + 1], h01 = HG[i0 + NX], h11 = HG[i0 + NX + 1];
  if (u >= v) return h00 + u * (h10 - h00) + v * (h11 - h10);
  return h00 + v * (h01 - h00) + u * (h11 - h01);
}
function slopeAt(x, z) {
  const d = 0.11;
  const sx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d);
  const sz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d);
  return U.clamp01(Math.sqrt(sx * sx + sz * sz) / 1.55);
}
function normalAt(x, z, out) {
  const d = 0.07;
  const sx = (heightAt(x + d, z) - heightAt(x - d, z)) / (2 * d);
  const sz = (heightAt(x, z + d) - heightAt(x, z - d)) / (2 * d);
  return (out || WG.tmp.v1).set(-sx, 1, -sz).normalize();
}

/* ---------- uniforms (declared before API uses them) ---------- */
const TD = {
  uWet: { value: 0.12 }, uSnow: { value: 0 }, uFrost: { value: 0 }, uSnowline: { value: 9 },
  uTime: { value: 0 }, uRain: { value: 0 }, uWaterY: { value: 0.1 }, uStorm: { value: 0 },
  uSeason: { value: 0 }, uNoise: { value: TEX.noise },
  uGrassCol: { value: WG.col('#8aa16f') }
};
const WD = {
  uWet: { value: 0.12 }, uSnow: { value: 0 }, uFrost: { value: 0 }, uNoise: { value: TEX.noise },
  uTime: { value: 0 }
};
const RM = {
  uWet: { value: 0.12 }, uSnow: { value: 0 }, uFrost: { value: 0 }, uNoise: { value: TEX.noise },
  uSeason: { value: 0 }, uMoss: { value: WG.col('#3f5227') }, uLichen: { value: WG.col('#9aa38b') }
};
const PM = {
  uWet: { value: 0 }, uSnow: { value: 0 }, uRain: { value: 0 }, uTime: { value: 0 },
  uNoise: { value: TEX.noise }, uSky: { value: WG.col('#a9c6da') }
};
let puddleMesh = null;

/* ---------- public API ---------- */
const API = WG.terrain = {
  ready: false,
  lake: LAKE,
  pool: POOL,
  cliffLip: new THREE.Vector3(LIP.x, LIP.y, LIP.z),
  bottom: BOTTOM,
  heightAt, slopeAt, normalAt,
  inLake(x, z) { return lakeD(x, z) < 1; },
  inRiver(x, z) {
    if (lakeD(x, z) < 0.98) return false;
    const q = riverQuery(x, z);
    return q.d < riverWidth(q.t) * 0.5 + 0.04;
  },
  inPool(x, z) { return poolDist(x, z) < POOL.r; },
  surfaceAt(x, z) {
    if (lakeD(x, z) < 1) return 'lake';
    if (this.inRiver(x, z) || poolDist(x, z) < POOL.r) return 'river';
    if (lakeD(x, z) < 1.2) return 'sand';
    const q = riverQuery(x, z);
    if (q.d < riverWidth(q.t) * 0.5 + 0.24) return 'soil';
    if (pathQuery(x, z).d < 0.19) return 'path';
    const h = heightAt(x, z);
    if (h > 2.32 || slopeAt(x, z) > 0.62) return 'rock';
    return 'grass';
  },
  depthAt(x, z) {
    const h = heightAt(x, z);
    if (lakeD(x, z) < 1) return Math.max(0, WG.state.waterY - h);
    if (poolDist(x, z) < POOL.r) return Math.max(0, POOL.surfaceY - h);
    if (this.inRiver(x, z)) return Math.max(0, riverLevel(riverQuery(x, z).t) - h);
    return 0;
  },
  nearShore(x, z) {
    const d = lakeD(x, z);
    return U.clamp01(1 - Math.abs(d - 1) / 0.55);
  },
  setWeather(wet, snow, frost, waterY) {
    if (!built) return;
    TD.uWet.value = U.clamp01(wet || 0);
    TD.uSnow.value = U.clamp01(snow || 0);
    TD.uFrost.value = U.clamp01(frost || 0);
    TD.uWaterY.value = waterY == null ? 0.1 : waterY;
    WD.uWet.value = TD.uWet.value; WD.uSnow.value = TD.uSnow.value; WD.uFrost.value = TD.uFrost.value;
    RM.uWet.value = TD.uWet.value; RM.uSnow.value = TD.uSnow.value; RM.uFrost.value = TD.uFrost.value;
    PM.uWet.value = TD.uWet.value; PM.uSnow.value = TD.uSnow.value;
    if (puddleMesh) puddleMesh.visible = TD.uWet.value > 0.02 && TD.uSnow.value < 0.86;
  },
  groundPoint(x, z, out) {
    const o = out || WG.tmp.v2;
    const n = normalAt(x, z, WG.tmp.v3);
    o.set(x, heightAt(x, z) + n.y * 0.024, z);
    return o;
  },
  river: {
    points: RIVER,
    levelAt(x, z) { return riverLevel(riverQuery(x, z).t); },
    widthAt(x, z) { return riverWidth(riverQuery(x, z).t); },
    tAt(x, z) { return riverQuery(x, z).t; },
    levelOf: riverLevel
  },
  build() { if (!built) initBuild(); },
  lakeD, riverQuery, pathQuery
};

/* ---------- palettes ---------- */
const C = {
  grassA: WG.col('#54703e'), grassB: WG.col('#8aa16f'), grassC: WG.col('#ad9f73'),
  path: WG.col('#93866c'), pathPale: WG.col('#b9aa8d'), sand: WG.col('#d8c7a5'),
  sandWet: WG.col('#a8977a'), mud: WG.col('#453529'), mudLight: WG.col('#5b4838'),
  rockA: WG.col('#77756f'), rockB: WG.col('#a19c93'), rust: WG.col('#8b7059'),
  lakeSand: WG.col('#e2d5b6'), lakeClay: WG.col('#9c988e'), bed: WG.col('#6d6960'),
  turf: WG.col('#5e7443')
};

const scratch = new THREE.Color();
function albedo(x, z, h, kind, slope, out) {
  const n1 = WG.fbm2(x * 1.45 + 3.1, z * 1.45 - 7.2, 3);
  const n2 = WG.noise2(x * 7.5 + 2, z * 7.5 - 5);
  const n3 = WG.noise2(x * 21, z * 21);
  switch (kind) {
    case K_GRASS: {
      out.copy(C.grassA).lerp(C.grassB, n1);
      out.lerp(C.grassC, U.clamp01((n2 - 0.56) * 1.4) * 0.5);
      out.multiplyScalar(0.9 + n3 * 0.24);
      // soften edges into sand, mud and paths
      const lkg = lakeD(x, z);
      if (lkg < 1.32) out.lerp(C.sand, U.smoothstep(1.31, 1.2, lkg) * 0.8);
      const rqg = riverQuery(x, z);
      if (rqg.d < 0.7) out.lerp(C.mud, U.smoothstep(0.66, 0.3, rqg.d) * 0.8);
      const pqg = pathQuery(x, z);
      if (pqg.d < pqg.w + 0.18) out.lerp(C.path, U.smoothstep(pqg.w + 0.18, pqg.w * 0.55, pqg.d) * 0.9);
      break;
    }
    case K_PATH: {
      const pq = pathQuery(x, z);
      const pale = U.clamp01(1 - pq.d / (pq.w * 0.9));
      out.copy(C.path).lerp(C.pathPale, pale * 0.7 + n2 * 0.3);
      out.lerp(C.grassA, U.smoothstep(pq.w * 1.15, pq.w * 1.7, pq.d) * 0.5);
      out.multiplyScalar(0.92 + n3 * 0.18);
      break;
    }
    case K_SAND: {
      const d = lakeD(x, z);
      out.copy(C.sand).lerp(C.sandWet, U.smoothstep(1.3, 1.0, d) * 0.72);
      out.lerp(C.mudLight, U.clamp01(n2 - 0.5) * 0.4);
      out.lerp(C.grassA, U.smoothstep(1.19, 1.3, d) * 0.6);
      const rip = Math.sin(d * 52 + n1 * 5.5 + n2 * 2.0) * 0.5 + 0.5;
      out.multiplyScalar(0.88 + rip * 0.17);
      out.multiplyScalar(0.95 + n3 * 0.1);
      break;
    }
    case K_MUD:
      out.copy(C.mud).lerp(C.mudLight, n1 * 0.6);
      out.lerp(C.grassA, U.smoothstep(0.42, 0.72, riverQuery(x, z).d) * 0.4);
      break;
    case K_ROCK: {
      out.copy(C.rockA).lerp(C.rockB, n1);
      if (n2 > 0.68) out.lerp(C.rust, (n2 - 0.68) * 1.2);
      out.multiplyScalar(0.86 + n3 * 0.24);
      break;
    }
    case K_LAKEBED: {
      const deep = U.smoothstep(0.18, 0.85, 1 - lakeD(x, z));
      out.copy(C.lakeSand).lerp(C.lakeClay, deep);
      out.multiplyScalar(0.9 + n2 * 0.18);
      break;
    }
    default:
      out.copy(C.bed).lerp(C.rockA, n1);
      out.multiplyScalar(0.86 + n3 * 0.25);
  }
  out.lerp(C.turf, slope * 0.12);
  out.multiplyScalar(1 - slope * 0.16);
  return out;
}
/* ---------- materials ---------- */
function bindUniforms(sh, src) {
  for (const k in src) sh.uniforms[k] = src[k];
}

function makeTopMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0, envMapIntensity: 0.32, emissive: WG.col('#20261a'), emissiveIntensity: 0.85 });
  m.onBeforeCompile = function (sh) {
    bindUniforms(sh, {
      tNoise: TD.uNoise, uWet: TD.uWet, uSnow: TD.uSnow, uFrost: TD.uFrost,
      uSnowline: TD.uSnowline, uTime: TD.uTime, uRain: TD.uRain, uWaterY: TD.uWaterY,
      uStorm: TD.uStorm, uSeason: TD.uSeason, uGrassCol: TD.uGrassCol
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aGrass; attribute float aRock;
        uniform float uSnow; uniform sampler2D tNoise;
        varying float vGrass; varying float vRock; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGrass = aGrass; vRock = aRock;
        vWN = normalize(mat3(modelMatrix) * objectNormal);
        vWP = (modelMatrix * vec4(position, 1.0)).xyz;
        if (uSnow > 0.001) {
          float sn = uSnow * (0.012 + 0.03 * aGrass) * (0.55 + 0.8 * texture2D(tNoise, position.xz * 1.35).r);
          transformed += objectNormal * sn;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tNoise;
        uniform float uWet, uSnow, uFrost, uSnowline, uTime, uRain, uWaterY, uStorm, uSeason;
        uniform vec3 uGrassCol;
        varying float vGrass; varying float vRock; varying vec3 vWP; varying vec3 vWN;
        float tNoiseAt(vec2 uv) { return texture2D(tNoise, uv).r; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float up = clamp(vWN.y, 0.0, 1.0);
        float slope = 1.0 - up;
        float n1 = texture2D(tNoise, vWP.xz * 0.29).r;
        float n2 = texture2D(tNoise, vWP.xz * 1.63 + 12.0).r;
        float n3 = texture2D(tNoise, vWP.xy * 0.42 + vWP.z * 0.07).r;
        float rockMask = clamp(vRock * 0.85 + smoothstep(2.15, 2.75, vWP.y) * 0.9, 0.0, 1.0);
        if (rockMask > 0.001) {
          float warp = (n1 - 0.5) * 0.55 + (n3 - 0.5) * 0.25;
          float sy = (vWP.y + vWP.x * 0.11 + vWP.z * 0.04) * 6.6 + warp * 1.4;
          float band = fract(sy);
          float gully = smoothstep(0.66, 0.86, texture2D(tNoise, vec2(vWP.x * 2.6 + vWP.z * 2.1, vWP.y * 0.2)).r);
          float bandShade = smoothstep(0.04, 0.46, band) * (0.42 + 0.58 * n2) * (1.0 - gully * 0.45);
          vec3 rockC = mix(vec3(0.255, 0.255, 0.25), vec3(0.58, 0.565, 0.535), bandShade);
          rockC *= 1.0 - smoothstep(0.0, 0.05, 1.0 - band) * 0.55;
          rockC *= 1.0 - gully * 0.28;
          float rusty = smoothstep(0.8, 0.95, fract(sy * 0.21 + 0.3)) * smoothstep(0.4, 0.7, n2);
          rockC = mix(rockC, vec3(0.42, 0.3, 0.21), rusty * 0.45);
          float cr = smoothstep(0.86, 0.97, texture2D(tNoise, vec2(vWP.x * 1.15 + vWP.z * 0.95, vWP.y * 0.5)).r);
          rockC *= 1.0 - cr * 0.35;
          rockC *= mix(0.5, 1.0, smoothstep(0.05, 0.9, up));
          diffuseColor.rgb = mix(diffuseColor.rgb, rockC, rockMask);
          float lich = smoothstep(0.58, 0.86, n1) * smoothstep(0.55, 0.92, up) * smoothstep(1.9, 3.3, vWP.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.43, 0.34), lich * 0.5);
        }
        float moss = (1.0 - smoothstep(0.5, 1.7, vWP.y)) * smoothstep(0.4, 0.85, up) * smoothstep(0.42, 0.72, n2);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.21, 0.08), moss * 0.4);
        float gm = vGrass * smoothstep(2.75, 1.95, vWP.y + (n1 - 0.5) * 1.1) * smoothstep(0.25, 0.55, n2 + 0.35) * (1.0 - smoothstep(0.42, 0.75, slope));
        vec3 gcol = uGrassCol * (0.75 + 0.5 * n2) * (0.9 + 0.2 * uSeason);
        gcol = mix(gcol, vec3(0.45, 0.5, 0.34), 0.1);
        diffuseColor.rgb = mix(diffuseColor.rgb, gcol, gm * 0.9);
        float wetA = uWet * (0.5 + 0.5 * n1);
        diffuseColor.rgb *= mix(1.0, 0.55, wetA);
        diffuseColor.rgb *= 0.82 + 0.36 * n2 * (0.7 + 0.6 * n3);
        float frostA = uFrost * (0.35 + 0.4 * n2) * smoothstep(0.15, 0.8, up) * (1.0 - uSnow);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.6, 0.65, 0.7), frostA);
        float snowMask = smoothstep(0.22, 0.6, up) * smoothstep(uSnowline + 0.8, uSnowline - 0.8, vWP.y);
        float snowA = clamp(uSnow * (0.5 + 0.65 * n2) * snowMask, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.87, 0.92), snowA);
        diffuseColor.rgb *= mix(1.0, 0.82, uStorm);
      }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      {
        vec2 nuv = vWP.xz * 3.1;
        float h0 = texture2D(tNoise, nuv).r;
        float hx = texture2D(tNoise, nuv + vec2(0.02, 0.0)).r;
        float hz = texture2D(tNoise, nuv + vec2(0.0, 0.02)).r;
        float rockMask2 = clamp(vRock + smoothstep(2.15, 2.75, vWP.y), 0.0, 1.0);
        normal = normalize(normal + vec3(hx - h0, 0.0, hz - h0) * (0.75 + rockMask2 * 2.8));
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      {
        float wetR = uWet * smoothstep(0.2, 0.65, 1.0 - vWN.y * 0.4);
        roughnessFactor = mix(roughnessFactor, 0.1, wetR);
        roughnessFactor = mix(roughnessFactor, 0.82, clamp(uSnow, 0.0, 1.0) * smoothstep(0.2, 0.6, vWN.y));
      }`);
  };
  m.customProgramCacheKey = () => 'wg-terrain-top';
  return m;
}

function makeWallMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, emissive: WG.col('#2a1d13'), emissiveIntensity: 0.8 });
  m.onBeforeCompile = function (sh) {
    bindUniforms(sh, { tNoise: WD.uNoise, uWet: WD.uWet, uSnow: WD.uSnow, uFrost: WD.uFrost, uTime: WD.uTime });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aTopY; attribute float aSeed; attribute float aWater;
        varying float vTopY; varying float vSeed; varying float vWater; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vTopY = aTopY; vSeed = aSeed; vWater = aWater;
        vWP = (modelMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * normal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tNoise; uniform float uWet, uSnow, uFrost, uTime;
        varying float vTopY; varying float vSeed; varying float vWater; varying vec3 vWP; varying vec3 vWN;
        float hsh(vec2 p) { return texture2D(tNoise, p).r; }
        float fbm3(vec2 p) { return hsh(p) * 0.6 + hsh(p * 2.13 + 4.7) * 0.3 + hsh(p * 4.7 - 9.1) * 0.1; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float depth = vTopY - vWP.y;
        float hcoord = vWP.x * 1.7 + vWP.z * 1.3 + vSeed * 31.0;
        float mountain = smoothstep(0.5, 2.0, vTopY);
        float wob = (fbm3(vec2(hcoord * 1.15, 3.1 + vSeed * 9.0)) - 0.5) * 0.5;
        float fine = (hsh(vec2(hcoord * 9.0, vWP.y * 0.55)) - 0.5) * 0.2;
        float d = depth + wob * 0.16 + fine;
        float humusTop = 0.2 + wob * 0.12;
        float loamTop = 0.95 + wob * 0.34;
        float clayTop = 1.24 + wob * 0.2;
        float gravelTop = 1.42;
        float rockTop = 1.64;

        // loam
        vec3 col = vec3(0.19, 0.125, 0.085);
        float mot = smoothstep(0.44, 0.7, fbm3(vec2(hcoord * 2.1, vWP.y * 2.4)));
        col = mix(col, vec3(0.45, 0.27, 0.15), mot * 0.55);
        col = mix(col, vec3(0.3, 0.2, 0.13), smoothstep(0.5, 0.8, fbm3(vec2(hcoord * 0.7 + 5.0, vWP.y * 0.9))) * 0.5);
        float dark = smoothstep(0.55, 0.8, fbm3(vec2(hcoord * 3.4 + 7.0, vWP.y * 3.1)));
        col *= 1.0 - dark * 0.45;
        // burrows
        vec2 bcell = floor(vec2(hcoord * 5.4, vWP.y * 5.4));
        float bh = hsh(bcell * 0.13 + vSeed * 3.0);
        float bd = length(fract(vec2(hcoord * 5.4, vWP.y * 5.4)) - 0.5);
        float burrow = smoothstep(0.2, 0.46, bd) * step(bh, 0.3);
        col *= 1.0 - burrow * 0.8;
        col = mix(col, vec3(0.62, 0.55, 0.45), smoothstep(0.17, 0.1, bd) * step(bh, 0.3) * 0.5);
        // embedded stones
        vec2 scell = floor(vec2(hcoord * 2.4 + 3.0, vWP.y * 2.4));
        float sh2 = hsh(scell * 0.19 + vSeed * 7.0);
        float sd = length(fract(vec2(hcoord * 2.4 + 3.0, vWP.y * 2.4)) - 0.5);
        float stone = smoothstep(0.3, 0.17, sd) * step(0.72, sh2);
        col = mix(col, mix(vec3(0.55, 0.53, 0.49), vec3(0.35, 0.34, 0.31), hsh(scell * 0.31)), stone);
        col *= 1.0 - smoothstep(0.19, 0.3, sd) * step(0.72, sh2) * 0.28;
        // humus and hanging roots
        if (d < humusTop) col = mix(vec3(0.135, 0.098, 0.07), vec3(0.06, 0.043, 0.03), smoothstep(0.0, max(humusTop, 0.05), d));
        float rootZone = smoothstep(0.012, 0.045, d) * smoothstep(loamTop + 0.18, humusTop - 0.03, d);
        float rn1 = hsh(vec2(hcoord * 3.1 + 9.0, vWP.y * 0.13 + vSeed));
        float rn2 = hsh(vec2(hcoord * 8.4 - 3.0, vWP.y * 0.42));
        float rn3 = hsh(vec2(hcoord * 18.0 + 2.0, vWP.y * 0.8));
        float roots = smoothstep(0.54, 0.66, rn1) + smoothstep(0.68, 0.76, rn2) * 0.9 + smoothstep(0.74, 0.82, rn3) * 0.7;
        col = mix(col, vec3(0.62, 0.56, 0.44), clamp(roots, 0.0, 1.0) * rootZone * 0.75);
        // turf edge
        if (d < 0.05 + wob * 0.03) col = mix(vec3(0.14, 0.21, 0.08), vec3(0.34, 0.44, 0.19), smoothstep(0.0, 0.05, d));
        // orange clay with fine bedding lines
        if (d > clayTop) {
          col = mix(vec3(0.52, 0.28, 0.13), vec3(0.67, 0.38, 0.18), fbm3(vec2(hcoord * 2.0, vWP.y * 6.0)));
          col *= 0.92 + 0.16 * sin(vWP.y * 90.0 + hcoord * 3.0);
          col *= 0.9 + 0.2 * hsh(vec2(hcoord * 13.0, vWP.y * 5.0));
        }
        // gravel and cobbles in dark grit
        if (d > gravelTop) {
          col = vec3(0.115, 0.11, 0.1);
          vec2 gcell = floor(vec2(hcoord * 7.5, vWP.y * 8.5));
          float gh = hsh(gcell * 0.21 + vSeed * 11.0);
          float gd = length(fract(vec2(hcoord * 7.5, vWP.y * 8.5)) - 0.5);
          float cob = smoothstep(0.36, 0.13, gd) * step(0.35, gh);
          col = mix(col, mix(vec3(0.6, 0.585, 0.55), vec3(0.3, 0.29, 0.27), hsh(gcell * 0.37)), cob);
          col *= 0.85 + 0.3 * hsh(vec2(hcoord * 20.0, vWP.y * 20.0));
        }
        // bedrock: tilted sandstone beds with joints
        if (d > rockTop) {
          float tilt = mountain * 0.55 + (vSeed - 0.5) * 0.3;
          float bedY = vWP.y * 7.5 + hcoord * tilt * 2.2 + wob * 2.2;
          float bedF = fract(bedY);
          col = mix(vec3(0.3, 0.275, 0.235), vec3(0.56, 0.52, 0.45), smoothstep(0.08, 0.55, bedF));
          col *= 1.0 - smoothstep(0.0, 0.05, 1.0 - bedF) * 0.4;
          float joint = smoothstep(0.42, 0.5, abs(fract(hcoord * (0.5 + tilt) * 2.2 + vSeed * 5.0) - 0.5) + 0.45);
          col *= 1.0 - joint * 0.65;
          col *= 0.7 + 0.55 * fbm3(vec2(hcoord * 3.5, vWP.y * 8.0));
        }
        // under the lake: pale sand and grey clay, then back to gravel
        if (vWater > 0.5) {
          vec3 sandC = mix(vec3(0.56, 0.49, 0.37), vec3(0.68, 0.61, 0.47), fbm3(vec2(hcoord * 3.0, vWP.y * 3.0)));
          vec3 clayC = mix(vec3(0.52, 0.52, 0.49), vec3(0.4, 0.4, 0.38), fbm3(vec2(hcoord * 2.2, vWP.y * 5.0)));
          float band = smoothstep(0.34, 0.5, fract(vWP.y * 4.6 + wob * 1.5));
          vec3 wc = mix(sandC, clayC, max(band, smoothstep(0.2, 0.72, d)));
          col = mix(col, wc, 0.95 * smoothstep(1.55, 1.3, d));
          col *= 0.88 + 0.2 * hsh(vec2(hcoord * 9.0, vWP.y * 4.0));
        }
        // weathering, wet soak, base darkening, frost, snow cap
        col *= 0.84 + 0.32 * hsh(vec2(hcoord * 5.0, vWP.y * 5.0));
        float soak = uWet * smoothstep(0.85, -0.05, depth) * (0.42 + 0.58 * hsh(vec2(hcoord * 2.6, vWP.y * 1.2)));
        col *= mix(1.0, 0.56, soak);
        col *= mix(0.36, 1.0, smoothstep(-1.8, 0.7, vWP.y));
        col = mix(col, vec3(0.6, 0.65, 0.7), uFrost * smoothstep(0.3, 0.02, depth) * 0.55);
        float cap = uSnow * smoothstep(0.08, 0.0, d) * 1.8;
        col = mix(col, vec3(0.84, 0.88, 0.93), clamp(cap, 0.0, 1.0));
        col *= 1.28;
        diffuseColor.rgb = col;
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.3, uWet * smoothstep(0.9, 0.0, vTopY - vWP.y) * 0.7);
        roughnessFactor = mix(roughnessFactor, 0.9, uSnow * smoothstep(0.08, 0.0, vTopY - vWP.y));`);
  };
  m.customProgramCacheKey = () => 'wg-terrain-wall';
  return m;
}

function makeRockMat() {
  const m = new THREE.MeshStandardMaterial({ color: WG.col('#b0aca2'), vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, envMapIntensity: 0.8, emissive: WG.col('#211f19'), emissiveIntensity: 0.8 });
  m.onBeforeCompile = function (sh) {
    bindUniforms(sh, {
      tNoise: RM.uNoise, uWet: RM.uWet, uSnow: RM.uSnow, uFrost: RM.uFrost,
      uSeason: RM.uSeason, uMoss: RM.uMoss, uLichen: RM.uLichen
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying float vSink; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSink = smoothstep(0.32, -0.22, position.y);
        vWP = (modelMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tNoise; uniform float uWet, uSnow, uFrost, uSeason; uniform vec3 uMoss, uLichen;
        varying float vSink; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float up = clamp(vWN.y, 0.0, 1.0);
        float n1 = texture2D(tNoise, vWP.xz * 2.2).r;
        float n2 = texture2D(tNoise, vWP.xy * 1.4 + vWP.z * 0.3).r;
        float sink = vSink;
        diffuseColor.rgb *= 0.88 + 0.28 * n2;
        float moss = smoothstep(0.35, 0.8, sink) * smoothstep(0.25, 0.75, up) * (0.55 + 0.45 * n1);
        diffuseColor.rgb = mix(diffuseColor.rgb, uMoss * (0.7 + 0.5 * n2), moss * 0.6);
        float lich = smoothstep(0.62, 0.9, n1) * smoothstep(0.5, 0.9, up) * (1.0 - sink * 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, uLichen * (0.85 + 0.3 * n2), lich * 0.5);
        float streaks = texture2D(tNoise, vec2(vWP.x * 3.4 + vWP.z * 2.9, vWP.y * 0.7)).r;
        diffuseColor.rgb *= 0.88 + 0.22 * streaks;
        float wetA = uWet * (0.6 + 0.4 * n1);
        diffuseColor.rgb *= mix(1.0, 0.55, wetA);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.67, 0.72), uFrost * 0.3 * up);
        float snow = clamp(uSnow * smoothstep(0.4, 0.85, up) * (0.55 + 0.5 * n2), 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.89, 0.94), snow);
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.14, uWet * 0.8);
        roughnessFactor = mix(roughnessFactor, 0.85, uSnow);`);
  };
  m.customProgramCacheKey = () => 'wg-terrain-rock';
  return m;
}

function makePuddleMat() {
  const m = new THREE.MeshStandardMaterial({
    color: WG.col('#5c6f70'), roughness: 0.05, metalness: 0.14, transparent: true, depthWrite: false,
    envMapIntensity: 2.1, side: THREE.FrontSide
  });
  m.onBeforeCompile = function (sh) {
    bindUniforms(sh, { tNoise: PM.uNoise, uWet: PM.uWet, uSnow: PM.uSnow, uRain: PM.uRain, uTime: PM.uTime, uSky: PM.uSky });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aT; varying float vT; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vT = aT; vWP = (modelMatrix * vec4(position, 1.0)).xyz;
        vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tNoise; uniform float uWet, uSnow, uRain, uTime; uniform vec3 uSky;
        varying float vT; varying vec3 vWP; varying vec3 vWN;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wAlpha = smoothstep(vT, vT + 0.16, uWet) * (0.85 + 0.15 * texture2D(tNoise, vWP.xz*4.0).r) * (1.0 - smoothstep(0.35, 0.8, uSnow));
        diffuseColor.a *= wAlpha;
        float fres = pow(1.0 - clamp(dot(normalize(vWN), normalize(cameraPosition - vWP)), 0.0, 1.0), 2.2);
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.85 + 0.3 * texture2D(tNoise, vWP.xz * 3.0).r), uSky * 0.85, 0.22 + fres * 0.5);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      {
        vec2 p = vWP.xz;
        float r = uRain;
        float r1 = sin(length(p - vec2(1.7, 0.6)) * 34.0 - uTime * 7.0) * r;
        float r2 = sin(length(p - vec2(-2.3, 1.4)) * 29.0 - uTime * 8.0) * r;
        float r3 = sin(length(p - vec2(0.4, -1.2)) * 41.0 - uTime * 6.0) * r;
        vec2 g = vec2(r1 + r2 * 0.7 + r3 * 0.5, r2 - r1 * 0.6) * 0.045;
        g += (vec2(texture2D(tNoise, p * 3.0 + uTime * 0.05).r,
                   texture2D(tNoise, p * 3.0 - uTime * 0.04).r) - 0.5) * 0.28;
        normal = normalize(normal + vec3(g.x, 0.0, g.y));
      }`);
  };
  m.customProgramCacheKey = () => 'wg-terrain-puddle';
  return m;
}

/* ---------- classify + build ---------- */
function classify(x, z, h, slope) {
  const lk = lakeD(x, z);
  if (lk < 1) return K_LAKEBED;
  if (lk < 1.2) return K_SAND;
  const rq = riverQuery(x, z);
  const half = riverWidth(rq.t) * 0.5;
  if (poolDist(x, z) < POOL.r || rq.d < half + 0.03) return K_RIVERBED;
  if (rq.d < half + 0.26) return K_MUD;
  if (pathQuery(x, z).d < 0.17) return K_PATH;
  if (h > 2.32 || slope > 0.5) return K_ROCK;
  return K_GRASS;
}
function grassAmt(k) {
  if (k === K_GRASS) return 1;
  if (k === K_MUD) return 0.45;
  if (k === K_SAND) return 0.12;
  if (k === K_RIVERBED) return 0.03;
  return 0;
}

function buildTop(landMat) {
  const n = NX * NZ;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const gra = new Float32Array(n);
  const rockA = new Float32Array(n);
  const kindArr = new Uint8Array(n);
  const slopeArr = new Float32Array(n);
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const idx = j * NX + i;
      const x = X0 + i * DX, z = Z0 + j * DZ, h = HG[idx];
      pos[idx * 3] = x; pos[idx * 3 + 1] = h; pos[idx * 3 + 2] = z;
      const hl = HG[j * NX + Math.max(0, i - 1)], hr = HG[j * NX + Math.min(NX - 1, i + 1)];
      const hu = HG[Math.max(0, j - 1) * NX + i], hd = HG[Math.min(NZ - 1, j + 1) * NX + i];
      let nx = -(hr - hl) / (2 * DX), ny = 1, nz = -(hd - hu) / (2 * DZ);
      const il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= il; ny *= il; nz *= il;
      nor[idx * 3] = nx; nor[idx * 3 + 1] = ny; nor[idx * 3 + 2] = nz;
      const slope = U.clamp01(Math.sqrt(((hr - hl) / (2 * DX)) ** 2 + ((hd - hu) / (2 * DZ)) ** 2) / 1.55);
      slopeArr[idx] = slope;
      const kind = classify(x, z, h, slope);
      kindArr[idx] = kind;
      albedo(x, z, h, kind, slope, scratch);
      col[idx * 3] = scratch.r; col[idx * 3 + 1] = scratch.g; col[idx * 3 + 2] = scratch.b;
      gra[idx] = grassAmt(kind);
      rockA[idx] = kind === K_ROCK ? 1 : 0;
    }
  }
  KG = kindArr; SLG = slopeArr;
  const index = new Uint32Array((NX - 1) * (NZ - 1) * 6);
  let o = 0;
  for (let j = 0; j < NZ - 1; j++) {
    for (let i = 0; i < NX - 1; i++) {
      const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
      index[o++] = a; index[o++] = d; index[o++] = b;
      index[o++] = a; index[o++] = c; index[o++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aGrass', new THREE.BufferAttribute(gra, 1));
  geo.setAttribute('aRock', new THREE.BufferAttribute(rockA, 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, landMat);
  mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.name = 'terrain-surface';
  WG.groups.land.add(mesh);
  return mesh;
}

function buildWalls(wallMat) {
  const edges = [
    { ax: 'x', fixed: Z1, cols: NX, flip: false, n: [0, 0, 1] },
    { ax: 'x', fixed: Z0, cols: NX, flip: true, n: [0, 0, -1] },
    { ax: 'z', fixed: X1, cols: NZ, flip: true, n: [1, 0, 0] },
    { ax: 'z', fixed: X0, cols: NZ, flip: false, n: [-1, 0, 0] }
  ];
  for (const e of edges) {
    const cols = e.cols, rows = WALL_ROWS;
    const vc = cols * (rows + 1);
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3);
    const aTop = new Float32Array(vc), aSeed = new Float32Array(vc), aWater = new Float32Array(vc);
    const seeds = new Float32Array(cols);
    for (let c = 0; c < cols; c++) seeds[c] = R();
    for (let c = 0; c < cols; c++) {
      const t = c / (cols - 1);
      const x = e.ax === 'x' ? U.lerp(X0, X1, t) : e.fixed;
      const z = e.ax === 'x' ? e.fixed : U.lerp(Z0, Z1, t);
      const i = e.ax === 'x' ? c : (e.fixed === X1 ? NX - 1 : 0);
      const j = e.ax === 'x' ? (e.fixed === Z1 ? NZ - 1 : 0) : c;
      const topY = HG[j * NX + i];
      const water = lakeD(x, z) < 1.14 ? 1 : 0;
      for (let r = 0; r <= rows; r++) {
        const v = r / rows;
        const vv = 1 - Math.pow(1 - v, 2.4);
        const y = BOTTOM + (topY - BOTTOM) * vv;
        const k = c * (rows + 1) + r;
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
        nor[k * 3] = e.n[0]; nor[k * 3 + 1] = e.n[1]; nor[k * 3 + 2] = e.n[2];
        aTop[k] = topY; aSeed[k] = seeds[c]; aWater[k] = water;
      }
    }
    const idx = new Uint16Array((cols - 1) * rows * 6);
    let o = 0;
    for (let c = 0; c < cols - 1; c++) {
      for (let r = 0; r < rows; r++) {
        const a = c * (rows + 1) + r, b = (c + 1) * (rows + 1) + r;
        const cT = a + 1, dT = b + 1;
        if (e.flip) {
          idx[o++] = a; idx[o++] = cT; idx[o++] = b;
          idx[o++] = b; idx[o++] = cT; idx[o++] = dT;
        } else {
          idx[o++] = a; idx[o++] = b; idx[o++] = cT;
          idx[o++] = b; idx[o++] = dT; idx[o++] = cT;
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('aTopY', new THREE.BufferAttribute(aTop, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    geo.setAttribute('aWater', new THREE.BufferAttribute(aWater, 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, wallMat);
    m.receiveShadow = true;
    m.name = 'terrain-wall';
    WG.groups.land.add(m);
  }
}

function buildBottom(bottomMat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    X0, BOTTOM, Z0, X1, BOTTOM, Z0, X1, BOTTOM, Z1, X0, BOTTOM, Z1
  ], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const m = new THREE.Mesh(g, bottomMat);
  m.receiveShadow = true;
  m.name = 'terrain-bottom';
  WG.groups.land.add(m);
}

/* ---------- rocks ---------- */
function rockGeometry(detail, seed, chisel) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const rr = WG.rng('rock' + seed);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    const rad = 0.86 + rr() * 0.26;
    x = x / l * rad; y = y / l * rad; z = z / l * rad;
    if (chisel > 0) {
      if (rr() < 0.22) { x = Math.max(x, -chisel); z = Math.max(z, -chisel); }
      y *= 0.86;
      if (y < 0) y *= 0.78;
    }
    p.setXYZ(i, x, y, z);
  }
  const colArr = new Float32Array(p.count * 3);
  const cr = WG.rng('rockcol' + seed);
  for (let i = 0; i < p.count; i++) {
    const v = 0.7 + cr() * 0.3;
    colArr[i * 3] = v; colArr[i * 3 + 1] = v * 0.97; colArr[i * 3 + 2] = v * 0.9;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  g.computeVertexNormals();
  return g;
}

function buildRocks(rockMat) {
  const geos = [];
  for (let i = 0; i < 5; i++) geos.push(rockGeometry(0, 100 + i, 0.15));
  const bigGeos = [];
  for (let i = 0; i < 6; i++) bigGeos.push(rockGeometry(2, 200 + i, 0.25));

  /* six boulders, partly sunk, with a few pebbles beside each */
  for (let i = 0; i < BOULDERS.length; i++) {
    const [bx, bz, br] = BOULDERS[i];
    const g = bigGeos[i];
    const mesh = new THREE.Mesh(g, rockMat);
    const h = heightAt(bx, bz);
    const s = br * 1.3;
    mesh.scale.set(s * (0.9 + R() * 0.3), s * (1.1 + R() * 0.3), s * (0.85 + R() * 0.25));
    mesh.position.set(bx, h - s * 0.34, bz);
    mesh.rotation.set((R() - 0.5) * 0.4, R() * TAU, (R() - 0.5) * 0.4);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = 'boulder';
    WG.groups.land.add(mesh);
  }

  const total = [112, 150, 188][QL];
  let remaining = Math.max(0, total - BOULDERS.length - BOULDERS.length * 4);
  const buckets = [
    { n: Math.round(remaining * 0.38), kind: 'shore' },
    { n: Math.round(remaining * 0.27), kind: 'bank' },
    { n: Math.round(remaining * 0.17), kind: 'cliff' },
    { n: Math.round(remaining * 0.13), kind: 'slope' },
    { n: 0, kind: 'meadow' }
  ];
  buckets[4].n = remaining - buckets[0].n - buckets[1].n - buckets[2].n - buckets[3].n;

  /* boulder companions */
  for (let i = 0; i < BOULDERS.length; i++) {
    const [bx, bz, br] = BOULDERS[i];
    for (let k = 0; k < 4; k++) {
      const a = R() * TAU, r = br * (1.05 + R() * 0.9);
      placePebble(bx + Math.cos(a) * r, bz + Math.sin(a) * r, 0.5 + R() * 0.7, geos);
    }
  }
  for (const b of buckets) {
    for (let i = 0; i < b.n; i++) {
      for (let tries = 0; tries < 12; tries++) {
        let x = 0, z = 0, ok = false;
        if (b.kind === 'shore') {
          const a = R() * TAU, d = 0.99 + R() * 0.14;
          x = LAKE.x + Math.cos(a) * LAKE.rx * d; z = LAKE.z + Math.sin(a) * LAKE.rz * d;
          ok = lakeD(x, z) > 0.97;
        } else if (b.kind === 'bank') {
          const t = R();
          const i2 = Math.min(RIVER.length - 2, (t * (RIVER.length - 1)) | 0);
          const s = t * (RIVER.length - 1) - i2;
          const cx = U.lerp(RIVER[i2][0], RIVER[i2 + 1][0], s), cz = U.lerp(RIVER[i2][1], RIVER[i2 + 1][1], s);
          const a = R() * TAU, r = riverWidth(t) * 0.5 + 0.06 + R() * 0.18;
          x = cx + Math.cos(a) * r; z = cz + Math.sin(a) * r;
          ok = lakeD(x, z) > 1.02;
        } else if (b.kind === 'cliff') {
          const a = R() * TAU, r = POOL.r * (0.95 + R() * 0.95);
          x = POOL.x + Math.cos(a) * r * 1.2; z = POOL.z + Math.sin(a) * r;
          ok = lakeD(x, z) > 1.4;
        } else if (b.kind === 'slope') {
          x = X0 + 0.3 + R() * 11.4; z = Z0 + 0.3 + R() * 3.6;
          const h = heightAt(x, z);
          ok = h > 1.05 && h < 3.1 && lakeD(x, z) > 1.3;
        } else {
          x = X0 + 0.4 + R() * 11.2; z = Z0 + 0.4 + R() * 7.2;
          ok = pathQuery(x, z).d > 0.2 && lakeD(x, z) > 1.45;
        }
        if (ok && x > X0 + 0.15 && x < X1 - 0.15 && z > Z0 + 0.15 && z < Z1 - 0.15) {
          placePebble(x, z, 0.4 + R() * 0.8, geos);
          break;
        }
      }
    }
  }

  /* stepping stones across the river ~40% down */
  const stepT = 0.4;
  const si = Math.min(RIVER.length - 2, (stepT * (RIVER.length - 1)) | 0);
  const ss = stepT * (RIVER.length - 1) - si;
  const scx = U.lerp(RIVER[si][0], RIVER[si + 1][0], ss), scz = U.lerp(RIVER[si][1], RIVER[si + 1][1], ss);
  const nStones = 5;
  const lvl = riverLevel(stepT);
  const dirx = RIVER[si + 1][0] - RIVER[si][0], dirz = RIVER[si + 1][1] - RIVER[si][1];
  const dl = Math.hypot(dirx, dirz) || 1;
  const perpx = -dirz / dl, perpz = dirx / dl;
  for (let i = 0; i < nStones; i++) {
    const f = (i / (nStones - 1) - 0.5) * 2;
    const px = scx + perpx * f * 0.19, pz = scz + perpz * f * 0.19;
    const g = rockGeometry(1, 400 + i, 0.2);
    const mesh = new THREE.Mesh(g, rockMat);
    const s = 0.15 + R() * 0.05;
    mesh.scale.set(s * 1.5, s * 0.55, s);
    mesh.position.set(px, lvl + 0.03 + R() * 0.02, pz);
    mesh.rotation.y = R() * TAU;
    mesh.receiveShadow = true; mesh.castShadow = true;
    mesh.name = 'stepping-stone';
    WG.groups.land.add(mesh);
  }
}

const pebbleMeshes = [];
let pebSlot = 0;
function placePebble(x, z, scale, geos) {
  if (!pebbleMeshes.length) return;
  let target = pebbleMeshes[pebSlot++ % pebbleMeshes.length];
  const g = geos[(R() * geos.length) | 0];
  const m = new THREE.Matrix4();
  const h = heightAt(x, z);
  const s = 0.024 + scale * 0.045;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.7, R() * TAU, (R() - 0.5) * 0.7));
  m.compose(new THREE.Vector3(x, h - s * 0.34, z), q, new THREE.Vector3(s * (1 + R() * 0.35), s * 0.9, s));
  // push into a shared per-mesh matrix list
  if (!target.userData.matrices) target.userData.matrices = [];
  if (target.userData.matrices.length < target.userData.cap) target.userData.matrices.push(m);
}

function initPebbleMeshes(rockMat, geos) {
  const per = Math.ceil([112, 150, 188][QL] / 3 + 4);
  for (let i = 0; i < 3; i++) {
    const im = new THREE.InstancedMesh(geos[i], rockMat, per);
    im.castShadow = true; im.receiveShadow = true;
    im.frustumCulled = false;
    im.userData.cap = per; im.userData.matrices = [];
    im.name = 'pebbles';
    WG.groups.land.add(im);
    pebbleMeshes.push(im);
  }
}

/* ---------- puddles ---------- */
function buildPuddles(puddleMat) {
  const cand = [];
  for (let gz = -3.2; gz < 3.62; gz += 0.3) {
    for (let gx = -5.6; gx < 5.6; gx += 0.3) {
      const x = gx + (R() - 0.5) * 0.16, z = gz + (R() - 0.5) * 0.16;
      if (lakeD(x, z) < 1.5) continue;
      const rq = riverQuery(x, z);
      const half = riverWidth(rq.t) * 0.5;
      if (rq.d < half + 0.32) continue;
      if (pathQuery(x, z).d < 0.26) continue;
      const h = heightAt(x, z);
      if (h < 0.38 || h > 0.9) continue;
      if (slopeAt(x, z) > 0.1) continue;
      let lowest = h, rimSum = 0;
      for (let a = 0; a < 12; a++) {
        const na = a / 12 * TAU;
        const rh = heightAt(x + Math.cos(na) * 0.38, z + Math.sin(na) * 0.38);
        rimSum += rh;
        if (rh < lowest) lowest = rh;
      }
      if (lowest < h - 0.014) continue;
      if (rimSum / 12 < h + 0.007) continue;
      let close = false;
      for (const c of cand) if (Math.hypot(c[0] - x, c[1] - z) < 0.8) { close = true; break; }
      if (close) continue;
      cand.push([x, z, h]);
      if (cand.length >= 12) break;
    }
    if (cand.length >= 12) break;
  }

  const rings = [];
  for (const [x, z, h] of cand) {
    const rad = 0.18 + R() * 0.26;
    rings.push({ x, z, y: h + 0.014, rad, t: 0.24 + R() * 0.36 });
  }
  if (!rings.length) { WG.warn('terrain', 'no puddle hollows'); return; }
  const SEG = 18;
  const vc = rings.length * (SEG + 2);
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), aT = new Float32Array(vc);
  const idx = [];
  let v = 0;
  for (const ring of rings) {
    const ci = v;
    pos[v * 3] = ring.x; pos[v * 3 + 1] = ring.y; pos[v * 3 + 2] = ring.z;
    nor[v * 3 + 1] = 1; aT[v] = ring.t; v++;
    const start = v;
    for (let s = 0; s <= SEG; s++) {
      const a = s / SEG * TAU;
      const rr = ring.rad * (0.72 + 0.36 * WG.noise2(Math.cos(a) * 2.2 + ring.x, Math.sin(a) * 2.2 + ring.z));
      pos[v * 3] = ring.x + Math.cos(a) * rr;
      pos[v * 3 + 1] = ring.y;
      pos[v * 3 + 2] = ring.z + Math.sin(a) * rr * 0.82;
      nor[v * 3 + 1] = 1; aT[v] = ring.t + 0.1; v++;
    }
    for (let s = 0; s < SEG; s++) idx.push(ci, start + s + 1, start + s);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  puddleMesh = new THREE.Mesh(geo, puddleMat);
  puddleMesh.receiveShadow = true;
  puddleMesh.renderOrder = 2;
  puddleMesh.frustumCulled = false;
  puddleMesh.visible = false;
  puddleMesh.name = 'puddles';
  WG.groups.land.add(puddleMesh);
}

/* ---------- init ---------- */
let topMat = null, wallMat = null, rockMat = null, puddleMat = null;
function initBuild() {
  try {
    HG = new Float32Array(NX * NZ);
    for (let j = 0; j < NZ; j++) {
      const z = Z0 + j * DZ;
      for (let i = 0; i < NX; i++) {
        const x = X0 + i * DX;
        HG[j * NX + i] = heightField(x, z);
      }
    }
    topMat = makeTopMat();
    wallMat = makeWallMat();
    rockMat = makeRockMat();
    puddleMat = makePuddleMat();
    buildTop(topMat);
    buildWalls(wallMat);
    buildBottom(new THREE.MeshStandardMaterial({ color: WG.col('#2c2118'), roughness: 0.96, metalness: 0 }));
    const geos = [];
    for (let i = 0; i < 5; i++) geos.push(rockGeometry(0, 500 + i, 0.1));
    initPebbleMeshes(rockMat, geos);
    buildRocks(rockMat);
    for (const im of pebbleMeshes) {
      const mats = im.userData.matrices;
      for (let i = 0; i < im.userData.cap; i++) {
        im.setMatrixAt(i, mats[i] || (i === 0 ? new THREE.Matrix4() : (mats[0] || new THREE.Matrix4())));
      }
      im.instanceMatrix.needsUpdate = true;
    }
    buildPuddles(puddleMat);
    built = true;
    API.ready = true;
    if (WG.env && WG.env.tex) {
      for (const m of [topMat, rockMat, puddleMat]) { m.envMap = WG.env.tex; m.needsUpdate = true; }
    }
  } catch (e) {
    WG.warn('terrain', e);
    API.ready = true;
  }
}

const gcol = new THREE.Color();
const SEASON_GRASS = [WG.col('#8aa16f'), WG.col('#5f7a45'), WG.col('#9c8550'), WG.col('#b7a985')];
let roadedEnv = false;

function update(dt, t) {
  if (!built) return;
  const st = WG.state;
  TD.uTime.value = t; WD.uTime.value = t; PM.uTime.value = t;
  RM.uSeason.value = st.season;
  PM.uRain.value = st.rain;
  PM.uSky.value.copy(WG.cols.nightSky).lerp(scratch.set('#c3d9e6'), 0.25 + 0.75 * st.daylight);
  API.setWeather(st.wet, st.snow, st.frost, st.waterY);
  TD.uSnowline.value = st.snowline == null ? 9 : st.snowline;
  TD.uRain.value = st.rain;
  TD.uStorm.value = st.storm;
  const s = ((st.season % 4) + 4) % 4;
  const i0 = s | 0, i1 = (i0 + 1) % 4, f = s - i0;
  gcol.copy(SEASON_GRASS[i0]).lerp(SEASON_GRASS[i1], f);
  gcol.multiplyScalar(0.7 + 0.3 * st.daylight);
  gcol.lerp(WG.cols.grassShade, st.storm * 0.35);
  TD.uGrassCol.value.copy(gcol);
  if (!roadedEnv && WG.env && WG.env.tex) {
    roadedEnv = true;
    for (const m of [topMat, rockMat, puddleMat]) if (m) { m.envMap = WG.env.tex; m.needsUpdate = true; }
  }
}

/* ---------- register ---------- */
WG.register('terrain', {
  order: 20,
  init() { initBuild(); },
  update(dt, t) {
    if (!API.ready) return;
    try { update(dt, t); } catch (e) { WG.warn('terrain:update', e); }
  },
  dispose() {
    if (puddleMesh) puddleMesh.geometry.dispose();
    for (const m of [topMat, wallMat, rockMat, puddleMat]) if (m) m.dispose();
  }
});
})();
