/* ===== 08_flora.js — trees, bushes, meadow grass, wildflowers, reeds, lilies, leaf fall ===== */
/* Owner: flora. WG.flora API per contract §7. */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const R = WG.rng('flora');
const TAU = U.TAU;
const QL = WG.quality.level;
const GROOT = WG.groups.flora;

let T = WG.terrain || null;
const terrainOK = !!(T && T.heightAt && T.surfaceAt);

/* ---------- bounded helpers ---------- */
function GY(x, z) {
  if (terrainOK) { try { return T.heightAt(x, z); } catch (e) {} }
  return 0.56 + Math.sin(x * .7) * .02 + Math.cos(z * .6) * .02;
}
function surf(x, z) {
  if (terrainOK) { try { return T.surfaceAt(x, z); } catch (e) {} }
  return 'grass';
}
function slope(x, z) {
  if (terrainOK && T.slopeAt) { try { return T.slopeAt(x, z); } catch (e) {} }
  return 0;
}
function nearShore(x, z) {
  if (terrainOK && T.nearShore) { try { return T.nearShore(x, z); } catch (e) {} }
  return 0;
}
function inLake(x, z) {
  if (terrainOK && T.inLake) { try { return T.inLake(x, z); } catch (e) {} }
  const dx = (x - 2.75) / 2.35, dz = (z - 2.65) / 1.75;
  return dx * dx + dz * dz < 1;
}
function riverD(x, z) {
  if (terrainOK && T.riverQuery) { try { const q = T.riverQuery(x, z); return q.d - T.river.widthAt(x, z) * .5; } catch (e) {} }
  return 9;
}
function pathD(x, z) {
  if (terrainOK && T.pathQuery) { try { const q = T.pathQuery(x, z); return q.d - q.w; } catch (e) {} }
  return 9;
}
function boulderD(x, z) {
  let b = 9;
  for (let i = 0; i < BOUL.length; i++) {
    const d = Math.hypot(x - BOUL[i][0], z - BOUL[i][1]) - BOUL[i][2];
    if (d < b) b = d;
  }
  return b;
}
const BOUL = [[-4.7, 2.75, .44], [-1.35, 3.05, .40], [4.95, .35, .38], [.95, -.6, .33], [-4.3, -.15, .42], [3.6, -.1, .36]];
const CABIN = { x: -2.95, z: 1.35, r: .92 };
const JETTY = { x: .05, z: 2.9, r: .42 };

/* ---------- palette ---------- */
const PINK = WG.col('#f0d5da');
const SNOW = WG.col('#eef2f3');
const PALE_GRASS = WG.col('#cfd3a2');
const TIP_GREEN = WG.col('#8faa6b');
const BARK = {
  pine: WG.col('#4a3a2c'), oak: WG.col('#4a3b2c'), birch: WG.col('#d8d8cc'),
  birchDark: WG.col('#4a4a42'), cherry: WG.col('#4e2c27'), bush: WG.col('#463c2b')
};
const LEAF = {
  pine: [WG.col('#3f5f42'), WG.col('#54794f'), WG.col('#345339')],
  pineBlue: [WG.col('#45645c'), WG.col('#587a70'), WG.col('#39544d')],
  oak: [WG.col('#5d7d46'), WG.col('#6e9052'), WG.col('#82a35b')],
  birch: [WG.col('#8ea055'), WG.col('#a1b260'), WG.col('#b2c06c')],
  cherry: [WG.col('#71873f'), WG.col('#82984a'), WG.col('#66803b')],
  bush: [WG.col('#5a7844'), WG.col('#68874d'), WG.col('#769454')],
  bushEver: [WG.col('#3e5c41'), WG.col('#4b6c4c'), WG.col('#36553b')]
};
const AUT = {
  oak: [WG.col('#b5301c'), WG.col('#8a3d1f'), WG.col('#c8461a'), WG.col('#e07b1f')],
  birch: [WG.col('#e9a92b'), WG.col('#f0c24a'), WG.col('#e07b1f')],
  cherry: [WG.col('#b5301c'), WG.col('#c8461a'), WG.col('#8f2f34')]
};
const FLOWER_DEF = {
  daisy:       { n: 14, len: .19, wid: .05, col: '#f2eee2', tip: '#d9a6b0', cen: '#e9bf45', stem: '#587038', bloom: [.06, .5, 2.55, 2.95], h: 1.0 },
  buttercup:   { n: 6, len: .16, wid: .10, col: '#f2c528', tip: '#ffe680', cen: '#c9961a', stem: '#4f6c38', bloom: [.04, .4, 1.25, 1.65], h: .86 },
  violet:      { n: 5, len: .11, wid: .085, col: '#7d5a9e', tip: '#a98bc1', cen: '#e6d071', stem: '#4c6238', bloom: [.02, .3, 1.0, 1.45], h: .62 },
  poppy:       { n: 4, len: .26, wid: .18, col: '#c83422', tip: '#e2563a', cen: '#2a1a1c', stem: '#546b35', bloom: [.52, .95, 2.35, 2.75], h: 1.14 },
  cornflower:  { n: 12, len: .2, wid: .035, col: '#4c66b8', tip: '#8196d8', cen: '#2c3f74', stem: '#4f6638', bloom: [.9, 1.25, 2.6, 2.95], h: 1.1 },
  aster:       { n: 14, len: .17, wid: .03, col: '#a887b8', tip: '#c7a9d2', cen: '#e1bb4c', stem: '#4e6438', bloom: [1.05, 1.4, 2.85, 3.2], h: .95 }
};
const FLOWER_KEYS = ['daisy', 'buttercup', 'violet', 'poppy', 'cornflower', 'aster'];

/* ---------- global uniforms shared by all crops ---------- */
const G = {
  uTime: { value: 0 }, uWind: { value: .3 }, uWindDir: { value: new THREE.Vector2(.94, .34) },
  uSway: { value: 1 }, uSunDir: { value: new THREE.Vector3(-.45, .62, .65).normalize() },
  uDay: { value: 1 }, uSeason: { value: 0 }, uLeaves: { value: 1 }, uBlossom: { value: 0 },
  uSnow: { value: 0 }, uWet: { value: 0 }, uSpring: { value: 0 }, uAutumnW: { value: 0 },
  uGrassCol: { value: WG.col('#4f6b3a') }, uPaleGrass: { value: PALE_GRASS }, uSnowCol: { value: SNOW },
  uPink: { value: PINK }, uTipCol: { value: TIP_GREEN }
};

/* ---------- shader snippets ---------- */
const SWAY = `
  float ph = aSeed * 6.2831853;
  float flex = aFlex * aFlex;
  float lean = sin(uTime * 1.31 + ph) * .11 + sin(uTime * .43 + ph * 1.73) * .07;
  float gust = .5 + .5 * sin(uTime * .71 + ph * 2.1);
  vec2 sway = uWindDir * (lean + .05 * gust) * uWind * uSway * flex;
  transformed.xz += sway * .24;
  transformed.xz += vec2(sin(uTime * 6.7 + position.y * 31.0 + ph), cos(uTime * 5.9 + ph * 2.3)) * .009 * uWind * aFlex;
  transformed += vec3(sin(uTime * 10.3 + ph * 5.0 + position.z * 22.0), cos(uTime * 8.4 + ph * 3.0) * .55,
                     cos(uTime * 9.2 + ph * 4.0 + position.x * 19.0)) * .008 * aFlutter * uWind;
`;
const CROWN_PARS = `
  attribute float aFlex; attribute float aFlutter; attribute float aSeed;
  attribute float aOrder; attribute vec3 aCenter; attribute vec3 aAut; attribute float aShade; attribute float aTip;
  uniform float uTime, uWind, uSway, uLeaf, uBlossom, uKeep, uCherry, uAutumn, uSnow, uSpring;
  uniform vec2 uWindDir; uniform vec3 uPink; uniform vec3 uTipCol;
  varying vec3 vLeafCol; varying vec3 vAutCol; varying float vShade; varying float vBlossom; varying float vTip; varying vec3 vWN;
`;

function injectCrownBase(sh) {
  Object.assign(sh.uniforms, G);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + CROWN_PARS)
    .replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      float lf = max(max(uLeaf, uBlossom * uCherry), uKeep);
      float vis = smoothstep(aOrder - .07, aOrder + .10, lf);
      transformed = mix(aCenter, transformed, vis);
      vLeafCol = color;
      vAutCol = aAut;
      vShade = aShade;
      vBlossom = uBlossom * uCherry * (0.88 + 0.12 * aShade);
      vTip = aTip;
      ${SWAY}
      vWN = normalize(mat3(modelMatrix) * objectNormal);
      transformed += objectNormal * uSnow * 0.006 * clamp(vWN.y, 0.0, 1.0);
    `);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform float uAutumn, uSnow, uSpring; uniform vec3 uPink; uniform vec3 uTipCol; uniform vec3 uSnowCol;
      varying vec3 vLeafCol; varying vec3 vAutCol; varying float vShade; varying float vBlossom; varying float vTip; varying vec3 vWN;`)
    .replace('#include <color_fragment>', `
      vec3 fc = mix(vLeafCol, vAutCol, uAutumn);
      fc = mix(fc, uPink, clamp(vBlossom, 0.0, 1.0) * 1.05);
      fc = mix(fc, uTipCol, uSpring * vTip * .75);
      fc *= vShade;
      fc = mix(fc, uSnowCol, uSnow * clamp(vWN.y, 0.0, 1.0) * .7);
      diffuseColor.rgb = fc;
    `);
}
function makeDepth(mat) {
  const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  dm.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, G);
    sh.uniforms.uLeaf = mat.uniforms.uLeaf; sh.uniforms.uKeep = mat.uniforms.uKeep;
    sh.uniforms.uBlossom = G.uBlossom; sh.uniforms.uCherry = mat.uniforms.uCherry;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + CROWN_PARS + '\nattribute vec3 color;')
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float lf = max(max(uLeaf, uBlossom * uCherry), uKeep);
        float vis = smoothstep(aOrder - .07, aOrder + .10, lf);
        transformed = mix(aCenter, transformed, vis);
        ${SWAY}
      `);
  };
  return dm;
}

/* ---------- geometry builders ---------- */
function GB() { this.p = []; this.c = []; this.f = []; this.fl = []; this.s = []; this.o = []; this.cn = []; this.au = []; this.tp = []; this.sh = []; this.i = []; this.n = 0; }
GB.prototype.v = function (x, y, z, col, flex, flut, seed, cx, cy, cz, order, aut, tip, shade) {
  const n = this.n++;
  this.p.push(x, y, z); this.c.push(col.r, col.g, col.b);
  this.f.push(flex); this.fl.push(flut); this.s.push(seed);
  this.cn.push(cx, cy, cz); this.o.push(order);
  this.au.push(aut ? aut.r : col.r, aut ? aut.g : col.g, aut ? aut.b : col.b); this.tp.push(tip || 0);
  this.sh.push(shade == null ? 1 : shade);
  return n;
};
GB.prototype.t = function (a, b, c) { this.i.push(a, b, c); };
GB.prototype.geo = function () {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
  g.setAttribute('aFlex', new THREE.Float32BufferAttribute(this.f, 1));
  g.setAttribute('aFlutter', new THREE.Float32BufferAttribute(this.fl, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(this.s, 1));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(this.cn, 3));
  g.setAttribute('aOrder', new THREE.Float32BufferAttribute(this.o, 1));
  g.setAttribute('aAut', new THREE.Float32BufferAttribute(this.au, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(this.tp, 1));
  g.setAttribute('aShade', new THREE.Float32BufferAttribute(this.sh, 1));
  if (this.i.length) g.setIndex(this.i);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
};

const SUN0 = new THREE.Vector3(-.45, .62, .65).normalize();
const tmpC = new THREE.Color();
function shadeAt(dirX, dirY, dirZ, heightFrac, inner) {
  const d = dirX * SUN0.x + dirY * SUN0.y + dirZ * SUN0.z;
  let s = .52 + .62 * U.clamp01(d * .5 + .5);
  s *= .66 + .36 * U.clamp01(heightFrac);
  s *= 1 - inner * .2;
  return s;
}

function addBlob(b, cx, cy, cz, r, seed, colA, colB, order, h, baseFlex) {
  const rings = 5, segs = 9;
  const s0 = R() * TAU;
  const start = b.n;
  for (let ry = 0; ry <= rings; ry++) {
    const v = ry / rings, lat = (v - .5) * Math.PI;
    const cyy = Math.sin(lat), rad = Math.cos(lat);
    for (let sx = 0; sx <= segs; sx++) {
      const lon = (sx / segs) * TAU + s0;
      const wob = .74 + .44 * WG.noise3(Math.cos(lon) * 2.1 + seed, Math.sin(lon) * 2.1 - seed, v * 3.3);
      const rr = r * rad * wob;
      const px = cx + Math.cos(lon) * rr, py = cy + cyy * r * .82, pz = cz + Math.sin(lon) * rr;
      const inner = U.clamp01(1 - Math.hypot(px - cx, pz - cz) / (r * 1.1)) * .8;
      const sh = shadeAt(Math.cos(lon) * rad, cyy, Math.sin(lon) * rad, 1 - v * .45 + (cy - cy) , inner);
      const col = colA.clone().lerp(colB, R() * .48 + Math.abs(cyy) * .25);
      const fl = baseFlex + (py) * .05;
      b.v(px, py, pz, col, U.clamp(Math.pow(v, .7) * .6 + baseFlex, 0, 1.2), 1, R(), cx, cy, cz, order, colB, 0, sh);
    }
  }
  for (let ry = 0; ry < rings; ry++) for (let sx = 0; sx < segs; sx++) {
    const a = start + ry * (segs + 1) + sx, bb = a + 1, c = a + segs + 1, d = c + 1;
    b.t(a, c, bb); b.t(bb, c, d);
  }
}

function addLimb(b, x0, y0, z0, x1, y1, z1, r0, r1, col, flexBase, seed, segs) {
  segs = segs || 5;
  const ax = x1 - x0, ay = y1 - y0, az = z1 - z0;
  const len = Math.hypot(ax, ay, az) || .001;
  let nx = -az / len, ny = 0, nz = ax / len;
  if (Math.abs(ay / len) > .96) { nx = 1; nz = 0; }
  const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; nz /= nl;
  const bx = -nz, bz = nx;
  const start = b.n;
  for (let s = 0; s <= 1; s++) {
    const t = s, px = x0 + ax * t, py = y0 + ay * t, pz = z0 + az * t;
    const rr = U.lerp(r0, r1, t);
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * TAU;
      const co = Math.cos(a), si = Math.sin(a);
      const vx = px + (nx * co + bx * si) * rr, vy = py + ny * co * rr, vz = pz + (nz * co + bz * si) * rr;
      const c = col.clone().multiplyScalar(.8 + R() * .35);
      b.v(vx, vy, vz, c, U.clamp(flexBase + t * .55, 0, 1.2), .12, R(), x1, y1, z1, .5, null, 0);
    }
  }
  for (let k = 0; k < segs; k++) b.t(start + k, start + segs + 1 + k, start + k + 1), b.t(start + k + 1, start + segs + 1 + k, start + segs + 2 + k);
  return start;
}

function addFrondTier(b, y, rOuter, rInner, drop, seed, colA, colB, h) {
  const segs = 11, start = b.n;
  for (let s = 0; s <= segs; s++) {
    const a = (s / segs) * TAU + seed;
    const wob = .76 + .36 * WG.noise2(Math.cos(a) * 2.4 + seed, Math.sin(a) * 2.4 - seed);
    const rr = rOuter * wob;
    const droop = drop * (.5 + .5 * Math.sin(a * 3 + seed));
    for (let ring = 0; ring <= 1; ring++) {
      const t = ring;
      const px = Math.cos(a) * U.lerp(rr, rInner, t);
      const pz = Math.sin(a) * U.lerp(rr, rInner, t);
      const py = y - droop * (1 - t) + t * .026;
      const sh = shadeAt(Math.cos(a) * .5, .55, Math.sin(a) * .5, 1 - y / h, 0) * 1.15;
      const c = colA.clone().lerp(colB, R() * .6);
      b.v(px, py, pz, c, y / h, .8, R(), 0, y, 0, U.clamp(y / h, 0, .9), colB, .8, sh);
    }
  }
  for (let s = 0; s < segs; s++) {
    const a = start + s * 2, bb = a + 1, c = a + 2, d = c + 1;
    b.t(a, bb, c); b.t(c, bb, d);
  }
}

/* ---------- crown materials ---------- */
function crownMat(type) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .84, metalness: 0, envMapIntensity: .36,
    side: THREE.DoubleSide
  });
  m.uniforms = {
    uLeaf: { value: 1 }, uKeep: { value: 0 }, uCherry: { value: type === 'cherry' ? 1 : 0 }, uAutumn: { value: 0 }
  };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.uniforms);
    injectCrownBase(sh);
  };
  m.customDepthMaterial = makeDepth(m);
  m.emissive = WG.col('#2a1f14'); m.emissiveIntensity = 0;
  return m;
}
function barkMat(type) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .91, metalness: 0, envMapIntensity: .22 });
  m.uniforms = { uLeaf: { value: 1 }, uKeep: { value: 1 }, uCherry: { value: 0 }, uAutumn: { value: 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, G, m.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aFlex; attribute float aFlutter; attribute float aSeed;
        uniform float uTime, uWind, uSway; uniform vec2 uWindDir;`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); ${SWAY}`);
  };
  return m;
}

/* ---------- tree registry / canopy ---------- */
const trees = [];
const bushes = [];
const deciduous = [];
const cherries = [];
const canopy = [];
const flowerPatches = [];
let hovered = null, lastHovered = null;
let leafFallT = 1.2, petalT = 2.4, puffT = 3.2;

/* ---------- placement rules ---------- */
function nearTree(x, z, d) {
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    if (Math.hypot(x - t.base.x, z - t.base.z) < d) return true;
  }
  return false;
}
function baseOK(x, z, kind, clearance) {
  if (x < -5.62 || x > 5.62 || z < -3.7 || z > 3.74) return false;
  if (inLake(x, z) || nearShore(x, z) > .72) return false;
  if (riverD(x, z) < .24) return false;
  if (pathD(x, z) < .21) return false;
  if (Math.hypot(x - CABIN.x, z - CABIN.z) < CABIN.r) return false;
  if (boulderD(x, z) < .13) return false;
  const s = surf(x, z);
  if (s === 'lake' || s === 'river' || s === 'sand' || s === 'path' || s === 'soil') return false;
  if (s === 'rock' && slope(x, z) > .82) return false;
  if (nearTree(x, z, clearance)) return false;
  return true;
}
function frontRight(x, z) { return x > .35 && z > .78; }

/* ===================================================================== */
/*  TREES                                                                */
/* ===================================================================== */
function buildTrunk(b, t) {
  const h = t.height, kind = t.type;
  const bark = BARK[kind] || BARK.oak;
  const r0 = (kind === 'pine' ? .035 : kind === 'birch' ? .021 : .04) * (h / .9);
  const forkY = kind === 'pine' ? h * .17 : kind === 'birch' ? h * .42 : h * .34;
  addLimb(b, 0, 0, 0, (R() - .5) * .04, forkY, (R() - .5) * .04, r0, r0 * .58, bark, 0, 1, 6);
  const branches = kind === 'pine' ? 3 : kind === 'birch' ? 5 : 6;
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * TAU + R();
    const yy = forkY + (i / branches) * h * (kind === 'birch' ? .4 : .3);
    const len = h * (kind === 'pine' ? .16 : kind === 'birch' ? .3 : .3) * (.7 + R() * .6);
    const cc = t.crownPts[(i % Math.max(1, t.crownPts.length))] || { x: 0, y: yy + .1, z: 0 };
    const ex = Math.cos(a) * len * .7 + (cc.x || 0) * .35;
    const ez = Math.sin(a) * len * .7 + (cc.z || 0) * .35;
    const ey = yy + len * .55 + (cc.y - yy) * .2;
    addLimb(b, 0, yy, 0, ex, ey, ez, r0 * .44, r0 * .14, bark, .25 + i * .05, i, 4);
  }
  if (kind === 'birch') {
    // birch marks: short dark nubs along the stem
    for (let i = 0; i < 9; i++) {
      const yy = h * (.12 + R() * .62), a = R() * TAU;
      addLimb(b, Math.cos(a) * .012, yy, Math.sin(a) * .012, Math.cos(a) * .032, yy + .006, Math.sin(a) * .032, .006, .002, BARK.birchDark, .1, i, 3);
    }
  }
  if (kind !== 'pine') {
    // winter twigs: always present, reach into every clump
    for (let i = 0; i < t.crownPts.length; i++) {
      const c = t.crownPts[i];
      const fy = forkY + R() * h * .12;
      addLimb(b, 0, fy, 0, c.x * .92, c.y, c.z * .92, .006, .0025, bark.clone().multiplyScalar(.8), .3, i + 9, 3);
    }
  }
}

function buildCrown(b, t) {
  const h = t.height, kind = t.type;
  t.crownPts = [];
  if (kind === 'pine') {
    const blue = t.blue;
    const pal = blue ? LEAF.pineBlue : LEAF.pine;
    const broad = t.broad ? 1.25 : .82;
    const tiers = 7 + Math.round(R() * 3);
    const top = h * .96, startY = h * .13;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const y = U.lerp(startY, top, Math.pow(f, .86));
      const r = h * U.lerp(.31, .018, f) * broad * (.8 + R() * .35);
      addFrondTier(b, y, r, r * .42, h * .055 * (1 - f * .4), R() * 4, pal[0], pal[1], h);
      t.crownPts.push({ x: 0, y, z: 0, r });
    }
    addLimb(b, 0, top - .03, 0, 0, top + .04, 0, .014, .002, pal[0].clone().multiplyScalar(.75), .9, 7, 4);
    t.crownY = h * .52; t.radius = h * .28 * broad;
  } else {
    const pal = LEAF[kind] || LEAF.oak;
    const aut = AUT[kind] || AUT.oak;
    const wide = kind === 'cherry' ? .5 : kind === 'birch' ? .28 : .5;
    const cy = h * (kind === 'birch' ? .74 : .68);
    t.crownY = cy; t.radius = h * wide * 1.15;
    const clumps = kind === 'birch' ? 10 : kind === 'cherry' ? 13 : 12;
    for (let i = 0; i < clumps; i++) {
      const a = (i / clumps) * TAU + R() * 1.1;
      const rad = h * wide * (i === 0 ? .12 : (i < 4 ? .3 + R() * .35 : .66 + R() * .55));
      const cx = Math.cos(a) * rad, cz = Math.sin(a) * rad;
      const cyy = cy + (R() - .32) * h * (kind === 'birch' ? .2 : .3);
      const rr = h * (kind === 'birch' ? .105 : kind === 'cherry' ? .135 : .15) * (.8 + R() * .5);
      t.crownPts.push({ x: cx, y: cyy, z: cz, r: rr });
      const order = U.clamp01((rad / (h * wide * 1.1)) * .62 + R() * .34);
      addBlob(b, cx, cyy, cz, rr, i * 7 + t.seed, pal[0], pal[1], order, h, .55);
      // autumn tint follows the same clump order so it browns outside-in
      const a0 = b.n - 60;
      for (let k = 0; k < 60; k++) {
        const ix = a0 + k;
        if (ix >= 0) b.au[ix * 3] = aut[i % aut.length].r, b.au[ix * 3 + 1] = aut[i % aut.length].g, b.au[ix * 3 + 2] = aut[i % aut.length].b;
      }
      // a second smaller inner clump for body
      if (i % 2 === 0) addBlob(b, cx * .5, cyy - rr * .25, cz * .5, rr * .8, i * 11 + 3, pal[2] || pal[0], pal[1], order * .5, h, .4);
    }
  }
}

function makeTree(type, x, z, height, opts) {
  opts = opts || {};
  const gy = GY(x, z);
  const t = {
    type, group: new THREE.Group(), base: new THREE.Vector3(x, gy, z), height,
    bend: 0, phase: R() * TAU, pull: new THREE.Vector2(), seed: Math.floor(R() * 1e6),
    blue: !!opts.blue, broad: !!opts.broad, keep: opts.keep || 0, alive: true,
    crownPts: [], crownY: height * .6, radius: height * .3
  };
  t.group.position.set(x, gy - .04, z);
  t.group.rotation.y = R() * TAU;
  t.group.userData.tree = t;
  const crownB = new GB(), trunkB = new GB();
  buildCrown(crownB, t);
  buildTrunk(trunkB, t);

  const cm = crownMat(type);
  const crown = new THREE.Mesh(crownB.geo(), cm);
  crown.castShadow = true; crown.receiveShadow = true;
  crown.userData.tree = t;
  t.group.add(crown);
  t.crownMesh = crown; t.crownMat = cm;

  const bm = barkMat(type);
  const trunk = new THREE.Mesh(trunkB.geo(), bm);
  trunk.castShadow = true; trunk.receiveShadow = true;
  trunk.userData.tree = t;
  t.group.add(trunk);
  t.trunk = trunk; t.barkMat = bm;

  t.crownCenter = new THREE.Vector3(x, gy + t.crownY + height * .06, z);
  trees.push(t);
  if (type !== 'pine') deciduous.push(t);
  if (type === 'cherry') cherries.push(t);
  canopy.push({ x, z, r: Math.max(.16, t.radius * .85) });
  GROOT.add(t.group);
  return t;
}

function placePines(n) {
  const clumps = [];
  let guard = 0;
  while (clumps.length < 7 && guard++ < 400) {
    const x = -5.5 + R() * 11, z = -3.55 + R() * 2.1;
    if (Math.hypot(x + 1.5, z + 1.44) < .7 || Math.hypot(x + 1.5, z + .9) < .62) continue;
    if (riverD(x, z) < .3) continue;
    if (Math.hypot(x - CABIN.x, z - CABIN.z) < .95) continue;
    if (GY(x, z) < .72) continue;
    if (slope(x, z) > .88) continue;
    clumps.push([x, z]);
  }
  for (let i = 0; i < n; i++) {
    let x = 0, z = 0, ok = false;
    for (let a = 0; a < 80 && !ok; a++) {
      if (clumps.length && R() < .72) {
        const c = clumps[(R() * clumps.length) | 0];
        x = c[0] + (R() - .5) * 1.5; z = c[1] + (R() - .5) * 1.15;
      } else { x = -5.5 + R() * 11; z = -3.55 + R() * 1.9; }
      ok = baseOK(x, z, 'pine', .48);
      if (ok) {
        const lim = Math.hypot(x + 1.5, z + 1.44);
        if (lim < .55) ok = false;
      }
    }
    if (!ok) { x = -5.4 + ((i * 1.71) % 10.4); z = -3.2 + ((i * .83) % 1.6); }
    const gy = GY(x, z);
    const h = U.clamp(1.2 - Math.max(0, gy - .85) * .17 + R() * .2, .46, 1.28);
    makeTree('pine', x, z, h, { blue: R() < .18, broad: R() < .46 });
  }
}

function placeBroadleaf(n) {
  const groves = [
    [-5.05, 2.95, .55, 2], [-4.45, 3.35, .4, 1], [-1.95, .12, .5, 2],
    [-1.5, -.32, .36, 1], [5.18, .95, .5, 2], [5.25, -.55, .45, 1],
    [.72, -.18, .34, 1], [1.16, .55, .3, 1], [-5.25, -.55, .5, 2]
  ];
  let placed = 0, guard = 0;
  while (placed < n && guard++ < 900) {
    const g = groves[(R() * groves.length) | 0];
    const a = R() * TAU, rr = Math.sqrt(R()) * g[2];
    const x = g[0] + Math.cos(a) * rr, z = g[1] + Math.sin(a) * rr * .8;
    if (frontRight(x, z)) continue;
    if (!baseOK(x, z, 'broad', .78)) continue;
    const typ = R() < .55 ? 'birch' : 'oak';
    const h = typ === 'birch' ? .85 + R() * .3 : .8 + R() * .28;
    const t = makeTree(typ, x, z, h, { keep: typ === 'oak' && R() < .35 ? .19 : 0 });
    t.grove = g;
    placed++;
  }
  // fallback fill along the allowed outer bands
  for (let i = 0; placed < n && i < n * 3; i++) {
    const x = i % 2 ? -5.35 + R() * 1.3 : 4.35 + R() * 1.1;
    const z = -1.1 + R() * 4.1;
    if (!baseOK(x, z, 'broad', .7)) continue;
    makeTree(R() < .5 ? 'birch' : 'oak', x, z, .8 + R() * .25, {});
    placed++;
  }
}

function buildTrees() {
  placePines(WG.quality.trees);
  const oaksAt = [
    [-4, .25, 1.3, 'oak'], [-4.95, 1.5, 1.18, 'birch'], [-3.75, 2.4, .8, 'cherry'], [3.3, .35, .74, 'cherry']
  ];
  for (let i = 0; i < oaksAt.length; i++) {
    const [x, z, h, typ] = oaksAt[i];
    const t = makeTree(typ, x, z, h, { keep: typ === 'oak' ? .22 : 0 });
    t.hero = true;
    if (typ === 'cherry') { t.blossomSrc = true; t.crownMat.uniforms.uKeep.value = 0; }
  }
  placeBroadleaf(Math.max(11, Math.round(WG.quality.trees * .67)));
  // bushes: edge of crowns, by boulders, near banks
  const nB = WG.quality.bushes;
  let b = 0, guard = 0;
  while (b < nB && guard++ < 1200) {
    let x = 0, z = 0, ok = false;
    const pick = R();
    if (pick < .42 && trees.length) {
      const t = trees[(R() * trees.length) | 0];
      if (t.type === 'pine' && R() < .5) continue;
      const a = R() * TAU, rr = t.radius * (1.15 + R() * .8);
      x = t.base.x + Math.cos(a) * rr; z = t.base.z + Math.sin(a) * rr;
    } else if (pick < .72) {
      const bl = BOUL[(R() * BOUL.length) | 0];
      const a = R() * TAU, rr = bl[2] + .1 + R() * .35;
      x = bl[0] + Math.cos(a) * rr; z = bl[1] + Math.sin(a) * rr;
    } else {
      x = -5.5 + R() * 11; z = -1 + R() * 4.4;
    }
    if (frontRight(x, z) && x > 1.2) continue;
    if (!baseOK(x, z, 'bush', .3)) continue;
    if (x > 1.9 && z > 1.5) continue;
    const t = makeBush(x, z, .11 + R() * .13, R() < .3);
    if (!t) continue;
    b++;
  }
  WG.emit('foliage', { trees: trees.length, bushes: bushes.length });
}

function makeBush(x, z, h, ever) {
  const gy = GY(x, z);
  const b = new GB();
  const pal = ever ? LEAF.bushEver : LEAF.bush;
  const clumps = 3 + ((R() * 2) | 0);
  for (let i = 0; i < clumps; i++) {
    const a = R() * TAU, rr = h * .32 * R();
    addBlob(b, Math.cos(a) * rr, h * (.28 + R() * .32), Math.sin(a) * rr, h * (.3 + R() * .28), i * 5 + 2, pal[0], pal[1], R() * .8, h, .2);
  }
  const m = crownMat(ever ? 'pine' : 'bush');
  m.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(b.geo(), m);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.position.set(x, gy, z);
  mesh.rotation.y = R() * TAU;
  GROOT.add(mesh);
  const obj = { mesh, mat: m, base: new THREE.Vector3(x, gy, z), height: h, radius: h * .65, phase: R() * TAU, decid: !ever };
  bushes.push(obj);
  canopy.push({ x, z, r: h * .55 });
  return obj;
}
/* ===================================================================== */
/*  MEADOW GRASS                                                         */
/* ===================================================================== */
const N_GRASS = WG.quality.grass;
let grassMesh = null;
const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .93, metalness: 0, envMapIntensity: .22, emissive: WG.col('#29402b'), emissiveIntensity: .45 });
grassMat.uniforms = {};
grassMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, G);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      attribute float aPhase; attribute float aTint; attribute float aLean;
      uniform float uTime, uWind, uSway, uSnow; uniform vec2 uWindDir;
      varying float vBend; varying float vTint;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      float hgt = clamp(position.y, 0.0, 1.0);
      vec3 ipos = (instanceMatrix * vec4(transformed, 1.0)).xyz;
      float ih = length(instanceMatrix[1].xyz);
      float wave = sin(dot(ipos.xz, vec2(2.3, -3.1)) * 1.9 - uTime * 2.35 + aPhase) * .5 + .5;
      float gust = sin(dot(ipos.xz, vec2(.7, .9)) * .8 - uTime * .7) * .5 + .5;
      float bend = uWind * (.18 + wave * .95) * pow(hgt, 1.45);
      vec2 lean = vec2(cos(aLean), sin(aLean)) * .28;
      vBend = bend * (.35 + gust * .8);
      vTint = aTint;
      transformed.y *= 1.0 - uSnow * .3;
    `)
    .replace('#include <project_vertex>', `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      float gh = length(instanceMatrix[1].xyz);
      mvPosition.xz += (uWindDir * bend * .62 + lean * .5) * gh;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform vec3 uGrassCol; uniform vec3 uPaleGrass; uniform vec3 uSnowCol; uniform float uSnow;
      varying float vBend; varying float vTint;`)
    .replace('#include <color_fragment>', `
      vec3 gc = uGrassCol * (1.38 + vTint * .6);
      gc = mix(gc, uPaleGrass, vTint * vTint * .3);
      gc = mix(gc, uPaleGrass, pow(clamp(vBend, 0.0, 1.4), 1.6) * .55);
      gc = mix(gc, uSnowCol, uSnow * .8);
      diffuseColor.rgb = gc;
    `);
};

function buildGrass() {
  const total = N_GRASS;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, 0, 1, .03], 3));
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, grassMat, total);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const phase = new Float32Array(total), tint = new Float32Array(total), lean = new Float32Array(total);
  const dm = new THREE.Object3D();
  let i = 0, guard = 0;
  const maxGuard = total * 3 + 4000;
  while (i < total && guard++ < maxGuard) {
    let x = 0, z = 0, ok = false;
    for (let a = 0; a < 14 && !ok; a++) {
      x = -5.72 + R() * 11.44; z = -3.3 + 7.15 * Math.pow(R(), .62);
      const s = surf(x, z);
      if (s !== 'grass' && s !== 'soil') continue;
      if (s === 'soil' && R() < .55) continue;
      if (inLake(x, z)) continue;
      if (riverD(x, z) < .07) continue;
      if (pathD(x, z) < .035) continue;
      if (Math.hypot(x - CABIN.x, z - CABIN.z) < .8) continue;
      if (Math.hypot(x - JETTY.x, z - JETTY.z) < .3) continue;
      let under = 0;
      for (let c = 0; c < canopy.length; c++) {
        const cc = canopy[c], d = Math.hypot(x - cc.x, z - cc.z);
        if (d < cc.r) under = Math.max(under, 1 - d / cc.r);
      }
      if (under > .08 && R() < .55 + under * .4) continue;
      if (boulderD(x, z) < .04) continue;
      ok = true;
    }
    if (!ok) continue;
    const shore = nearShore(x, z);
    const uphill = U.clamp01((GY(x, z) - .75) / 2.2);
    const blades = 12 + ((R() * 9) | 0);
    for (let b = 0; b < blades && i < total; b++, i++) {
      const aa = R() * TAU, rr = R() * .07;
      const bx = U.clamp(x + Math.cos(aa) * rr, -5.86, 5.86);
      const bz = U.clamp(z + Math.sin(aa) * rr, -3.9, 3.88);
      const gy = GY(bx, bz);
      const lush = 1 + shore * .65;
      const h = (0.095 + R() * 0.095) * S.grassH * lush * (1 - uphill * .34) * (.9 + R() * .25);
      const w = .024 + R() * .02;
      dm.position.set(bx, gy + .002, bz);
      dm.rotation.set((R() - .5) * .12, R() * TAU, (R() - .5) * .12);
      dm.scale.set(w, Math.max(.02, h), w);
      dm.updateMatrix();
      mesh.setMatrixAt(i, dm.matrix);
      phase[i] = R() * TAU; tint[i] = R(); lean[i] = R() * TAU;
    }
  }
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
  geo.setAttribute('aLean', new THREE.InstancedBufferAttribute(lean, 1));
  mesh.count = i;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  GROOT.add(mesh);
  grassMesh = mesh;
}

/* ===================================================================== */
/*  WILDFLOWERS                                                          */
/* ===================================================================== */
const flowerMeshes = [];
function flowerGeo(def) {
  const b = new GB();
  const col = WG.col(def.col), tip = WG.col(def.tip), cen = WG.col(def.cen), stem = WG.col(def.stem);
  const HEAD = .62;
  // stem: two crossed tapered blades
  for (let s = 0; s < 2; s++) {
    const ex = s ? .018 : 0, ez = s ? 0 : .018;
    const a = b.v(-ex, 0, -ez, stem.clone().multiplyScalar(.78), 0, .2, R(), 0, 0, 0, .5, null, 0);
    const c = b.v(ex, 0, ez, stem.clone().multiplyScalar(.78), 0, .2, R(), 0, 0, 0, .5, null, 0);
    const d = b.v((R() - .5) * .02, HEAD, (R() - .5) * .02, stem, 1, .3, R(), 0, HEAD, 0, 1, null, 0);
    b.t(a, c, d);
  }
  const petals = def.n;
  for (let p = 0; p < petals; p++) {
    const a = (p / petals) * TAU + R() * .2;
    const len = def.len * (.72 + R() * .46);
    const iw = def.wid * .5;
    const r0 = def.len * .18;
    const inx = Math.cos(a) * r0, inz = Math.sin(a) * r0;
    const o1x = Math.cos(a - .34) * len, o1z = Math.sin(a - .34) * len;
    const o2x = Math.cos(a + .34) * len, o2z = Math.sin(a + .34) * len;
    const y = HEAD + (R() - .35) * .006;
    const v0 = b.v(inx, y, inz, col, 1.05, .9, R(), 0, HEAD, 0, .9, null, 0);
    const v1 = b.v(o1x, y + .008, o1z, tip, 1.2, 1, R(), 0, HEAD, 0, 1, null, 0);
    const v2 = b.v(o2x, y + .008, o2z, tip, 1.2, 1, R(), 0, HEAD, 0, 1, null, 0);
    if (iw) b.v(0, 0, 0, col, 1, 1, R(), 0, HEAD, 0, 1, null, 0);
    b.t(v0, v1, v2);
    if (def.n <= 6) b.t(v2, v1, v0);
  }
  // centre
  const cs = def.len * .26, cy = HEAD + .006;
  const c0 = b.v(0, cy, 0, cen, 1.05, .6, R(), 0, HEAD, 0, 1, null, 0);
  for (let k = 0; k < 7; k++) {
    const a0 = (k / 7) * TAU, a1 = ((k + 1) / 7) * TAU;
    const v1 = b.v(Math.cos(a0) * cs, cy + .004, Math.sin(a0) * cs, cen, 1.05, .6, R(), 0, HEAD, 0, 1, null, 0);
    const v2 = b.v(Math.cos(a1) * cs, cy + .004, Math.sin(a1) * cs, cen, 1.05, .6, R(), 0, HEAD, 0, 1, null, 0);
    b.t(c0, v1, v2);
  }
  const g = b.geo();
  const n = b.n;
  const head = new Float32Array(n);
  for (let k = 0; k < n; k++) head[k] = b.p[k * 3 + 1] > HEAD - .02 ? 1 : 0;
  g.setAttribute('aHead', new THREE.BufferAttribute(head, 1));
  return g;
}

const flowerUniformsFor = () => ({ uBloom: { value: 0 }, uOpen: { value: 1 }, uClose: { value: 0 }, uFull: { value: 1 } });
function flowerMat(def) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .3, emissive: WG.col(def.col), emissiveIntensity: .08 });
  m.uniforms = flowerUniformsFor();
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, G, m.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aHead; attribute float aYaw; attribute float aPhase;
        uniform float uTime, uWind, uSway, uBloom, uOpen, uClose, uFull;
        uniform vec2 uWindDir; uniform vec3 uSunDir;
        varying float vHead;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hgt = clamp(position.y, 0.0, 1.0);
        vHead = aHead;
        transformed *= uBloom;
        float open = clamp(uOpen * uBloom, 0.0, 1.0);
        if (aHead > .5) {
          vec3 v = transformed - vec3(0.0, .62, 0.0);
          float cy = cos(aYaw), sy = sin(aYaw);
          vec3 sl = vec3(uSunDir.x * cy - uSunDir.z * sy, uSunDir.y, uSunDir.x * sy + uSunDir.z * cy);
          vec3 tgt = normalize(mix(vec3(0.0, 1.0, 0.0), sl, open * clamp(uSunDir.y * 3.0 + .55, 0.0, 1.0)));
          vec3 ax = cross(vec3(0.0, 1.0, 0.0), tgt);
          ax = length(ax) < 1e-4 ? vec3(1.0, 0.0, 0.0) : normalize(ax);
          float ang = acos(clamp(dot(vec3(0.0, 1.0, 0.0), tgt), -1.0, 1.0));
          float ca = cos(ang), sa = sin(ang);
          v = v * ca + cross(ax, v) * sa + ax * dot(ax, v) * (1.0 - ca);
          v.xz *= mix(1.0, .54, uClose);
          v.y += (1.0 - uClose) * .0 + uClose * .012;
          transformed = vec3(0.0, .62, 0.0) + v;
          transformed *= uFull;
        }
      `)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float fh = length(instanceMatrix[1].xyz);
        float wv = sin(uTime * 1.4 + aPhase) * .5 + .5;
        mvPosition.xz += uWindDir * (uWind * .55 * (0.25 + wv)) * fh * hgt * uSway;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSnowCol; uniform float uSnow; varying float vHead;`)
      .replace('#include <color_fragment>', `
        diffuseColor.rgb = vColor * (.86 + vHead * .16);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol, uSnow * .4);
      `);
  };
  return m;
}

function buildFlowerType(key, capacity) {
  const def = FLOWER_DEF[key];
  const geo = flowerGeo(def);
  const mat = flowerMat(def);
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  const yaw = new Float32Array(capacity), phase = new Float32Array(capacity);
  const dm = new THREE.Object3D();
  let i = 0;
  const patches = [];
  // choose drift centres on open grass, each patch a single species
  let guard = 0;
  while (patches.length < 6 && guard++ < 800) {
    const x = -5.5 + R() * 11, z = -2.3 + 6.1 * Math.pow(R(), .55);
    if (inLake(x, z)) continue;
    if (surf(x, z) !== 'grass') continue;
    if (riverD(x, z) < .2 || pathD(x, z) < .18) continue;
    if (Math.hypot(x - CABIN.x, z - CABIN.z) < .95) continue;
    if (Math.hypot(x - JETTY.x, z - JETTY.z) < .4) continue;
    let under = false;
    for (let c = 0; c < canopy.length; c++) if (Math.hypot(x - canopy[c].x, z - canopy[c].z) < canopy[c].r * .9) under = true;
    if (under && R() < .7) continue;
    patches.push({ x, z, r: .32 + R() * .72 });
    flowerPatches.push({ x, z, type: key, r: .32 });
  }
  guard = 0;
  const cap = capacity;
  while (i < cap && guard++ < cap * 8 + 500) {
    const p = patches.length ? patches[(R() * patches.length) | 0] : { x: -4.9 + R() * 9.8, z: -2 + R() * 5, r: .6 };
    const a = R() * TAU, rr = Math.sqrt(R()) * p.r;
    const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
    if (inLake(x, z) || surf(x, z) !== 'grass') continue;
    if (pathD(x, z) < .05 || riverD(x, z) < .12) continue;
    let under = 0;
    for (let c = 0; c < canopy.length; c++) {
      const cc = canopy[c], d = Math.hypot(x - cc.x, z - cc.z);
      if (d < cc.r * .85) under = Math.max(under, 1 - d / (cc.r * .85));
    }
    if (under > .1 && R() < .75) continue;
    const gy = GY(x, z);
    const s = (.082 + R() * .038) * def.h * (1 - under * .25);
    dm.position.set(x, gy + .002, z);
    dm.rotation.set((R() - .5) * .15, 0, (R() - .5) * .15);
    dm.scale.set(s, s, s);
    dm.updateMatrix();
    mesh.setMatrixAt(i, dm.matrix);
    yaw[i] = R() * TAU;
    phase[i] = R() * TAU;
    i++;
  }
  geo.setAttribute('aYaw', new THREE.InstancedBufferAttribute(yaw, 1));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  mesh.count = i;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mat.uniforms.uBloom.value = 0;
  GROOT.add(mesh);
  const rec = { key, mesh, mat, def, capacity: i };
  flowerMeshes.push(rec);
  return rec;
}

function buildFlowers() {
  let total = Math.min(9000, Math.round(WG.quality.flowers * 4));
  if (QL === 0) total = Math.min(total, 2200);
  const per = Math.max(140, Math.round(total / FLOWER_KEYS.length));
  for (let i = 0; i < FLOWER_KEYS.length; i++) buildFlowerType(FLOWER_KEYS[i], per);
}

/* ===================================================================== */
/*  REEDS & CATTAILS                                                     */
/* ===================================================================== */
const reedMeshes = [];
function reedGeo(cattail) {
  const b = new GB();
  const stem = WG.col('#5d7040'), leaf = WG.col('#6d7f48'), leaf2 = WG.col('#4c5f37');
  const H = 1;
  for (let s = 0; s < 2; s++) {
    const ex = s ? .022 : 0, ez = s ? 0 : .022;
    const a = b.v(-ex, 0, -ez, stem.clone().multiplyScalar(.72), 0, .3, R(), 0, 0, 0, .5, null, 0);
    const c = b.v(ex, 0, ez, stem.clone().multiplyScalar(.72), 0, .3, R(), 0, 0, 0, .5, null, 0);
    const d = b.v((R() - .5) * .02, H, (R() - .5) * .02, stem, 1, .8, R(), 0, H, 0, 1, null, 0);
    b.t(a, c, d);
  }
  for (let l = 0; l < 3; l++) {
    const y0 = .22 + l * .25, a = R() * TAU;
    const dx = Math.cos(a), dz = Math.sin(a);
    const v0 = b.v(0, y0, 0, leaf2, .3, .4, R(), 0, y0, 0, .5, null, 0);
    const v1 = b.v(dx * .13, y0 + .1, dz * .13, leaf, .6, 1, R(), 0, y0, 0, .7, null, 0);
    const v2 = b.v(dx * .05, y0 + .16, dz * .05, leaf, .7, 1, R(), 0, y0, 0, .7, null, 0);
    b.t(v0, v1, v2);
  }
  if (cattail) {
    // brown sausage head
    const cy = .8, rr = .026, hh = .15;
    const segs = 6;
    const start = b.n;
    for (let r = 0; r <= 2; r++) for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * TAU, yy = cy + (r / 2) * hh;
      const rad = r === 2 ? .004 : rr * (r === 0 ? .35 : 1);
      b.v(Math.cos(a) * rad, yy, Math.sin(a) * rad, WG.col(r === 1 ? '#6a4a2c' : '#7d5a33'), 1, .5, R(), 0, H, 0, 1, null, 1);
    }
    for (let r = 0; r < 2; r++) for (let k = 0; k < segs; k++) {
      const a = start + r * (segs + 1) + k;
      b.t(a, a + segs + 1, a + 1); b.t(a + 1, a + segs + 1, a + segs + 2);
    }
  }
  const g = b.geo();
  return g;
}

function reedMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .2 });
  m.uniforms = { uBleach: { value: 0 }, uDroop: { value: 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, G, m.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aBed; attribute float aPhase; attribute float aFlex; attribute float aSeed;
        uniform float uTime, uWind, uSway, uSnow, uDroop; uniform vec2 uWindDir;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float hgt = clamp(position.y, 0.0, 1.0);
        float bed = sin(uTime * 1.7 + aBed) * .5 + .5;
        float shiver = sin(uTime * 4.3 + aPhase) * .3;
        vBed = bed;
      `)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float rh = length(instanceMatrix[1].xyz);
        float sway = (bed * .8 + shiver * .25 + .2) * (uWind * .5 + uDroop * 1.1);
        mvPosition.xz += uWindDir * sway * rh * pow(hgt, 1.35);
        mvPosition.y -= rh * uDroop * .5 * pow(hgt, 2.0) + rh * uSnow * .12 * hgt;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uBleach, uSnow; uniform vec3 uSnowCol; varying float vBed;`)
      .replace('#include <color_fragment>', `
        vec3 rc = vColor;
        rc = mix(rc, vec3(.62, .55, .34), uBleach * (.55 + vBed * .3));
        rc = mix(rc, uSnowCol, uSnow * .55);
        rc *= .88 + vBed * .18;
        diffuseColor.rgb = rc;
      `);
  };
  // vBed declared in vertex but not varying; declare it there too
  const old = m.onBeforeCompile;
  m.onBeforeCompile = sh => {
    old(sh);
    sh.vertexShader = sh.vertexShader.replace('uniform vec2 uWindDir;', 'uniform vec2 uWindDir; varying float vBed;');
  };
  return m;
}

function buildReeds() {
  const beds = [];
  const angs = [.28, .7, 1.25, 1.75, 2.2, 2.7, 3.5, 4.1, 4.7, 5.25, 5.75];
  for (let i = 0; i < angs.length; i++) {
    const a = angs[i];
    let x = 2.75 + Math.cos(a) * 2.35 * 1.03;
    let z = 2.65 + Math.sin(a) * 1.75 * 1.03;
    if (z > 3.82) z = 3.82;
    if (Math.hypot(x - JETTY.x, z - JETTY.z) < .3) continue;
    if (x < .1 && z > 2.2) continue;
    beds.push([x, z]);
  }
  beds.push([1.32, 1.5], [1.86, 1.82], [-.42, 1.9]);
  const nReed = [110, 260, 460][QL], nCat = [9, 18, 32][QL];
  for (let bi = 0; bi < beds.length; bi++) {
    const [bx, bz] = beds[bi];
    const count = 8 + ((R() * 11) | 0);
    const make = (cattail, n) => {
      if (n <= 0) return;
      const geo = reedGeo(cattail);
      const mat = reedMat();
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      const bed = new Float32Array(n), phase = new Float32Array(n);
      const dm = new THREE.Object3D();
      let i = 0, guard = 0;
      while (i < n && guard++ < n * 20 + 10) {
        const a = R() * TAU, rr = R() * .4;
        const x = bx + Math.cos(a) * rr, z = bz + Math.sin(a) * rr * .8;
        if (inLake(x, z) && surf(x, z) === 'lake') continue;
        if (surf(x, z) === 'path') continue;
        if (pathD(x, z) < .03) continue;
        const gy = GY(x, z);
        const h = (cattail ? .24 : .13) + R() * .16;
        dm.position.set(x, gy + .002, z);
        dm.rotation.set((R() - .5) * .18, R() * TAU, (R() - .5) * .18);
        dm.scale.set(.85 + R() * .4, h, .85 + R() * .4);
        dm.updateMatrix();
        mesh.setMatrixAt(i, dm.matrix);
        bed[i] = bi * 1.7 + R() * .5;
        phase[i] = R() * TAU;
        i++;
      }
      geo.setAttribute('aBed', new THREE.InstancedBufferAttribute(bed, 1));
      geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
      mesh.count = i;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      GROOT.add(mesh);
      reedMeshes.push({ mesh, mat, kind: cattail ? 'cat' : 'reed' });
    };
    make(false, Math.max(6, Math.round(nReed / beds.length) + ((R() * 8) | 0)));
    if (bi < nCat / 2) make(true, 2 + ((R() * 3) | 0));
  }
}

/* ===================================================================== */
/*  LILY PADS                                                            */
/* ===================================================================== */
const N_LILY = [16, 28, 40][QL];
let lilyPads = null, lilyFlowers = null, lilyMat = null, lilyFlowerMat = null;
const lilyList = [];
const lilyPadUniforms = { uGreen: { value: WG.col('#3f6a3a') }, uBrown: { value: WG.col('#8a6a34') }, uSnow: { value: 0 } };

function buildLilies() {
  const geo = new THREE.BufferGeometry();
  const pos = [], col = [], idx = [];
  const segs = 18;
  pos.push(0, 0, 0); col.push(.35, .45, .28);
  const notch = .22;
  for (let s = 0; s <= segs; s++) {
    const a = notch + (s / segs) * (TAU - notch * 2);
    const rr = .94 + .06 * Math.sin(s * 2.3);
    pos.push(Math.cos(a) * rr, .015 * Math.sin(a * 2 + 1), Math.sin(a) * rr);
    const g = .55 + .4 * (s / segs);
    col.push(.32 * g, .55 * g, .27 * g);
  }
  for (let s = 0; s < segs; s++) idx.push(0, s + 1, s + 2);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .65, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .35 });
  m.uniforms = lilyPadUniforms;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, lilyPadUniforms);
    sh.uniforms.uSeasonLily = lilySeason;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBrown; uniform float uSnow; uniform float uSeasonLily;')
      .replace('#include <color_fragment>', `
        vec3 lc = vColor;
        lc = mix(lc, lc * vec3(1.15, .95, .68), clamp(uSeasonLily * .9, 0.0, 1.0));
        lc = mix(lc, uBrown, clamp(uSeasonLily - .6, 0.0, .4) * 1.5);
        lc = mix(lc, vec3(.9, .92, .92), uSnow * .5);
        diffuseColor.rgb = lc;
      `);
  };
  lilyMat = m;
  const pads = new THREE.InstancedMesh(geo, m, N_LILY);
  pads.receiveShadow = true; pads.castShadow = false;
  pads.frustumCulled = false; pads.renderOrder = 2;
  GROOT.add(pads);
  lilyPads = pads;

  // flower geometry
  const fb = new GB();
  const w = WG.col('#f3f0e4'), p = WG.col('#e2a9b1');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const v0 = fb.v(0, .03, 0, p, .9, .8, 0, 0, 0, 0, .5, null, 0);
    const v1 = fb.v(Math.cos(a - .3) * .24, .075, Math.sin(a - .3) * .24, w, 1, 1, 0, 0, 0, 0, .8, null, 0);
    const v2 = fb.v(Math.cos(a + .3) * .24, .075, Math.sin(a + .3) * .24, w, 1, 1, 0, 0, 0, 0, .8, null, 0);
    fb.t(v0, v1, v2);
  }
  const fm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .3 });
  const fl = new THREE.InstancedMesh(fb.geo(), fm, Math.ceil(N_LILY / 5));
  fl.receiveShadow = true; fl.frustumCulled = false; fl.renderOrder = 3;
  GROOT.add(fl);
  lilyFlowers = fl; lilyFlowerMat = fm;

  // choose shallow clusters
  let guard = 0;
  const clusters = [[3.9, 1.55], [1.5, 2.2], [4.4, 2.9]];
  while (lilyList.length < N_LILY && guard++ < 900) {
    const c = clusters[(R() * clusters.length) | 0];
    const x = c[0] + (R() - .5) * 1.15, z = c[1] + (R() - .5) * .85;
    if (!inLake(x, z)) continue;
    if (nearShore(x, z) > .96) continue;
    if (pathD(x, z) < .1) continue;
    if (Math.hypot(x - JETTY.x, z - JETTY.z) < .28) continue;
    let tooClose = false;
    for (let i = 0; i < lilyList.length; i++) if (Math.hypot(x - lilyList[i].x, z - lilyList[i].z) < .16) tooClose = true;
    if (tooClose) continue;
    lilyList.push({ x, z, s: .055 + R() * .055, rot: R() * TAU, ph: R() * TAU, kick: 0, flip: 0 });
  }
}
let lilySeason = { value: 0 };

/* ===================================================================== */
/*  LEAF / PETAL / SNOW PUFFS                                            */
/* ===================================================================== */
const PART_CAP = Math.min(460, Math.max(70, Math.round(WG.quality.particles * .16)));
const PART_KIND_CAP = [Math.round(PART_CAP * .5), Math.round(PART_CAP * .3), Math.round(PART_CAP * .2)];
const parts = { mesh: null, items: [], seq: 0 };
const leafCols = [WG.col('#c8461a'), WG.col('#e07b1f'), WG.col('#e9a92b'), WG.col('#b5301c'), WG.col('#f0c24a')];

function buildParts() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -.5, 0, .5, 0, .02, 0, .5, 0, -.5, 0, .02], 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: .96, envMapIntensity: .35 });
  const mesh = new THREE.InstancedMesh(geo, m, PART_CAP);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.renderOrder = 4;
  const dm = new THREE.Object3D();
  dm.scale.setScalar(0); dm.updateMatrix();
  for (let i = 0; i < PART_CAP; i++) {
    mesh.setMatrixAt(i, dm.matrix);
    mesh.setColorAt(i, WG.tmp.c1.setRGB(1, 1, 1));
    parts.items.push({ on: false, kind: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, spin: 0, life: 0, max: 1, sc: 1, settle: 0, float: false, onIce: false, col: new THREE.Color() });
  }
  mesh.instanceColor.needsUpdate = true;
  GROOT.add(mesh);
  parts.mesh = mesh;
}
function freeSlot(kind) {
  let n = 0;
  for (let i = 0; i < parts.items.length; i++) if (parts.items[i].on && parts.items[i].kind === kind) n++;
  if (n >= PART_KIND_CAP[kind]) return -1;
  for (let k = 0; k < parts.items.length; k++) {
    const i = (parts.seq + k) % parts.items.length;
    if (!parts.items[i].on) { parts.seq = i + 1; return i; }
  }
  return -1;
}
function spawnPart(kind, x, y, z, vx, vy, vz) {
  const i = freeSlot(kind);
  if (i < 0) return;
  const p = parts.items[i];
  p.on = true; p.kind = kind; p.x = x; p.y = y; p.z = z;
  p.vx = vx; p.vy = vy; p.vz = vz;
  p.rx = R() * TAU; p.ry = R() * TAU; p.rz = R() * TAU;
  p.spin = (R() - .5) * 7; p.settle = 0; p.float = false; p.onIce = false;
  p.life = p.max = kind === 0 ? 9 + R() * 9 : kind === 1 ? 6 + R() * 6 : 7 + R() * 5;
  p.sc = kind === 0 ? .018 + R() * .012 : kind === 1 ? .013 + R() * .006 : .02 + R() * .014;
  if (kind === 0) p.col.copy(leafCols[(R() * leafCols.length) | 0]);
  else if (kind === 1) p.col.copy(PINK).multiplyScalar(.85 + R() * .3);
  else p.col.copy(SNOW);
}

const partTmp = new THREE.Object3D();
const windTmp = new THREE.Vector3();
function updateParts(dt, t) {
  for (let i = 0; i < parts.items.length; i++) {
    const p = parts.items[i];
    if (!p.on) continue;
    p.life -= dt;
    p.settle += dt;
    const overLake = inLake(p.x, p.z);
    if (p.float) {
      p.x += (S.windVec.x * .22 + Math.sin(t * .9 + p.rx) * .01) * dt;
      p.z += (S.windVec.z * .22 + Math.cos(t * .8 + p.rz) * .01) * dt;
      p.y = U.damp(p.y, S.waterY + .012 + Math.sin(t * 2 + p.rx) * .006, 6, dt);
      p.rx = U.damp(p.rx, 0, 1.5, dt); p.rz = U.damp(p.rz, 0, 1.5, dt);
      p.ry += p.spin * dt * .15;
      if (S.sunVis > .4 && S.daylight > .5) p.life -= dt * .9;
      if (S.ice > .55) { p.y = .12; p.life -= dt * .5; }
    } else if (p.settle > 0 && p.y <= GY(p.x, p.z) + .004 || (p.kind === 0 && p.settle > 0 && p.y <= GY(p.x, p.z) + .006)) {
      if (overLake && S.snow < .6) { p.float = true; p.settle = 0; }
      else {
        p.y = GY(p.x, p.z) + .006;
        p.vx *= .82; p.vz *= .82; p.vy = 0;
        p.rx = U.damp(p.rx, 0, 3, dt); p.rz = U.damp(p.rz, 0, 3, dt);
        if (S.sunVis > .55 && S.daylight > .55) p.life -= dt * .55;
      }
    } else {
      p.vy -= (p.kind === 2 ? 1.6 : 2.6) * dt;
      windTmp.copy(S.windVec);
      const sway = Math.sin(t * 3.1 + p.rx * 3) * .35;
      p.vx += (windTmp.x * .55 + sway * .2) * dt * 7;
      p.vz += (windTmp.z * .55 + Math.cos(t * 2.7 + p.rz * 2) * .3) * dt * 7;
      p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
      const cap = 1.1 + S.wind * .9;
      const sp = Math.hypot(p.vx, p.vz);
      if (sp > cap) { p.vx *= cap / sp; p.vz *= cap / sp; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.spin * dt; p.ry += p.spin * .6 * dt; p.rz += p.spin * .8 * dt;
      if (p.x < -5.85) p.x = -5.84, p.vx = Math.abs(p.vx) * .5;
      if (p.x > 5.85) p.x = 5.84, p.vx = -Math.abs(p.vx) * .5;
      if (p.z < -3.88) p.z = -3.87, p.vz = Math.abs(p.vz) * .5;
      if (p.z > 3.88) p.z = 3.87, p.vz = -Math.abs(p.vz) * .5;
      if (p.y < -.5) p.life = 0;
    }
    const fade = U.clamp01(Math.min(1, p.life * 1.6) * Math.min(1, p.settle * 4));
    const sc = p.sc * fade;
    partTmp.position.set(p.x, p.y, p.z);
    partTmp.rotation.set(p.rx, p.ry, p.rz);
    partTmp.scale.setScalar(p.float ? sc * .9 : sc);
    partTmp.updateMatrix();
    parts.mesh.setMatrixAt(i, partTmp.matrix);
    if (fade <= 0) { p.on = false; partTmp.scale.setScalar(0); partTmp.updateMatrix(); parts.mesh.setMatrixAt(i, partTmp.matrix); }
    else parts.mesh.setColorAt(i, p.col);
  }
  parts.mesh.instanceMatrix.needsUpdate = true;
  if (parts.mesh.instanceColor) parts.mesh.instanceColor.needsUpdate = true;
}

function emitFromTree(tree, kind, count) {
  if (!tree || !tree.crownCenter) return;
  const c = tree.crownCenter;
  for (let i = 0; i < count; i++) {
    const a = R() * TAU, rr = R() * (tree.radius || .2);
    spawnPart(kind,
      c.x + Math.cos(a) * rr, c.y + (R() - .4) * tree.height * .2, c.z + Math.sin(a) * rr,
      (R() - .5) * .25 + S.windVec.x * .25, .05 + R() * .2, (R() - .5) * .25 + S.windVec.z * .25);
  }
}

/* ===================================================================== */
/*  SEASON / WEATHER UNIFORMS                                            */
/* ===================================================================== */
let lastFoliage = -1;
const seasonW = { spring: 0, summer: 0, autumn: 0, winter: 0 };
function smoothWin(s, w) { return U.smoothstep(w[0], w[1], s) * (1 - U.smoothstep(w[2], w[3], s)); }

function leafy(s) {
  const springF = s < 2 ? 1 - U.smoothstep(.12, .42, s) : 0;
  return U.clamp01(Math.max(S.leaves, springF));
}
function blossomy(s) {
  const springF = s < 2 ? 1 - U.smoothstep(.2, .46, s) : 0;
  return U.clamp01(Math.max(S.blossom, springF));
}
function flowerLook(snow) {
  const open = U.clamp01(S.daylight * 1.7 + (S.dusk || 0) * .2);
  const full = 1 + S.wet * .28 + S.rain * .12;
  for (let i = 0; i < flowerMeshes.length; i++) {
    const m = flowerMeshes[i].mat;
    m.uniforms.uOpen.value = open;
    m.uniforms.uClose.value = 1 - open;
    m.uniforms.uFull.value = full;
  }
}
function applySeason() {
  const s = ((S.season % 4) + 4) % 4;
  const snow = U.smoothstep(.06, .55, S.snow) * (1 - U.smoothstep(2.2, 1.4, S.season) * .12);
  G.uSeason.value = s;
  G.uLeaves.value = S.leaves;
  G.uBlossom.value = S.blossom;
  G.uSnow.value = U.clamp01(snow);
  G.uWet.value = S.wet;
  G.uSpring.value = U.smoothstep(.02, .35, s) * (1 - U.smoothstep(.8, 1.5, s));
  G.uAutumnW.value = smoothWin(s, [1.5, 2.1, 3.25, 3.7]);
  if (S.grassColor) G.uGrassCol.value.copy(S.grassColor);
  // per flower species bloom windows (spring kinds also read late winter)
  for (let i = 0; i < flowerMeshes.length; i++) {
    const rec = flowerMeshes[i];
    const w = rec.def.bloom;
    let ss = s;
    if (rec.key === 'daisy' || rec.key === 'buttercup' || rec.key === 'violet') ss = s > 3 ? s - 4 : s;
    const ww = rec.key === 'daisy' ? [-.3, .08, 2.55, 2.95] :
      rec.key === 'buttercup' ? [-.25, .06, 1.25, 1.65] :
      rec.key === 'violet' ? [-.2, .02, 1.0, 1.45] : w;
    let bloom = smoothWin(ss, ww);
    bloom *= 1 - U.smoothstep(.08, .4, snow);
    rec.bloom = bloom;
    rec.mat.uniforms.uBloom.value = bloom;
    rec.mesh.visible = bloom > .008;
  }
  flowerLook(snow);
  // reeds bleach and droop
  const bleach = U.smoothstep(1.85, 2.55, s) * (1 - U.smoothstep(3.15, 3.55, s));
  const droop = U.smoothstep(.25, .8, S.snow);
  for (let i = 0; i < reedMeshes.length; i++) {
    reedMeshes[i].mat.uniforms.uBleach.value = bleach;
    reedMeshes[i].mat.uniforms.uDroop.value = droop;
  }
  G.uPaleGrass.value.copy(PALE_GRASS).lerp(WG.col('#b9a778'), bleach * .4);
  // lily presence / browning
  const presence = U.smoothstep(.08, .4, s) * (1 - U.smoothstep(2.95, 3.4, s));
  lilySeason.value = U.clamp01((s - 1.3) / 1.3) * presence;
  if (lilyPads) lilyPads.visible = presence > .02;
  if (lilyFlowers) lilyFlowers.visible = presence > .4 && s > .8 && s < 2.25;
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    const pine = t.type === 'pine';
    t.crownMat.uniforms.uLeaf.value = pine ? 1 : leafy(s);
    t.crownMat.uniforms.uKeep.value = pine ? 1 : t.keep * U.smoothstep(1.4, 2.2, s) * (1 - U.smoothstep(3.35, 3.75, s));
    const aut = pine ? 0 : (t.type === 'birch' ? .92 : t.type === 'cherry' ? 1 : .7) * smoothWin(s, [1.55, 2.05, 3.3, 3.72]);
    t.crownMat.uniforms.uAutumn.value = aut;
  }
  for (let i = 0; i < bushes.length; i++) {
    const m = bushes[i].mat;
    const ever = m.uniforms.uCherry.value === 0 && !bushes[i].decid;
    m.uniforms.uLeaf.value = 1;
    m.uniforms.uKeep.value = 1;
    m.uniforms.uAutumn.value = ever ? .45 * G.uAutumnW.value : .85 * G.uAutumnW.value;
  }
  // sun direction for flowers (world)
  const sx = S.sunPos.x, sy = S.sunPos.y - .6, sz = S.sunPos.z;
  const sl = Math.hypot(sx, sy, sz) || 1;
  G.uSunDir.value.set(sx / sl, sy / sl, sz / sl);
  G.uDay.value = U.clamp01(S.daylight * 1.5);

  const fol = Math.round(S.leaves * 100) / 100;
  if (fol !== lastFoliage) { lastFoliage = fol; WG.emit('foliage', { leaves: S.leaves, blossom: S.blossom }); }
}

/* ---------- lily riding ---------- */
const lilyTmp = new THREE.Object3D();
function updateLilies(dt, t) {
  if (!lilyPads || !lilyPads.visible) return;
  const presence = U.smoothstep(.08, .4, S.season) * (1 - U.smoothstep(2.95, 3.4, S.season));
  let fi = 0;
  for (let i = 0; i < lilyList.length; i++) {
    const p = lilyList[i];
    p.kick = Math.max(0, p.kick - dt * 1.7);
    const wob = Math.sin(t * 1.15 + p.ph) * .006 + Math.sin(t * 2.7 + p.ph * 2) * .003;
    const y = S.waterY + .012 + wob + p.kick * .012;
    const tilt = Math.sin(t * .9 + p.ph) * .05 + p.kick * .3;
    lilyTmp.position.set(p.x, y, p.z);
    lilyTmp.rotation.set(Math.sin(t * 1.3 + p.ph) * .05 + p.kick * .2, p.rot + Math.sin(t * .2 + p.ph) * .08, tilt);
    const s = p.s * (.4 + presence * .6);
    lilyTmp.scale.set(s, s * .9, s);
    lilyTmp.updateMatrix();
    lilyPads.setMatrixAt(i, lilyTmp.matrix);
    if (lilyFlowers.visible && i % 5 === 2) {
      const fw = U.clamp01((U.clamp01(S.season) - .8) * 2) * (1 - U.smoothstep(2.05, 2.4, U.clamp01(S.season)));
      lilyTmp.position.set(p.x + .012, y + .008, p.z + .009);
      lilyTmp.rotation.set(.2, p.rot, tilt * .6);
      lilyTmp.scale.set(s * 4.4 * (.5 + fw * .5), s * 5.2 * (.5 + fw * .5), s * 4.4);
      lilyTmp.updateMatrix();
      lilyFlowers.setMatrixAt(fi++, lilyTmp.matrix);
    }
  }
  lilyPads.instanceMatrix.needsUpdate = true;
  if (lilyFlowers.visible) {
    lilyFlowers.count = Math.min(lilyFlowers.instanceMatrix.count, fi);
    lilyFlowers.instanceMatrix.needsUpdate = true;
  }
}

/* ---------- emit pacing ---------- */
function emitTick(dt, t) {
  const s = ((S.season % 4) + 4) % 4;
  // autumn leaf fall, one at a time
  if (deciduous.length && s > 1.75 && s < 3.05 && S.leaves < .94) {
    leafFallT -= dt * (.5 + S.wind * 1.5 + (1 - S.leaves) * 1.2);
    if (leafFallT <= 0) {
      leafFallT = .45 + R() * 1.6;
      const pool = [];
      for (let i = 0; i < deciduous.length; i++) if (deciduous[i].crownMat.uniforms.uLeaf.value > .12) pool.push(deciduous[i]);
      if (pool.length) {
        const tr = pool[(R() * pool.length) | 0];
        const c = tr.crownCenter, a = R() * TAU, rr = R() * tr.radius;
        spawnPart(0, c.x + Math.cos(a) * rr, c.y, c.z + Math.sin(a) * rr,
          (R() - .5) * .2 + S.windVec.x * .2, -.05 - R() * .1, (R() - .5) * .2 + S.windVec.z * .2);
      }
    }
  }
  // blossom petals
  if (S.blossom > .12) {
    petalT -= dt * (.45 + S.blossom * 1.3 + S.wind);
    if (petalT <= 0) {
      petalT = 1.1 + R() * 2.2;
      if (cherries.length) {
        const tr = cherries[(R() * cherries.length) | 0], c = tr.crownCenter, a = R() * TAU, rr = R() * tr.radius * 1.1;
        spawnPart(1, c.x + Math.cos(a) * rr, c.y + (R() - .5) * .2, c.z + Math.sin(a) * rr,
          (R() - .5) * .22 + S.windVec.x * .2, -.03 - R() * .06, (R() - .5) * .22 + S.windVec.z * .2);
      }
    }
  }
  // snow puffs off branches
  if (S.snow > .12 || (S.snowfall > .1 && S.temp < 1)) {
    puffT -= dt * (1 + S.snowfall * 2);
    if (puffT <= 0) {
      puffT = .5 + R() * 1.8;
      if (trees.length) {
        const tr = trees[(R() * trees.length) | 0], c = tr.crownCenter;
        spawnPart(2, c.x + (R() - .5) * tr.radius, c.y + (R() - .3) * .2, c.z + (R() - .5) * tr.radius,
          (R() - .5) * .12, .02 + R() * .05, (R() - .5) * .12);
      }
    }
  }
}

/* ===================================================================== */
/*  UPDATE                                                               */
/* ===================================================================== */
let lastSeasonEmit = -1;
function update(dt, t) {
  if (!WG.flora.ready) return;
  try {
    G.uTime.value = t;
    G.uWind.value = U.clamp(S.wind, 0, 1.6);
    G.uSway.value = 1.85;
    const wl = Math.hypot(S.windVec.x, S.windVec.z);
    if (wl > .0001) G.uWindDir.value.set(S.windVec.x / wl, S.windVec.z / wl);
    else G.uWindDir.value.set(Math.cos(S.windAngle), Math.sin(S.windAngle));
    if (Math.abs(S.season - lastSeasonEmit) > .02) { lastSeasonEmit = S.season; applySeason(); }
    G.uSnow.value = U.smoothstep(.06, .55, S.snow);
    G.uLeaves.value = leafy(((S.season % 4) + 4) % 4);
    G.uBlossom.value = blossomy(((S.season % 4) + 4) % 4);
    G.uWet.value = S.wet;
    if (S.grassColor) G.uGrassCol.value.copy(S.grassColor);
    flowerLook(G.uSnow.value);
    const bW = U.smoothstep(1.85, 2.55, ((S.season % 4) + 4) % 4) * (1 - U.smoothstep(3.15, 3.55, ((S.season % 4) + 4) % 4));
    G.uPaleGrass.value.copy(PALE_GRASS).lerp(WG.col('#b9a778'), bW * .4);
    for (let i = 0; i < reedMeshes.length; i++) {
      reedMeshes[i].mat.uniforms.uBleach.value = bW;
      reedMeshes[i].mat.uniforms.uDroop.value = U.smoothstep(.25, .8, S.snow);
    }
    for (let i = 0; i < trees.length; i++) {
      const tr = trees[i];
      if (tr.type !== 'pine') tr.crownMat.uniforms.uLeaf.value = G.uLeaves.value;
    }
    const sx = S.sunPos.x, sy = S.sunPos.y - .6, sz = S.sunPos.z;
    const sl = Math.hypot(sx, sy, sz) || 1;
    G.uSunDir.value.set(sx / sl, sy / sl, sz / sl);
    // hover glow + lean
    if (hovered !== lastHovered) { lastHovered = hovered; }
    for (let i = 0; i < trees.length; i++) {
      const tr = trees[i];
      const p = tr.pull;
      tr.group.rotation.z = U.damp(tr.group.rotation.z, -p.x * 1.15 + Math.sin(t * .8 + tr.phase) * .012 * S.wind, 5, dt);
      tr.group.rotation.x = U.damp(tr.group.rotation.x, p.y * 1.15 + Math.cos(t * .62 + tr.phase) * .008 * S.wind, 5, dt);
      p.multiplyScalar(Math.max(0, 1 - dt * 3.2));
      tr.crownMat.emissiveIntensity = U.damp(tr.crownMat.emissiveIntensity, tr === hovered ? .075 : 0, 7, dt);
    }
    applyLilyWeather();
    updateLilies(dt, t);
    updateParts(dt, t);
    emitTick(dt, t);
  } catch (e) { WG.warn('flora:update', e); }
}
function applyLilyWeather() {
  lilyPadUniforms.uSnow.value = U.clamp01(S.snow);
}

/* ===================================================================== */
/*  API                                                                  */
/* ===================================================================== */
WG.flora = {
  ready: false, trees, flowers: flowerPatches, bushes, hovered: null,
  burst(tree, kind) {
    try {
      const k = kind === 'petal' ? 1 : kind === 'snow' ? 2 : 0;
      emitFromTree(tree, k, k === 1 ? 18 : 14);
      if (k === 2) {
        for (let i = 0; i < 8; i++) spawnPart(2, tree.base.x + (R() - .5) * .4, tree.base.y + tree.height * (.6 + R() * .4), tree.base.z + (R() - .5) * .4, 0, .03, 0);
      }
    } catch (e) { WG.warn('flora:burst', e); }
  },
  setWeather() { try { applySeason(); } catch (e) {} },
  get counts() { return { trees: trees.length, bushes: bushes.length, flowers: flowerPatches.length }; }
};

/* ===================================================================== */
/*  INIT                                                                 */
/* ===================================================================== */
function init() {
  T = WG.terrain || null;
  try {
    if (T && T.heightAt && !T.ready && T.build) { try { T.build(); } catch (e) {} }
    buildTrees();
    buildGrass();
    buildFlowers();
    buildReeds();
    buildParts();
    buildLilies();
    const off = WG.on('splash', data => {
      try {
        if (!data || !data.pos) return;
        for (let i = 0; i < lilyList.length; i++) {
          const p = lilyList[i];
          const d = Math.hypot(p.x - data.pos.x, p.z - data.pos.z);
          if (d < .6) p.kick = Math.max(p.kick, (1 - d / .6) * .9);
        }
        for (let i = 0; i < 6; i++) {
          const a = R() * TAU;
          const x = data.pos.x + Math.cos(a) * .12, z = data.pos.z + Math.sin(a) * .12;
          if (inLake(x, z)) spawnPart(0, x, S.waterY + .03, z, Math.cos(a) * .2, .15 + R() * .15, Math.sin(a) * .2);
        }
      } catch (e) {}
    });
    WG.flora._offs = [off];
    applySeason();
    WG.flora.ready = true;
    WG.emit('foliage', { trees: trees.length, bushes: bushes.length, flowers: flowerPatches.length });
  } catch (e) {
    WG.warn('flora', e);
    WG.flora.ready = true;
  }
}

WG.register('flora', {
  order: 24,
  init,
  update(dt, t) { update(dt, t); },
  dispose() {
    try {
      WG.flora.ready = false;
      if (WG.flora._offs) for (const off of WG.flora._offs) off();
      while (GROOT.children.length) {
        const c = GROOT.children.pop();
        c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      }
    } catch (e) { WG.warn('flora:dispose', e); }
  }
});
})();
