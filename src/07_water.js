/* ===== 07_water.js — lake, river, waterfall, pool, cross-section, fish ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state, Q = WG.quality;
if (!WG.groups || !WG.groups.water) return;
const R = WG.rng('water');
const TAU = Math.PI * 2;
const T = () => WG.terrain;

/* ---------- fixed geography (contract §2) ---------- */
const CX = 2.75, CZ = 2.65, RX = 2.35, RZ = 1.75;
const FRONTZ = 3.985, CROSSZ = 4.004, BACKZ = 3.94;
const POOLX = -1.5, POOLZ = -0.9;
const LIP = new THREE.Vector3(-1.5, 2.16, -1.44);
const QL = Q.level;
const N_ANG = [64, 96, 132][QL];
const N_RING = [15, 21, 29][QL];
const N_CROSS = [26, 40, 56][QL];
const N_RIVER = [36, 54, 74][QL];
const N_FISH = [6, 8, 10][QL];
const N_SPRAY = [24, 48, 80][QL];
const N_SPECK = [26, 50, 84][QL];
const N_BUBBLE = [14, 26, 42][QL];
const N_SPLASH = [48, 96, 150][QL];
const N_MIST = [2, 4, 6][QL];
const N_LAKE_RIPPLES = 12;

const WG_ = WG.water = {
  ready: false, surface: null, fish: [], rippleSource: [],
  ring(x, z, strength) { try { addRing(x, z, strength, false); } catch (e) { WG.warn('water:ring', e); } },
  splash(x, z, strength) { try { addSplash(x, z, strength); } catch (e) { WG.warn('water:splash', e); } },
  freeze() {
    freezeBoost = 1;
    S.ice = Math.max(S.ice, 1);
    S.snow = Math.max(S.snow, .35);
  }
};

/* ---------- helpers ---------- */
function bedAt(x, z) {
  const t = T();
  if (t && t.ready && t.heightAt) { try { return t.heightAt(x, z); } catch (e) {} }
  const dx = (x - CX) / RX, dz = (z - CZ) / RZ;
  const inside = U.clamp01(1 - Math.sqrt(dx * dx + dz * dz));
  return 0.06 - inside * 1.02;
}
function lakeInside(x, z) {
  const dx = (x - CX) / RX, dz = (z - CZ) / RZ;
  return dx * dx + dz * dz < 1;
}
// outward-most radius (0..1 of the ellipse) where the terrain bed is still under water
function shoreR(a) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const wy = S.waterY;
  let last = .55;
  for (let i = 0; i <= 26; i++) {
    const r = 1.04 - i * .02;
    const x = CX + ca * RX * r, z = CZ + sa * RZ * r;
    if (z > FRONTZ) { last = r; continue; }
    if (bedAt(x, z) < wy - .012) return Math.min(1, r + .045);
    last = r;
  }
  return Math.max(.4, last);
}
function riverCenterAt(t) {
  // quadratic-ish curve pool -> lake mouth, pulled to give a diagonal
  const p0x = POOLX, p0z = POOLZ, p3x = 2, p3z = 2;
  const p1x = -0.55, p1z = -0.2, p2x = 0.95, p2z = 0.78;
  const u = t, m = 1 - u;
  return [
    m * m * m * p0x + 3 * m * m * u * p1x + 3 * m * u * u * p2x + u * u * u * p3x,
    m * m * m * p0z + 3 * m * m * u * p1z + 3 * m * u * u * p2z + u * u * u * p3z
  ];
}
function riverHalfWidth(t) {
  const t2 = T();
  if (t2 && t2.ready && t2.river && t2.river.widthAt) { try { return t2.river.widthAt(...riverCenterAt(t)) * .5; } catch (e) {} }
  return U.lerp(.1, .275, U.clamp01(t));
}
function poolSurface() {
  const t = T();
  if (t && t.ready && t.pool && t.pool.surfaceY != null) return t.pool.surfaceY;
  return 1.06;
}
function riverSurface(t) {
  const [x, z] = riverCenterAt(t);
  const t2 = T();
  if (t2 && t2.ready && t2.river && t2.river.levelAt) { try { return t2.river.levelAt(x, z); } catch (e) {} }
  return U.lerp(poolSurface(), .14, t);
}
function lipY() {
  const t = T();
  if (t && t.cliffLip) return t.cliffLip.y ?? t.cliffLip[1] ?? LIP.y;
  return LIP.y;
}
function nearRiver(x, z) {
  let best = 1e9;
  for (let i = 0; i <= 20; i++) {
    const p = riverCenterAt(i / 20);
    const d = Math.hypot(x - p[0], z - p[1]);
    if (d < best) best = d;
  }
  return best < .5;
}

/* ---------- fish / ring state ---------- */
const rings = [];
let ringHead = 0, splashHead = 0, ringSerial = 0;
let iceVis = 0, waterY = S.waterY, murk = 0, freezeBoost = 0;
let poolPulse = 1.1, timeNow = 0, reflFrame = 0, splashAcc = 0;

/* ---------- glsl ---------- */
const NOISE = `
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.-2.*f);
  float a = hash21(i), b = hash21(i+vec2(1.,0.)), c = hash21(i+vec2(0.,1.)), d = hash21(i+vec2(1.,1.));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float vnoise3(vec2 p){ return vnoise(p)*.62 + vnoise(p*2.13+11.)*.26 + vnoise(p*4.7-4.)*.12; }
`;
const RING_UNIFORMS = `uniform vec4 uRings[${N_LAKE_RIPPLES}]; uniform float uTime;`;
const RING_FN = `
float ringHeight(vec2 p){
  float h = 0.;
  for (int i = 0; i < ${N_LAKE_RIPPLES}; i++){
    vec4 r = uRings[i];
    float age = uTime - r.z;
    if (age > 0. && age < 3.4){
      float dist = distance(p, r.xy);
      float front = age * .82 + .02;
      float band = exp(-pow((dist - front) * 16.5, 2.));
      float decay = exp(-age * 1.25) * r.w;
      h += sin((dist - front) * 40.) * band * decay;
    }
  }
  return h;
}
`;
const WATER_VERT_BODY = `
varying vec3 vWorld; varying vec2 vXZ; varying float vEdge; varying float vDepth; varying float vBank; varying float vT;
void main(){
  vec3 pos = position;
  vXZ = (modelMatrix * vec4(pos,1.)).xz;
  vWorld = (modelMatrix * vec4(pos,1.)).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(pos,1.);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

function mkUniforms() {
  const rg = [];
  for (let i = 0; i < N_LAKE_RIPPLES; i++) rg.push(new THREE.Vector4(0, 0, -99, 0));
  return {
    uTime: { value: 0 }, uWaterY: { value: .1 }, uWind: { value: .3 },
    uWindDir: { value: new THREE.Vector2(1, 0) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(1, .96, .9) }, uSunVis: { value: 1 },
    uSkyCol: { value: new THREE.Color(.32, .36, .4) },
    uDeep: { value: WG.col('#327f8d') }, uShallow: { value: WG.col('#8fd0ce') },
    uFoam: { value: WG.col('#e9f3ef') }, uIceCol: { value: WG.col('#d5d7d9') },
    uSand: { value: WG.col('#c6aa82') },
    uIce: { value: 0 }, uSnow: { value: 0 }, uRain: { value: 0 }, uMurk: { value: 0 },
    uNight: { value: 0 }, uGold: { value: 0 }, uFlash: { value: 0 },
    uRefl: { value: 0 }, uFlow: { value: 1 }, uSwell: { value: 1 },
    uRings: { value: rg }, uReflMat: { value: new THREE.Matrix4() }, tRefl: { value: null },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog)
  };
}
const allUniformSets = [];
function mkMat(vert, frag, uniforms, extra) {
  const u = uniforms || mkUniforms();
  allUniformSets.push(u);
  return new THREE.ShaderMaterial({
    uniforms: u, vertexShader: vert, fragmentShader: frag,
    transparent: true, depthWrite: false, fog: true, clipping: true,
    side: THREE.DoubleSide, ...extra
  });
}

const group = WG.groups.water;

/* ---------- materials ---------- */
let lakeMat, crossMat, riverMat, fallsMat, strandMat, poolMat, curtainMat;
let rockMat, mossMat, wetRockMat, pebbleMat, snowMat, eyeMat;

function buildMaterials() {
  WG.applyEnv; // noop ref
  const env = () => WG.env && WG.env.tex;
  rockMat = new THREE.MeshStandardMaterial({ map: WG.tex.rock, color: WG.col('#76746e'), roughness: .82, metalness: .02, envMap: env() || null, envMapIntensity: .35 });
  wetRockMat = new THREE.MeshStandardMaterial({ map: WG.tex.rock, color: WG.col('#5c6360'), roughness: .34, metalness: .05, envMap: env() || null, envMapIntensity: .6 });
  pebbleMat = new THREE.MeshStandardMaterial({ map: WG.tex.rock, color: WG.col('#8b877d'), roughness: .7, envMap: env() || null, envMapIntensity: .3 });
  mossMat = new THREE.MeshStandardMaterial({ color: WG.col('#486b35'), roughness: .93, metalness: 0 });
  snowMat = new THREE.MeshStandardMaterial({ color: WG.col('#e3e7e9'), roughness: .72, metalness: 0 });
  eyeMat = new THREE.MeshBasicMaterial({ color: WG.col('#101010') });
}

/* ---------- lake surface ---------- */
function buildLakeSurface() {
  const pos = [], bed = [], edge = [], idx = [];
  // per-angle ray limit so the surface is cleanly clipped at the front glass
  const maxR = [];
  for (let ai = 0; ai < N_ANG; ai++) {
    const a = (ai / N_ANG) * TAU;
    let mr = 1;
    const sa = Math.sin(a), ca = Math.cos(a);
    if (sa > .0001) mr = Math.min(mr, ((FRONTZ - CZ) / (sa * RZ)));
    if (ca > .0001) mr = Math.min(mr, ((5.32 - CX) / (ca * RX)));
    if (ca < -.0001) mr = Math.min(mr, ((.2 - CX) / (ca * RX)));
    maxR.push(U.clamp(mr, .12, 1));
  }
  const wrapWob = (a) => 1 + (WG.fbm2(Math.cos(a) * 2.1 + 9.3, Math.sin(a) * 2.1 + 3.1, 3) - .5) * .17
    + Math.sin(a * 5 + 1.2) * .028 + Math.sin(a * 9 + .4) * .014;
  pos.push(CX, 0, CZ); bed.push(bedAt(CX, CZ)); edge.push(1);
  for (let ri = 1; ri <= N_RING; ri++) {
    const rr = ri / N_RING;
    for (let ai = 0; ai < N_ANG; ai++) {
      const a = (ai / N_ANG) * TAU + (ri % 2) * (Math.PI / N_ANG);
      const lim = maxR[ai] * (T() && T().ready ? shoreR(a) : .9);
      const wob = wrapWob(a);
      const r = rr * lim;
      const x = CX + Math.cos(a) * RX * r * wob;
      const z = Math.min(FRONTZ, CZ + Math.sin(a) * RZ * r * wob);
      pos.push(x, 0, z);
      bed.push(bedAt(x, z));
      edge.push(1 - rr);
    }
  }
  const at = (ri, ai) => 1 + (ri - 1) * N_ANG + (((ai % N_ANG) + N_ANG) % N_ANG);
  for (let ai = 0; ai < N_ANG; ai++) idx.push(0, at(1, ai + 1), at(1, ai));
  for (let ri = 2; ri <= N_RING; ri++) {
    for (let ai = 0; ai < N_ANG; ai++) {
      const a0 = at(ri - 1, ai), a1 = at(ri - 1, ai + 1), b0 = at(ri, ai), b1 = at(ri, ai + 1);
      idx.push(a0, b1, b0, a0, a1, b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aBedY', new THREE.Float32BufferAttribute(bed, 1));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function lakeVert() {
  return `
  attribute float aBedY; attribute float aEdge;
  ${RING_UNIFORMS}
  uniform float uWind, uWaterY; uniform vec2 uWindDir;
  varying vec3 vWorld; varying vec2 vXZ; varying float vEdge; varying float vDepth;
  ${NOISE}
  ${RING_FN}
  #include <fog_pars_vertex>
  void main(){
    vec3 p = position;
    vec2 xz = p.xz;
    float edge = aEdge;
    float wamp = (0.004 + uWind * .012) * smoothstep(0., .18, edge);
    float t = uTime;
    p.y += (vnoise3(xz * 2.2 + uWindDir * t * .55) - .5) * wamp * 1.6;
    p.y += ringHeight(xz) * .011;
    vWorld = (modelMatrix * vec4(p,1.)).xyz;
    vXZ = (modelMatrix * vec4(p,1.)).xz;
    vEdge = edge;
    vDepth = max(0., uWaterY - aBedY);
    vec4 mvPosition = modelViewMatrix * vec4(p,1.);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
}
function lakeFrag() {
  return `
  ${RING_UNIFORMS}
  uniform float uWind, uWaterY, uIce, uSnow, uRain, uMurk, uNight, uGold, uFlash, uSunVis, uRefl, uFlow;
  uniform vec3 uSunDir, uSunCol, uSkyCol, uDeep, uShallow, uFoam, uIceCol;
  uniform vec2 uWindDir; uniform sampler2D tRefl; uniform mat4 uReflMat;
  varying vec3 vWorld; varying vec2 vXZ; varying float vEdge; varying float vDepth;
  ${NOISE}
  ${RING_FN}
  #include <fog_pars_fragment>
  void main(){
    vec2 p = vXZ;
    float edge = vEdge;
    float depth = vDepth;
    float iceK = uIce;
    // --- normal from wind ripples + ring gradients ---
    vec2 wd = normalize(uWindDir + vec2(.0001));
    float amp = (0.12 + uWind * .62) * (1. - iceK * .92);
    float n1 = vnoise3(p * 2.4 + wd * uTime * .7);
    float n2 = vnoise3(p * 5.1 - wd * uTime * .5 + 17.);
    vec3 N = vec3(0., 1., 0.);
    N.xz += ((n1 - .5) * 1.2 + (n2 - .5) * .65) * amp;
    float rgx = ringHeight(p + vec2(.035, 0.)) - ringHeight(p - vec2(.035, 0.));
    float rgz = ringHeight(p + vec2(0., .035)) - ringHeight(p - vec2(0., .035));
    N.x += rgx * 6.5 * (1. - iceK);
    N.z += rgz * 6.5 * (1. - iceK);
    N = normalize(N);
    // --- colour by depth, caustics in the shallows ---
    float depthN = clamp(depth / .62, 0., 1.);
    vec3 col = mix(uShallow, uDeep, smoothstep(.03, .9, depthN));
    vec2 cp = p * 2.9 + wd * uTime * .06;
    float caust = vnoise(cp + vec2(0., uTime * .05));
    caust = smoothstep(.56, .86, caust) * (1. - smoothstep(.18, .6, depth));
    col += uShallow * caust * .5 * (1. - iceK);
    col += uSunCol * depthN * .075 * uSunVis * (1. - iceK);
    // --- reflection / fresnel ---
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1. - max(dot(V, N), 0.), 3.4);
    vec3 refl;
    if (uRefl > .5) {
      vec4 rc = uReflMat * vec4(vWorld, 1.);
      vec2 ruv = rc.xy / max(rc.w, .0001) * .5 + .5;
      ruv.x = 1. - ruv.x;
      ruv += N.xz * .055 + (vec2(vnoise(p * 9. + uTime), vnoise(p * 9. - uTime)) - .5) * .006;
      refl = texture2D(tRefl, clamp(ruv, .001, .999)).rgb * vec3(.62, .8, .84);
    } else {
      refl = uSkyCol * (1. + uGold * .5) * vec3(.55, .76, .8);
    }
    refl = mix(uShallow * 1.15, refl, .72);
    col = mix(col, refl, clamp(fres * .58 + .04, 0., .58) * (1. - iceK * .85));
    // --- sun sparkle ---
    vec3 H = normalize(uSunDir + V);
    float nh = max(dot(N, H), 0.);
    float spk = pow(nh, 420.) * 42. + pow(nh, 60.) * .7;
    float sparkleMask = smoothstep(.42, .64, vnoise(p * 31. + floor(uTime * 14.)));
    col += uSunCol * spk * uSunVis * (.4 + sparkleMask * 1.4) * (1. - iceK);
    // --- lapping foam line & wind streaks ---
    float lap = .009 + .008 * sin(uTime * .85 + vnoise(p * 2.6) * 7.);
    float shore = 1. - smoothstep(0., .026, edge - lap);
    float crest = smoothstep(.32, .8, ringHeight(p) * 26.);
    float streak = smoothstep(.85, .99, vnoise(p * vec2(7., 2.2) - wd * uTime * 1.7)) * clamp(uWind - .15, 0., 1.) * .22;
    float foam = clamp(shore * .75 + crest * .55 + streak, 0., 1.) * (1. - iceK);
    col = mix(col, uFoam, foam);
    // --- ice from the edges inward ---
    float shoreFact = 1. - edge;
    float thr = 1. - iceK * 1.42 + (vnoise(p * 5.3) - .5) * .2;
    float ice = smoothstep(thr - .055, thr + .06, shoreFact);
    ice = clamp(ice, 0., 1.);
    vec3 iceCol = uIceCol * (.9 + vnoise(p * 17.) * .22);
    col = mix(col, iceCol, ice * .97);
    float crack = 1. - smoothstep(0., .022, abs(vnoise(p * 8.5 + 3.7) - .5));
    col = mix(col, iceCol * .42, crack * ice * .8);
    float bub = step(.865, vnoise3(p * 27.));
    col += uFoam * bub * ice * .55;
    float drift = smoothstep(.5, .95, vnoise(p * 6.4 + 2.)) * uSnow;
    col = mix(col, vec3(.82, .87, .91), drift * ice * .85);
    col += uFlash * vec3(.05, .06, .07);
    col *= 1. - uNight * .55;
    // murk
    col = mix(col, vec3(.16, .23, .22), uMurk * .35);
    float a = mix(.36 + depthN * .60, .97, ice);
    a = max(a, shore * .6);
    a = clamp(a + uMurk * .08, 0., .99);
    gl_FragColor = vec4(col, a);
    #include <fog_fragment>
  }`;
}

/* ---------- cross-section water body (front glass slice) ---------- */
// the slice has its own deeper bed so the cut always reads as deep water, with a sandy floor
const SLICE_X0 = CX - RX * Math.sqrt(1 - ((CROSSZ - CZ) / RZ) ** 2) * .97;
const SLICE_X1 = CX + RX * Math.sqrt(1 - ((CROSSZ - CZ) / RZ) ** 2) * .97;
function sliceBedY(x) {
  const tx = U.clamp01((x - SLICE_X0) / (SLICE_X1 - SLICE_X0));
  const edge = Math.min(U.smoothstep(0, .22, tx), U.smoothstep(1, .78, tx));
  const d = .24 + .74 * edge + (WG.noise2(x * 6.5 + 3, 11.7) - .5) * .06;
  return .1 - d;
}
function buildCrossSection() {
  const z = CROSSZ;
  const dz = (z - CZ) / RZ;
  const half = RX * Math.sqrt(Math.max(0.02, 1 - dz * dz)) * .97;
  const cols = [], bedYs = [];
  for (let i = 0; i <= N_CROSS; i++) {
    const x = CX - half + (2 * half) * (i / N_CROSS);
    cols.push(x);
    bedYs.push(sliceBedY(x));
  }
  const rows = 6, pos = [], aT = [], aX = [], idx = [];
  for (let c = 0; c <= N_CROSS; c++) {
    for (let r = 0; r <= rows; r++) {
      const fr = r / rows;
      pos.push(cols[c], 0, z);
      aT.push(fr); aX.push(cols[c]);
    }
  }
  for (let c = 0; c < N_CROSS; c++) {
    for (let r = 0; r < rows; r++) {
      const a = c * (rows + 1) + r, b = (c + 1) * (rows + 1) + r;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  g.setAttribute('aX', new THREE.Float32BufferAttribute(aX, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.userData.cols = cols;
  g.userData.beds = bedYs;
  g.userData.rows = rows;
  g.userData.z = z;
  return g;
}
function updateCrossSection(mesh) {
  const g = mesh.geometry, cols = g.userData.cols, beds = g.userData.beds, rows = g.userData.rows;
  const arr = g.attributes.position.array;
  let p = 0;
  const wy = waterY;
  for (let c = 0; c < cols.length; c++) {
    const b = Math.min(beds[c], wy - .035);
    for (let r = 0; r <= rows; r++) {
      arr[p * 3 + 1] = U.lerp(b, wy, r / rows);
      p++;
    }
  }
  g.attributes.position.needsUpdate = true;
}
function crossVert() {
  return `
  attribute float aT; attribute float aX;
  varying float vT; varying float vX; varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main(){
    vT = aT; vX = aX;
    vec4 wp = modelMatrix * vec4(position,1.);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
}
function crossFrag() {
  return `
  uniform float uTime, uWaterY, uIce, uSnow, uMurk, uNight, uSunVis, uFlash, uFlow;
  uniform vec3 uSunDir, uSunCol, uDeep, uShallow, uFoam, uSand, uIceCol;
  varying float vT; varying float vX; varying vec3 vWorld;
  ${NOISE}
  #include <fog_pars_fragment>
  void main(){
    float t = vT;
    float depth = clamp(1. - t, 0., 1.);
    vec3 col = mix(uDeep * 1.35, mix(uDeep, uShallow, .6), pow(t, 2.4));
    col = mix(col, uDeep * .82, smoothstep(.4, 1., depth) * .35);
    // dark band just under the surface
    float band = 1. - smoothstep(.0, .035, (1. - t));
    float under = (1. - smoothstep(.92, 1., t)) * (1. - smoothstep(.78, .91, t));
    col *= 1. - under * .5;
    // shifting slanted shafts
    float slant = vX * 4.2 + depth * 5.6;
    float shaft = pow(max(0., sin(slant + uTime * .22 + vnoise(vWorld.xy * 1.7) * 2.4)), 10.);
    col += uSunCol * shaft * .2 * uSunVis * (1. - uIce) * t;
    // drifting motes
    float motes = smoothstep(.83, 1., vnoise(vWorld.xy * 26. + vec2(uTime * .13, -uTime * .07)));
    col += uFoam * motes * .22;
    // bright wavy surface line
    float wav = sin(vX * 17. + uTime * 2.1) * .004 + sin(vX * 7.3 - uTime * 1.3) * .003;
    float line = 1. - smoothstep(0., .01, abs((vWorld.y - uWaterY) - wav));
    col = mix(col, uFoam, line * .9);
    // sandy bed
    float sand = 1. - smoothstep(.05, .38, t);
    vec3 sandCol = uSand * (.62 + vnoise(vWorld.xy * 16.) * .3);
    float rippleMark = smoothstep(.55, .9, vnoise(vec2(vWorld.x * 9., vWorld.y * 70.)));
    sandCol *= .85 + rippleMark * .3;
    sandCol *= 1. - smoothstep(.10, .01, t) * .35;
    col = mix(col, sandCol, sand * .97);
    // ice band along the top
    float iceBand = smoothstep(1. - .028 - uIce * .075, 1., t) * step(.004, uIce);
    col = mix(col, uIceCol * (.9 + vnoise(vWorld.xy * 24.) * .2), iceBand);
    float crack = 1. - smoothstep(0., .003, abs(vnoise(vWorld.xy * 44.) - .5));
    col *= 1. - crack * iceBand * .55;
    col = mix(col, vec3(.88, .91, .94), smoothstep(.6, .95, vnoise(vWorld.xy * 21.)) * uSnow * iceBand);
    // frozen through: pale ice body with dark cracks and trapped bubbles
    vec3 iceBody = uIceCol * (.95 + vnoise(vWorld.xy * 18.) * .12);
    float bodyCrack = 1. - smoothstep(0., .012, abs(vnoise(vWorld.xy * 22. + 5.) - .5));
    iceBody = mix(iceBody, uIceCol * .44, bodyCrack * .75);
    iceBody += uFoam * step(.9, vnoise(vWorld.xy * 40.)) * .4;
    col = mix(col, iceBody, uIce * .96);
    col = mix(col, vec3(.9, .93, .95), uSnow * uIce * .25 * smoothstep(.4, .9, vnoise(vWorld.xy * 9.)));
    // waterline foam nibs
    float nib = smoothstep(.9, 1., vnoise(vWorld.xy * 39. + uTime * .2)) * smoothstep(.0, .04, 1. - abs(vWorld.y - uWaterY));
    col = mix(col, uFoam, nib * .35);
    col *= 1. - uNight * .5;
    col = mix(col, vec3(.19, .26, .24), uMurk * .3);
    col += uFlash * vec3(.04, .05, .06);
    float a = .58 + smoothstep(0., .6, depth) * .25;
    a = mix(a, .97, uIce);
    a = mix(a, .92, sand);
    a = max(a, line * .97);
    a = mix(a, .97, iceBand);
    // fade at side edges so the slice does not show hard seams
    float sideFade = smoothstep(0., .09, vT) * smoothstep(0., .07, min(vX - ${(CX - RX * .78).toFixed(3)}, ${(CX + RX * .78).toFixed(3)} - vX));

    gl_FragColor = vec4(col, clamp(a * sideFade, 0., .97));
    #include <fog_fragment>
  }`;
}

/* ---------- river ---------- */
function buildRiver() {
  const pos = [], centre = [], bank = [], steps = [], flowT = [], halfW = [], idx = [];
  const COLS = 4;
  let prevLevel = null;
  for (let i = 0; i <= N_RIVER; i++) {
    const t = i / N_RIVER;
    const [cx, cz] = riverCenterAt(t);
    const [c2x, c2z] = riverCenterAt(Math.min(1, t + .01));
    let tx = c2x - cx, tz = c2z - cz;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = -tz, nz = tx;
    const hw = riverHalfWidth(t);
    let level = riverSurface(t) + (waterY - .1) * .9;
    if (t > .84) level = U.lerp(level, waterY, (t - .84) / .16);
    let stepK = 0;
    if (prevLevel !== null) stepK = Math.max(0, prevLevel - level) > .035 ? 1 : 0;
    prevLevel = level;
    for (let s2 = 0; s2 < COLS; s2++) {
      const u = s2 / (COLS - 1);
      const off = u * 2 - 1;
      pos.push(cx + nx * hw * off, level, cz + nz * hw * off);
      centre.push(cx, cz);
      bank.push(Math.abs(off));
      steps.push(stepK);
      flowT.push(t);
      halfW.push(hw);
    }
    if (i > 0) {
      const a = (i - 1) * COLS, b = i * COLS;
      for (let k = 0; k < COLS - 1; k++) idx.push(a + k, b + k, a + k + 1, b + k, b + k + 1, a + k + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCentre', new THREE.Float32BufferAttribute(centre, 2));
  g.setAttribute('aBank', new THREE.Float32BufferAttribute(bank, 1));
  g.setAttribute('aStep', new THREE.Float32BufferAttribute(steps, 1));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flowT, 1));
  g.setAttribute('aHalfW', new THREE.Float32BufferAttribute(halfW, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
function riverVert() {
  return `
  attribute vec2 aCentre; attribute float aBank, aStep, aFlow, aHalfW;
  ${RING_UNIFORMS}
  uniform float uSwell, uWaterY;
  varying vec3 vWorld; varying vec2 vXZ; varying float vBank, vStep, vFlow, vHalf;
  #include <fog_pars_vertex>
  void main(){
    vec3 p = position;
    vec2 c = aCentre;
    vec2 dir = normalize(p.xz - c + vec2(.0001));
    p.xz = c + dir * (aHalfW * uSwell);
    p.xz += dir * aBank * aHalfW * (uSwell - 1.) * .5;
    p.y += uWaterY * 0.;
    vWorld = (modelMatrix * vec4(p,1.)).xyz;
    vXZ = vWorld.xz;
    vBank = aBank; vStep = aStep; vFlow = aFlow; vHalf = aHalfW;
    vec4 mvPosition = modelViewMatrix * vec4(p,1.);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
}
function riverFrag() {
  return `
  ${RING_UNIFORMS}
  uniform float uWind, uIce, uSnow, uRain, uMurk, uNight, uSunVis, uFlash, uFlow, uSwell, uWaterY;
  uniform vec3 uSunDir, uSunCol, uDeep, uShallow, uFoam, uIceCol;
  uniform vec2 uWindDir;
  varying vec3 vWorld; varying vec2 vXZ; varying float vBank, vStep, vFlow, vHalf;
  ${NOISE}
  ${RING_FN}
  #include <fog_pars_fragment>
  void main(){
    float edge = mix(.0, 1., vBank);
    vec2 p = vXZ;
    float flow = uFlow * (1. + uRain * .7);
    float t = uTime;
    vec3 N = vec3(0.,1.,0.);
    N.xz += (vec2(vnoise(p * 7. + vec2(0., t * flow * 1.4)), vnoise(p * 7. + vec2(3., t * flow * 1.4))) - .5) * .8 * uWind;
    N.xz += (vec2(vnoise(p * 19. - vec2(0., t * flow * 2.)), vnoise(p * 19. + 7.)) - .5) * .35;
    N = normalize(N);
    vec3 col = mix(uShallow * 1.05, uDeep * 1.1, .12 + .4 * smoothstep(.15, 1., vBank));
    // travelling downstream ripples
    float rip = vnoise(vec2(p.x * 13., p.y * 5.5 - t * flow * 2.6 + vFlow * 40.));
    float rip2 = vnoise(vec2(p.x * 27., p.y * 11. - t * flow * 4.2 + 12.));
    col += uFoam * (smoothstep(.6, .85, rip) * .16 + smoothstep(.7, .95, rip2) * .1);
    // sun sheen
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(uSunDir + V);
    col += uSunCol * pow(max(dot(N,H),0.), 150.) * 2.2 * uSunVis;
    col += uSunCol * .05 * uSunVis;
    // foam on steps and at the mouth; bubbles
    float stepFoam = vStep * smoothstep(.4, .88, vnoise(vec2(p.x * 30., p.y * 7. - t * flow * 3.2)));
    float sideFoam = smoothstep(.88, 1., vBank) * .3;
    float foam = clamp(stepFoam * .85 + sideFoam + smoothstep(.9, .99, vnoise(p * 30. + t * .4)) * .18, 0., 1.);
    col = mix(col, uFoam, foam * (1. - uIce * .8));
    // ice from the banks
    float thr = 1. - uIce * 1.25 + (vnoise(p * 9.) - .5) * .15;
    float ice = smoothstep(thr - .04, thr + .05, vBank);
    col = mix(col, uIceCol * (.92 + vnoise(p * 22.) * .16), ice);
    float crack = 1. - smoothstep(0., .02, abs(vnoise(p * 18.) - .5));
    col = mix(col, uIceCol * .5, crack * ice * .7);
    col = mix(col, vec3(.86,.9,.93), smoothstep(.5,.9,vnoise(p*11.)) * uSnow * ice);
    col *= 1. - uNight * .5;
    col = mix(col, vec3(.2,.26,.24), uMurk * .3);
    col += uFlash * vec3(.04,.05,.06);
    float a = mix(.78, .95, ice) + foam * .05;
    a = mix(a, .35, smoothstep(.9, 1., vBank) * ice * .2);
    gl_FragColor = vec4(col, clamp(a, .18, .98));
    #include <fog_fragment>
  }`;
}

/* ---------- waterfall strands / tongue / pool ---------- */
function buildStrand(width, phase, offset, top, bottom, zTop, zBot) {
  const segs = 9;
  const pos = [], along = [], side = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = U.lerp(top, bottom, t);
    const z = U.lerp(zTop, zBot, t) + Math.sin(t * 3.1 + phase) * .02;
    const w = width * U.lerp(.55, 1.1, t);
    pos.push(offset - w * .5, y, z, offset + w * .5, y, z);
    along.push(t, t); side.push(-1, 1);
    if (i > 0) {
      const a = (i - 1) * 2, b = i * 2;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Array((segs + 1) * 2).fill(phase), 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
function strandVert() {
  return `
  attribute float aAlong, aSide, aPhase;
  uniform float uTime, uWind, uSwell, uFlow;
  varying vec2 vUv; varying float vBank;
  ${NOISE}
  #include <fog_pars_vertex>
  void main(){
    vec3 p = position;
    p.x += (aSide) * (uSwell - 1.) * .06;
    float flut = (vnoise(vec2(aPhase * 4., uTime * 1.6)) - .5) * uWind * .05;
    p.x += flut * (p.y > 1.5 ? 1. : .4) * sin(aAlong * 6. + uTime * 3. + aPhase);
    p.z += sin(aPhase * 5. + uTime * 2.3) * .012 * uWind;
    vUv = vec2(aSide*.5+.5, aAlong);
    vBank = 1.;
    vec4 mvPosition = modelViewMatrix * vec4(p,1.);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
}
function strandFrag() {
  return `
  uniform float uTime, uFlow, uIce, uSnow, uNight, uSunVis, uFlash;
  uniform vec3 uFoam, uSunCol, uIceCol;
  varying vec2 vUv; varying float vBank;
  ${NOISE}
  #include <fog_pars_fragment>
  void main(){
    float flow = uFlow * 1.2;
    float n = vnoise(vec2(vUv.x * 7., vUv.y * 22. - uTime * flow * 4.));
    float n2 = vnoise(vec2(vUv.x * 18., vUv.y * 46. - uTime * flow * 7. + 12.));
    float streak = smoothstep(.42, .72, n * .7 + n2 * .45);
    float sideFade = smoothstep(0., .18, vUv.x) * (1. - smoothstep(.82, 1., vUv.x));
    float vertFade = smoothstep(0., .08, vUv.y) * (1. - smoothstep(.93, 1., vUv.y));
    vec3 col = mix(uFoam * .78, uFoam, streak);
    col += uSunCol * streak * .25 * uSunVis;
    float a = (.35 + streak * .6) * sideFade * vertFade;
    // ice curtain
    vec3 iceCol = uIceCol * (.9 + n * .2);
    col = mix(col, iceCol, uIce);
    a = mix(a, (.55 + n * .3) * sideFade * (1. - smoothstep(.8, 1., vUv.y)), uIce);
    float ragged = 1. - smoothstep(0., .24, vUv.y - .16 + vnoise(vec2(vUv.x * 9., 2.)) * .2);
    a *= mix(1., .35 + ragged, uIce * .8);
    col = mix(col, vec3(.9,.93,.95), smoothstep(.55,.9,n) * uSnow * uIce);
    col *= 1. - uNight * .45;
    col += uFlash * .06;
    gl_FragColor = vec4(col, clamp(a, 0., .92));
    #include <fog_fragment>
  }`;
}
function poolVert() {
  return `
  varying vec2 vXZ; varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main(){
    vec4 wp = modelMatrix * vec4(position,1.);
    vWorld = wp.xyz; vXZ = wp.xz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
}
function poolFrag() {
  return `
  ${RING_UNIFORMS}
  uniform float uWind, uIce, uSnow, uNight, uSunVis, uFlow, uFlash, uWaterY;
  uniform vec3 uSunDir, uSunCol, uFoam, uIceCol, uShallow;
  uniform vec2 uWindDir;
  varying vec2 vXZ; varying vec3 vWorld;
  ${NOISE}
  ${RING_FN}
  #include <fog_pars_fragment>
  void main(){
    vec2 p = vXZ;
    float rad = length(p - vec2(${POOLX}, ${POOLZ}));
    float churn = vnoise(p * 22. + vec2(0., uTime * uFlow * 1.6));
    float churn2 = vnoise(p * 41. - vec2(uTime * .4, uTime * uFlow * 2.4));
    float foam = smoothstep(.5, .86, churn * .65 + churn2 * .5);
    foam = max(foam, (1. - smoothstep(.04, .36, rad)) * .55);
    float ringF = smoothstep(.18, .58, ringHeight(p) * 24.);
    foam = clamp(foam * .9 + ringF * .16, 0., 1.);
    vec3 col = mix(uShallow * .72, uFoam, foam);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(uSunDir + V);
    col += uSunCol * pow(max(dot(vec3(0.,1.,0.), H), 0.), 40.) * foam * .4 * uSunVis;
    col = mix(col, uIceCol * (.9 + churn * .2), uIce);
    col = mix(col, vec3(.9,.93,.95), smoothstep(.3,.8,vnoise(p*13.)) * uSnow * (uIce * .9 + .25));
    float crack = 1. - smoothstep(0., .03, abs(vnoise(p * 14.) - .5));
    col *= 1. - crack * uIce * .4;
    col *= 1. - uNight * .5;
    col += uFlash * .07;
    float a = mix(.76, .96, foam);
    a = mix(a, .97, uIce);
    float rim = 1. - smoothstep(.52, .62, rad);
    gl_FragColor = vec4(col, a * (.55 + rim * .45));
    #include <fog_fragment>
  }`;
}
function tongueVert() {
  return `
  varying vec2 vUv; varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main(){
    vUv = uv; vec4 wp = modelMatrix * vec4(position,1.); vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
}
function tongueFrag() {
  return `
  uniform float uTime, uFlow, uIce, uNight, uSunVis, uFlash;
  uniform vec3 uSkyCol, uFoam, uIceCol;
  varying vec2 vUv; varying vec3 vWorld;
  ${NOISE}
  #include <fog_pars_fragment>
  void main(){
    float n = vnoise(vec2(vUv.x * 9., vUv.y * 15. - uTime * uFlow * 2.2));
    vec3 col = vec3(.025, .06, .07) + uSkyCol * .12;
    col += uFoam * smoothstep(.74, .97, n) * .22;
    vec3 V = normalize(cameraPosition - vWorld);
    col += uSkyCol * pow(1. - max(V.y, 0.), 3.) * .28;
    col += uSunVis * vec3(.10,.09,.07) * smoothstep(.8,.98,n);
    col = mix(col, uIceCol * (.85 + n * .2), uIce * .85);
    col *= 1. - uNight * .4;
    col += uFlash * .08;
    gl_FragColor = vec4(col, mix(.9, .96, uIce));
    #include <fog_fragment>
  }`;
}

/* ---------- particles ---------- */
function makePoints(count, size, color, opacity, additive) {
  const pos = new Float32Array(count * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    map: WG.tex.glow, size, sizeAttenuation: true, transparent: true, depthWrite: false,
    color: WG.col(color), opacity, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 8;
  group.add(p);
  return p;
}
const sprayVel = [], bubbleVel = [], splashVel = [], splashLife = [];
let spray, bubbles, specks, splashes, splashIdx = 0, mistGroup, mistSprites = [];

/* ---------- fish ---------- */
function fishGeometry(orange) {
  const g = new THREE.SphereGeometry(1, 9, 6);
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const cBack = new THREE.Color(orange ? '#7d2f12' : '#2f3d40');
  const cMid = new THREE.Color(orange ? '#d17a38' : '#c6d0cf');
  const cBelly = new THREE.Color(orange ? '#f0d9b8' : '#e8eeea');
  const cPatch = new THREE.Color('#f2e5c8');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    let c = cMid.clone();
    if (y > .18) c.lerp(cBack, U.clamp01((y - .18) / .7));
    if (y < -.25) c.lerp(cBelly, U.clamp01((-y - .25) / .55));
    if (orange && Math.sin(z * 38 + y * 21) > .45) c.lerp(cPatch, .8);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.scale(.045, .036, .105);
  return g;
}
function makeFish(i) {
  const orange = i % 3 === 2;
  const grp = new THREE.Group();
  const mat = fishMat(orange);
  const body = new THREE.Mesh(fishGeometry(orange), mat);
  grp.add(body);
  const eyeGeo = new THREE.SphereGeometry(.0085, 6, 4);
  const e1 = new THREE.Mesh(eyeGeo, eyeMat), e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(.031, .011, .072); e2.position.set(-.031, .011, .072);
  grp.add(e1, e2);
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .015, 0, .045, -.075, 0, -.04, -.07], 3));
  tailGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(9).fill(0), 3));
  const tc = new THREE.Color(orange ? '#c27534' : '#9fb0af');
  const ta = tailGeo.attributes.color;
  for (let k = 0; k < 3; k++) { ta.setXYZ(k, tc.r, tc.g, tc.b); }
  tailGeo.computeVertexNormals();
  const tail = new THREE.Mesh(tailGeo, mat);
  tail.position.z = -.085;
  grp.add(tail);
  grp.renderOrder = 5;
  grp.scale.setScalar(.85 + R() * .4);
  group.add(grp);
  return { grp, tail, body };
}
let fishMats = null;
function fishMat(orange) {
  if (!fishMats) {
    fishMats = {
      silver: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .5, roughness: .32, envMap: WG.env && WG.env.tex, envMapIntensity: .8, side: THREE.DoubleSide }),
      orange: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .35, roughness: .38, envMap: WG.env && WG.env.tex, envMapIntensity: .7, side: THREE.DoubleSide })
    };
  }
  return orange ? fishMats.orange : fishMats.silver;
}

/* ---------- cross-section sand backing ---------- */
let sandTex = null, sandMat = null, bedBacking = null, bedPebbles = null;
function makeSandTex() {
  return WG.canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#bda481'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = 130 + Math.random() * 80;
      g.fillStyle = `rgba(${v},${v * .88},${v * .68},${.2 + Math.random() * .5})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
    }
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * h;
      g.strokeStyle = `rgba(${80 + Math.random() * 40},${66 + Math.random() * 30},50,.4)`;
      g.lineWidth = .8 + Math.random();
      g.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const yy = y + Math.sin(x / 22 + i) * 2.2 + Math.sin(x / 7 + i * 2) * .8;
        x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
      }
      g.stroke();
    }
    for (let i = 0; i < 16; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 3;
      g.fillStyle = `rgba(${90 + Math.random() * 50},${88 + Math.random() * 40},${80 + Math.random() * 30},.85)`;
      g.beginPath(); g.ellipse(x, y, r * 1.4, r, Math.random(), 0, 7); g.fill();
    }
  });
}
function buildBedBacking() {
  const z = BACKZ;
  const zc = CROSSZ;
  const dz = (zc - CZ) / RZ;
  const half = RX * Math.sqrt(Math.max(0.02, 1 - dz * dz)) * .97;
  const cols = [], beds = [], pos = [], uv = [], idx = [];
  const rows = 2;
  for (let i = 0; i <= N_CROSS; i++) {
    const x = CX - half + 2 * half * (i / N_CROSS);
    cols.push(x); beds.push(bedAt(x, z - .02));
  }
  for (let c = 0; c <= N_CROSS; c++) {
    for (let r = 0; r <= rows; r++) {
      pos.push(cols[c], 0, z);
      uv.push(c / N_CROSS * 3, r / rows);
    }
  }
  for (let c = 0; c < N_CROSS; c++) for (let r = 0; r < rows; r++) {
    const a = c * (rows + 1) + r, b = (c + 1) * (rows + 1) + r;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.cols = cols; g.userData.beds = beds; g.userData.rows = rows;
  return g;
}
function updateBedBacking(mesh) {
  const g = mesh.geometry, beds = g.userData.beds, cols = g.userData.cols, rows = g.userData.rows;
  const arr = g.attributes.position.array;
  let p = 0;
  for (let c = 0; c < cols.length; c++) {
    const b = Math.min(beds[c], waterY - .045);
    for (let r = 0; r <= rows; r++) { arr[p * 3 + 1] = b + (r / rows) * .12; p++; }
  }
  g.attributes.position.needsUpdate = true;
}

/* ---------- build all ---------- */
let lakeMesh, crossMesh, riverMesh, poolMesh, tongueMesh, curtainMesh;
let fallsGroup, poolGroup, stoneGroup, boulderGroup, icicleGroup, snowMound, pebbleGroup;
let built = false;

function build() {
  buildMaterials();

  /* lake */
  lakeMat = mkMat(lakeVert(), lakeFrag());
  lakeMesh = new THREE.Mesh(buildLakeSurface(), lakeMat);
  lakeMesh.renderOrder = 3;
  lakeMesh.name = 'lakeSurface';
  lakeMesh.userData.kind = 'water';
  lakeMesh.frustumCulled = false;
  group.add(lakeMesh);
  WG_.surface = lakeMesh;

  /* cross-section */
  crossMat = mkMat(crossVert(), crossFrag());
  crossMesh = new THREE.Mesh(buildCrossSection(), crossMat);
  crossMesh.renderOrder = 7;
  crossMesh.frustumCulled = false;
  crossMesh.userData.kind = 'waterCross';
  crossMesh.name = 'crossSection';
  group.add(crossMesh);
  sandTex = makeSandTex();
  sandMat = new THREE.MeshStandardMaterial({ map: sandTex, color: WG.col('#9c8464'), roughness: .92, metalness: 0 });
  bedBacking = new THREE.Mesh(buildBedBacking(), sandMat);
  bedBacking.name = 'bedBacking';
  bedBacking.renderOrder = 5;
  bedBacking.frustumCulled = false;
  bedBacking.visible = false;
  group.add(bedBacking);
  bedPebbles = new THREE.Group();
  const bpg = new THREE.DodecahedronGeometry(1, 0);
  const bpm = new THREE.InstancedMesh(bpg, pebbleMat, 14);
  for (let i = 0; i < 14; i++) {
    const x = SLICE_X0 + .08 + R() * (SLICE_X1 - SLICE_X0 - .16);
    const bed = sliceBedY(x);
    const m4b = new THREE.Matrix4();
    m4b.compose(new THREE.Vector3(x, bed + .018, CROSSZ - .0025),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3)),
      new THREE.Vector3(.018 + R() * .025, .012 + R() * .014, .016 + R() * .02));
    bpm.setMatrixAt(i, m4b);
    bpm.userData.beds = bpm.userData.beds || [];
    bpm.userData.beds.push(bed);
  }
  bpm.frustumCulled = false;
  bedPebbles.add(bpm);
  bedPebbles.name = 'bedPebbles';
  bedPebbles.renderOrder = 5;
  group.add(bedPebbles);

  /* river */
  riverMat = mkMat(riverVert(), riverFrag());
  riverMesh = new THREE.Mesh(buildRiver(), riverMat);
  riverMesh.renderOrder = 3;
  riverMesh.userData.kind = 'water';
  riverMesh.name = 'river';
  group.add(riverMesh);

  /* pool */
  poolMat = mkMat(poolVert(), poolFrag());
  const poolGeo = new THREE.CircleGeometry(.62, 26);
  poolGeo.rotateX(-Math.PI / 2);
  poolMesh = new THREE.Mesh(poolGeo, poolMat);
  poolMesh.position.set(POOLX, 1.06, POOLZ);
  poolMesh.renderOrder = 4;
  poolMesh.name = 'pool';
  group.add(poolMesh);

  /* waterfall */
  fallsGroup = new THREE.Group(); fallsGroup.name = 'falls'; poolGroup = new THREE.Group(); poolGroup.name = 'poolGroup';
  fallsGroup.position.x = -1.5;
  group.add(fallsGroup, poolGroup);
  const tongueGeo = new THREE.PlaneGeometry(.23, 1, 4, 8);
  tongueMesh = new THREE.Mesh(tongueGeo, mkMat(tongueVert(), tongueFrag(), null, { side: THREE.DoubleSide }));
  tongueMesh.renderOrder = 6;
  fallsGroup.add(tongueMesh);
  strandMat = mkMat(strandVert(), strandFrag(), null, { side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const strands = [];
  const strandDefs = [[.03, .4, -.09], [.045, 1.7, -.035], [.034, 3.2, .02], [.05, 4.4, .07], [.03, 5.6, .115]];
  for (const [w, ph, off] of strandDefs) {
    const s = new THREE.Mesh(buildStrand(w, ph, off, 0, -1, 0, 0), strandMat);
    s.renderOrder = 7;
    strands.push(s); fallsGroup.add(s);
  }
  // ice curtain mesh (wider sheet)
  curtainMesh = new THREE.Mesh(buildStrand(.43, 2.2, .01, 0, -1, 0, 0), strandMat);
  curtainMesh.renderOrder = 7;
  curtainMesh.visible = false;
  fallsGroup.add(curtainMesh);
  // icicles
  icicleGroup = new THREE.Group(); fallsGroup.add(icicleGroup);
  const icMat = new THREE.MeshStandardMaterial({ color: WG.col('#dbe5ea'), roughness: .25, metalness: .05, transparent: true, opacity: .9, envMap: WG.env && WG.env.tex });
  for (let i = 0; i < 8; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.012 + R() * .012, .12 + R() * .17, 5), icMat);
    cone.position.set(-.16 + i * .045, 0, -.02 + R() * .05);
    cone.rotation.x = Math.PI;
    cone.scale.y = .001;
    icicleGroup.add(cone);
  }
  // boulders round the pool
  boulderGroup = new THREE.Group(); poolGroup.add(boulderGroup);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + .4;
    const rr = .56 + R() * .22;
    const s = .055 + R() * .075;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), wetRockMat);
    rock.position.set(POOLX + Math.cos(a) * rr, 0, POOLZ + Math.sin(a) * rr);
    rock.rotation.set(R() * 2, R() * 3, R() * 2);
    rock.scale.y = .62 + R() * .3;
    boulderGroup.add(rock);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(s * .92, 6, 4, 0, TAU, 0, 1.1), mossMat);
    moss.position.copy(rock.position); moss.position.y += s * .18;
    moss.rotation.z = rock.rotation.z;
    moss.scale.set(1, .38, 1);
    boulderGroup.add(moss);
  }
  // snow mound over pool (grows with freeze)
  snowMound = new THREE.Mesh(new THREE.SphereGeometry(.55, 16, 7, 0, TAU, 0, Math.PI / 2), snowMat);
  snowMound.scale.set(1, .34, 1);
  snowMound.visible = false;
  poolGroup.add(snowMound);

  /* stepping stones */
  stoneGroup = new THREE.Group(); group.add(stoneGroup);
  const st = riverCenterAt(.4);
  const stNext = riverCenterAt(.43);
  const ang = Math.atan2(stNext[1] - st[1], stNext[0] - st[0]);
  const perp = ang + Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const o = (i - 2) * .085 + (R() - .5) * .02;
    const x = st[0] + Math.cos(perp) * o, z = st[1] + Math.sin(perp) * o;
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(.082 + R() * .018, .092, .035, 7), pebbleMat);
    stone.position.set(x, riverSurface(.4) + (waterY - .1) * .9 + .02, z);
    stone.scale.x = 1.25; stone.scale.z = 1.05;
    stone.rotation.y = R() * 3;
    stoneGroup.add(stone);
    const moss = new THREE.Mesh(new THREE.CylinderGeometry(.066, .066, .01, 7), mossMat);
    moss.position.set(x, stone.position.y + .025, z);
    moss.scale.x = 1.25; moss.scale.z = 1.05;
    stoneGroup.add(moss);
  }
  /* pebbles along the banks */
  const pebGeo = new THREE.DodecahedronGeometry(1, 0);
  const pebCount = [14, 22, 30][QL];
  const pebbles = new THREE.InstancedMesh(pebGeo, pebbleMat, pebCount);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let i = 0; i < pebCount; i++) {
    const t = .06 + R() * .9;
    const c = riverCenterAt(t);
    const hw = riverHalfWidth(t);
    const side = R() < .5 ? -1 : 1;
    const off = hw + .035 + R() * .11;
    const x = c[0] + side * off + (R() - .5) * .05, z = c[1] + side * off * .4 + (R() - .5) * .05;
    const y = riverSurface(t) + (waterY - .1) * .9 + .005;
    const s = .014 + R() * .022;
    e4.set(R() * 3, R() * 3, R() * 3); q4.setFromEuler(e4);
    sv.set(s * (1 + R() * .5), s * .6, s);
    pv.set(x, y, z);
    m4.compose(pv, q4, sv);
    pebbles.setMatrixAt(i, m4);
  }
  pebbles.frustumCulled = false;
  pebbleGroup = new THREE.Group();
  pebbleGroup.add(pebbles);
  group.add(pebbleGroup);

  /* fish */
  for (let i = 0; i < N_FISH; i++) {
    const f = makeFish(i);
    const pos = new THREE.Vector3(1.7 + R() * 2.1, waterY - .22, 3.45 + R() * .35);
    const dir = new THREE.Vector3(R() - .5, 0, R() - .5).normalize();
    const obj = {
      pos, dir, speed: .14 + R() * .06, baseSpeed: .14 + R() * .06,
      mesh: f.grp, tail: f.tail, phase: R() * TAU, tailRate: 8 + R() * 3,
      alarm: 0, rise: 4 + R() * 9, rising: 0, jitter: new THREE.Vector3()
    };
    WG_.fish.push(obj);
    f.grp.position.copy(pos);
    group.add(f.grp);
  }

  /* particles */
  spray = makePoints(N_SPRAY, .035, '#dfeef0', .8, true); spray.name = 'spray';
  bubbles = makePoints(N_BUBBLE, .014, '#eef7f5', .55, true); bubbles.name = 'bubbles';
  specks = makePoints(N_SPECK, .0075, '#dbe8e3', .16, true); specks.name = 'specks';
  splashes = makePoints(N_SPLASH, .045, '#f2fbfb', .9, true); splashes.name = 'splashes';
  for (let i = 0; i < N_SPRAY; i++) {
    sprayVel.push(new THREE.Vector3());
    spray.geometry.attributes.position.array[i * 3 + 1] = -99;
  }
  for (let i = 0; i < N_BUBBLE; i++) {
    bubbleVel.push(new THREE.Vector3());
    bubbles.geometry.attributes.position.array[i * 3 + 1] = -99;
    bubbles.geometry.attributes.position.array[i * 3] = -99;
  }
  for (let i = 0; i < N_SPECK; i++) {
    specks.geometry.attributes.position.array[i * 3 + 1] = -99;
  }
  for (let i = 0; i < N_SPLASH; i++) {
    splashVel.push(new THREE.Vector3());
    splashLife.push(0);
    splashes.geometry.attributes.position.array[i * 3] = -99;
    splashes.geometry.attributes.position.array[i * 3 + 1] = -99;
  }
  spray.renderOrder = bubbles.renderOrder = specks.renderOrder = splashes.renderOrder = 8;

  mistGroup = new THREE.Group();
  mistGroup.renderOrder = 9;
  group.add(mistGroup);
  const mistMat = new THREE.SpriteMaterial({ map: WG.tex.glow, color: WG.col('#e6f0ef'), transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < N_MIST; i++) {
    const s = new THREE.Sprite(mistMat.clone());
    s.scale.setScalar(.55 + R() * .5);
    s.position.set(POOLX + (R() - .5) * .7, 1.15 + R() * .25, POOLZ + (R() - .5) * .5);
    s.userData = { ox: s.position.x, oz: s.position.z, ph: R() * TAU, sp: .12 + R() * .2 };
    mistGroup.add(s); mistSprites.push(s);
  }

  /* cross-section specks */
  resetSpecks();

  /* reflection target */
  if (Q.reflections) {
    reflRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: true, format: THREE.RGBAFormat });
    reflRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
    reflectCam = new THREE.PerspectiveCamera();
    clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -S.waterY);
    for (const u of allUniformSets) {
      if (u.tRefl) u.tRefl.value = reflRT.texture;
      if (u.uRefl) u.uRefl.value = 1;
    }
  }
  built = true;
}

/* ---------- cross-section specks ---------- */
function resetSpecks() {
  const a = specks.geometry.attributes.position.array;
  for (let i = 0; i < N_SPECK; i++) {
    const x = 1.35 + R() * 2.95;
    const bed = bedAt(x, 3.9);
    a[i * 3] = x;
    a[i * 3 + 1] = U.lerp(bed + .08, waterY - .12, R());
    a[i * 3 + 2] = 3.62 + R() * .3;
  }
  specks.geometry.attributes.position.needsUpdate = true;
}

/* ---------- ring / splash ---------- */
function addRing(x, z, strength, quiet) {
  if (!built) return;
  if (!(lakeInside(x, z) || nearRiver(x, z) || Math.hypot(x - POOLX, z - POOLZ) < .7)) return;
  const st = U.clamp(+strength || .4, .05, 1.2);
  ringSerial++;
  let slot;
  if (rings.length < N_LAKE_RIPPLES) { slot = { x, z, t0: timeNow, s: st, id: ringSerial }; rings.push(slot); }
  else { slot = rings[ringHead % rings.length]; slot.x = x; slot.z = z; slot.t0 = timeNow; slot.s = st; slot.id = ringSerial; }
  ringHead++;
  if (!quiet) WG.emit('water:ring', { x, z, strength: st });
}
function addSplash(x, z, strength) {
  if (!built) return;
  const st = U.clamp(+strength || .6, .1, 1.4);
  addRing(x, z, st);
  addRing(x + (R() - .5) * .12, z + (R() - .5) * .12, st * .5, true);
  const n = Math.min(30, Math.round(8 + st * (N_SPLASH / 60) * 26));
  const pos = splashes.geometry.attributes.position.array;
  for (let k = 0; k < n; k++) {
    const i = splashIdx++ % N_SPLASH;
    const a = R() * TAU, sp = .05 + R() * .28 * st;
    pos[i * 3] = x + Math.cos(a) * .02;
    pos[i * 3 + 1] = waterY + .01;
    pos[i * 3 + 2] = z + Math.sin(a) * .02;
    splashVel[i].set(Math.cos(a) * sp, .55 + R() * .75 * st, Math.sin(a) * sp);
    splashLife[i] = .5 + R() * .55;
  }
  splashes.geometry.attributes.position.needsUpdate = true;
  // mist puff
  for (let i = 0; i < mistSprites.length; i++) {
    const m = mistSprites[i];
    if (m.userData.puff > 0) continue;
    m.userData.puff = .8 + R() * .4;
    m.userData.px = x + (R() - .5) * .2; m.userData.pz = z + (R() - .5) * .2;
    m.userData.py = waterY + .04;
    break;
  }
  // fish bolt
  for (const f of WG_.fish) {
    const d = Math.hypot(f.pos.x - x, f.pos.z - z);
    if (d < 1.7) {
      f.alarm = 1.4 + R() * .8;
      f.dir.set(f.pos.x - x, 0, f.pos.z - z).normalize();
      if (!isFinite(f.dir.x) || (f.dir.x === 0 && f.dir.z === 0)) f.dir.set(1, 0, 0);
    }
  }
  WG.emit('water:splash', { x, z, strength: st });
}

/* ---------- reflection ---------- */
let reflRT = null, reflectCam = null, clipPlane = null;
const biasMat = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
const reflMatrix = new THREE.Matrix4();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const frustum = new THREE.Frustum(), projScreen = new THREE.Matrix4();
const lakeSphere = new THREE.Sphere(new THREE.Vector3(CX, .5, CZ), 3.2);

function renderReflection() {
  if (!reflRT || !lakeMesh) return;
  const renderer = WG.renderer, camera = WG.camera;
  projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreen);
  if (!frustum.intersectsSphere(lakeSphere)) return;
  const wy = waterY;
  if (camera.position.y < wy + .05) return;
  const db = renderer.getDrawingBufferSize(_v2);
  const w = Math.max(48, Math.floor(db.x * .5)), h = Math.max(32, Math.floor(db.y * .5));
  if (reflRT.width !== w || reflRT.height !== h) reflRT.setSize(w, h);
  camera.getWorldDirection(_v1);
  reflectCam.position.set(camera.position.x, 2 * wy - camera.position.y, camera.position.z);
  _v1.y *= -1;
  _v2.copy(reflectCam.position).add(_v1);
  reflectCam.up.set(camera.up.x, -camera.up.y, camera.up.z);
  reflectCam.lookAt(_v2);
  reflectCam.near = camera.near; reflectCam.far = camera.far;
  reflectCam.fov = camera.fov; reflectCam.aspect = camera.aspect;
  reflectCam.updateProjectionMatrix();
  reflectCam.updateMatrixWorld(true);
  reflMatrix.multiplyMatrices(biasMat, reflectCam.projectionMatrix).multiply(reflectCam.matrixWorldInverse);
  clipPlane.constant = -wy;
  const prevClip = renderer.clippingPlanes, prevAuto = renderer.shadowMap.autoUpdate;
  renderer.clippingPlanes = [clipPlane];
  renderer.shadowMap.autoUpdate = false;
  group.visible = false;
  renderer.setRenderTarget(reflRT);
  renderer.clear();
  renderer.render(WG.scene, reflectCam);
  renderer.setRenderTarget(null);
  group.visible = true;
  renderer.clippingPlanes = prevClip;
  renderer.shadowMap.autoUpdate = prevAuto;
  for (const u of allUniformSets) if (u.uReflMat) u.uReflMat.value.copy(reflMatrix);
}

/* ---------- per-frame ---------- */
let bubbleTimer = 0;
function updateParticles(dt) {
  const pa = spray.geometry.attributes.position.array;
  const flowK = U.clamp(S.flow, .7, 2.2) * (1 + S.rain * .7);
  for (let i = 0; i < N_SPRAY; i++) {
    const v = sprayVel[i];
    if (pa[i * 3 + 1] < waterY - .02 || pa[i * 3 + 1] < 0) {
      // respawn at impact
      const a = R() * TAU, rr = R() * .2;
      pa[i * 3] = POOLX + Math.cos(a) * rr;
      pa[i * 3 + 1] = waterY + .02;
      pa[i * 3 + 2] = POOLZ + Math.sin(a) * rr - .06;
      v.set((R() - .5) * .26, .35 + R() * .5, (R() - .5) * .22 + .05);
    } else {
      v.y -= 2.4 * dt;
      pa[i * 3] += v.x * dt; pa[i * 3 + 1] += v.y * dt; pa[i * 3 + 2] += v.z * dt;
      if (pa[i * 3 + 1] < waterY - .01) v.y *= .4;
    }
  }
  spray.geometry.attributes.position.needsUpdate = true;
  spray.material.opacity = .45 + Math.min(1, flowK) * .4;

  // bubbles
  const ba = bubbles.geometry.attributes.position.array;
  bubbleTimer -= dt * flowK;
  for (let i = 0; i < N_BUBBLE; i++) {
    if (ba[i * 3 + 1] < 0) {
      const t = .12 + R() * .82;
      const c = riverCenterAt(t);
      const hw = riverHalfWidth(t);
      ba[i * 3] = c[0] + (R() - .5) * hw * 1.4;
      ba[i * 3 + 1] = riverSurface(t) + (waterY - .1) * .9 + .005;
      ba[i * 3 + 2] = c[1] + (R() - .5) * hw * 1.4;
      bubbleVel[i].set((R() - .5) * .02, 0, 0);
    } else {
      const t = .12 + (ba[i * 3 + 2] - POOLZ + .9) / 2.9 * .8;
      const [cx2, cz2] = riverCenterAt(U.clamp01(t + .015));
      ba[i * 3] += bubbleVel[i].x * dt;
      ba[i * 3 + 1] += Math.sin(timeNow * 3 + i) * .0012;
      ba[i * 3 + 2] += (cz2 - riverCenterAt(U.clamp01(t))[1]) * dt * 1.4;
      if (ba[i * 3 + 1] < 0.05) ba[i * 3 + 1] = -99;
    }
  }
  bubbles.geometry.attributes.position.needsUpdate = true;

  // splash crown
  const sa = splashes.geometry.attributes.position.array;
  for (let i = 0; i < N_SPLASH; i++) {
    if (splashLife[i] <= 0) continue;
    splashLife[i] -= dt;
    const v = splashVel[i];
    v.y -= 3.6 * dt;
    sa[i * 3] += v.x * dt; sa[i * 3 + 1] += v.y * dt; sa[i * 3 + 2] += v.z * dt;
    if (sa[i * 3 + 1] < waterY - .03 || splashLife[i] <= 0) { splashLife[i] = 0; sa[i * 3 + 1] = -99; }
  }
  splashes.geometry.attributes.position.needsUpdate = true;
  splashes.material.opacity = .7;

  // cross-section specks
  const ka = specks.geometry.attributes.position.array;
  for (let i = 0; i < N_SPECK; i++) {
    ka[i * 3] += Math.sin(timeNow * .3 + i) * dt * .012;
    ka[i * 3 + 1] += dt * .004;
    if (ka[i * 3 + 1] > waterY - .1) {
      const x = 1.35 + R() * 2.95;
      ka[i * 3] = x;
      ka[i * 3 + 1] = bedAt(x, 3.9) + .07;
    }
  }
  specks.geometry.attributes.position.needsUpdate = true;
  specks.material.opacity = .07 + (1 - S.night) * .09;

  // mist drift
  for (const m of mistSprites) {
    const d = m.userData;
    if (d.puff > 0) {
      d.puff -= dt;
      const k = 1 - U.clamp01(d.puff);
      m.position.set(d.px + S.windVec.x * k * .35, d.py + k * .22 + .05, d.pz + S.windVec.z * k * .35);
      m.material.opacity = .12 * (1 - k) + .02;
      if (d.puff <= 0) { m.position.set(d.ox, 1.2, d.oz); }
    } else {
      d.ph += dt * d.sp;
      m.position.x = d.ox + Math.sin(d.ph) * .22 + S.windVec.x * .5;
      m.position.z = d.oz + Math.cos(d.ph * .7) * .18 + S.windVec.z * .5;
      m.position.y = 1.12 + Math.sin(d.ph * .5) * .12 + (waterY - .1) * .4;
      m.material.opacity = .05 + S.rain * .05;
    }
    m.material.opacity *= (1 - iceVis * .5);
    m.scale.setScalar((.5 + S.flow * .25) * (1 - iceVis * .4));
  }
}

function updateFish(dt) {
  if (!WG_.fish.length) return;
  const nightK = S.night * .55 + iceVis * .75;
  const scare = S.rain * .3;
  for (const f of WG_.fish) {
    f.alarm = Math.max(0, f.alarm - dt);
    const slow = 1 - U.clamp01(nightK) * .78;
    const targetBed = Math.max(bedAt(f.pos.x, 3.7) + .07, -0.9);
    const top = waterY - .085;
    // wander
    f.jitter.x = Math.sin(timeNow * .7 + f.phase) * .3;
    f.jitter.z = Math.cos(timeNow * .53 + f.phase * 1.7) * .2;
    f.jitter.y = Math.sin(timeNow * .41 + f.phase * 2.3) * .25;
    let speed = f.baseSpeed * slow * (1 + scare);
    if (f.alarm > 0) speed = f.baseSpeed * (3.2 + f.alarm);
    // rise and dimple
    if (f.alarm <= 0) {
      f.rise -= dt * (slow * .8 + .2);
      if (f.rise <= 0) { f.rising = 1; f.rise = 7 + R() * 11; }
    }
    if (f.rising > 0) {
      f.dir.y = U.damp(f.dir.y, .45, 2, dt);
      if (f.pos.y >= top - .01) {
        f.rising = 0;
        if (iceVis < .6) { addRing(f.pos.x, f.pos.z, .28, true); }
        else addRing(f.pos.x, f.pos.z, .12, true);
      }
    } else {
      const ty = U.clamp(f.pos.y + f.jitter.y * .1, targetBed + .02, top - .07);
      f.dir.y = U.damp(f.dir.y, (ty - f.pos.y) * 1.4, 1.2, dt);
      f.dir.y = U.clamp(f.dir.y, -.22, .22);
    }
    // keep in the slice / school band
    if (f.pos.x < 1.35) f.dir.x = Math.abs(f.dir.x) + .12;
    if (f.pos.x > 4.35) f.dir.x = -Math.abs(f.dir.x) - .12;
    if (f.pos.z < 3.5) f.dir.z = Math.abs(f.dir.z) + .08;
    if (f.pos.z > 3.982) f.dir.z = -Math.abs(f.dir.z) - .06;
    f.dir.x += f.jitter.x * .5 * dt;
    f.dir.z += f.jitter.z * .35 * dt;
    f.dir.y += Math.sin(timeNow * 1.3 + f.phase) * .15 * dt;
    f.dir.normalize();
    // swim
    f.pos.x += f.dir.x * speed * dt;
    f.pos.y += f.dir.y * speed * dt;
    f.pos.z += f.dir.z * speed * dt;
    f.pos.x = U.clamp(f.pos.x, 1.28, 4.4);
    f.pos.z = U.clamp(f.pos.z, 3.46, 3.985);
    f.pos.y = U.clamp(f.pos.y, targetBed, top);
    f.speed = speed;
    // mesh
    f.mesh.position.copy(f.pos);
    const yaw = Math.atan2(f.dir.x, f.dir.z);
    f.mesh.rotation.y = yaw;
    const pitch = Math.asin(U.clamp(f.dir.y, -.9, .9));
    f.mesh.rotation.x = -pitch * .55;
    f.mesh.rotation.z = Math.sin(timeNow * 2.1 + f.phase) * .06;
    const beat = Math.sin(timeNow * f.tailRate * (0.5 + speed * 2.2) * (1 - iceVis * .7) + f.phase);
    f.tail.rotation.y = beat * (.5 * (1 - iceVis * .4));
  }
}

function syncRings() {
  for (let i = 0; i < N_LAKE_RIPPLES; i++) {
    const slot = rings[i];
    const v = _ringVec4;
    if (!slot) v.set(0, 0, -99, 0);
    else v.set(slot.x, slot.z, slot.t0, slot.s);
    for (const u of allUniformSets) u.uRings.value[i].copy(v);
  }
}
const _ringVec4 = new THREE.Vector4();

function setSharedUniforms(t) {
  const sunDir = _v1.copy(S.sunPos).normalize();
  const windMag = Math.hypot(S.windVec.x, S.windVec.z) || .0001;
  let sky = WG.cols.cloud.clone().multiplyScalar(.42 + (1 - S.night) * .5);
  if (S.golden > 0) sky.lerp(WG.col('#d99556'), S.golden * .45);
  sky.lerp(WG.col('#0c141c'), S.night * .8);
  const light = WG.sky && WG.sky.light;
  const sunCol = _sunCol.copy(light ? light.color : WG.cols.sunlight);
  const sunPow = U.clamp01(S.sunVis) * (1 - S.cloudCover * .5);
  for (const u of allUniformSets) {
    u.uTime.value = t;
    u.uWaterY.value = waterY;
    u.uWind.value = S.wind;
    u.uWindDir.value.set(S.windVec.x / windMag, S.windVec.z / windMag);
    u.uSunDir.value.copy(sunDir);
    u.uSunCol.value.copy(sunCol).multiplyScalar(.55 + sunPow * 1.5);
    u.uSunVis.value = sunPow;
    u.uSkyCol.value.copy(sky);
    u.uIce.value = iceVis;
    u.uSnow.value = U.clamp01(S.snow);
    u.uRain.value = S.rain;
    u.uMurk.value = murk;
    u.uNight.value = S.night;
    u.uGold.value = S.golden;
    u.uFlash.value = S.flash;
    u.uFlow.value = S.flow;
    u.uSwell.value = 1 + (S.flow - 1) * .85 + S.rain * .5;
    u.fogDensity.value = WG.scene.fog.density;
    u.fogColor.value.copy(WG.scene.fog.color);
  }
}
const _sunCol = new THREE.Color();

/* ---------- module ---------- */
WG.register('water', {
  order: 22,
  init() {
    try {
      build();
      WG_.ready = true;
    } catch (e) {
      WG.warn('water:init', e);
      WG_.ready = false;
    }
  },
  update(dt, t) {
    if (!WG_.ready || !built) return;
    try {
      timeNow = t;
      waterY = U.damp(waterY, S.waterY, 5, dt);
      iceVis = U.damp(iceVis, Math.max(S.ice, freezeBoost), 1.6, dt);
      murk = U.damp(murk, U.clamp01(S.rain * .8 + (S.flow - 1) * .7 + S.storm * .2), 1.1, dt);
      freezeBoost = Math.max(0, freezeBoost - dt * .02);

      setSharedUniforms(t);
      syncRings();

      // lake surface & cross-section follow the water line
      lakeMesh.position.y = waterY;
      lakeMesh.visible = lakeMesh.scale.x > 0.01;
      updateCrossSection(crossMesh);
      updateBedBacking(bedBacking);
      bedBacking.position.y = 0;
      bedPebbles.position.y = 0;
      crossMesh.position.y = 0;
      riverMesh.position.y = (waterY - .1) * .9;
      poolMesh.position.y = poolSurface() + (waterY - .1) * .9;
      poolMesh.scale.setScalar(1 + (S.flow - 1) * .18 + S.rain * .12);
      const rise = (waterY - .1) * .9;
      stoneGroup.position.y = rise;
      pebbleGroup.position.y = rise;
      boulderGroup.position.y = poolMesh.position.y - .06;

      // waterfall follows lip / pool
      const ly = lipY() + (waterY - .1) * .35;
      const py = poolMesh.position.y + .02;
      const tngH = Math.min(.34, Math.max(.14, ly - py - .18));
      tongueMesh.position.set(0, ly - tngH * .5, -1.36);
      tongueMesh.scale.set(1, tngH, 1);
      tongueMesh.rotation.x = -.3;
      for (let i = 0; i < fallsGroup.children.length; i++) {
        const c = fallsGroup.children[i];
        if (c === icicleGroup) continue;
        if (c.userData.strandIdx == null) {
          if (c === tongueMesh) continue;
          c.userData.strandIdx = i;
        }
      }
      // strands: rescale geometry in place via position attribute is costly; use y-scale from lip
      updateFallsGeometry(ly, py);
      icicleGroup.position.set(0, ly - .01, 0);
      icicleGroup.visible = iceVis > .04;
      for (let i = 0; i < icicleGroup.children.length; i++) {
        const ic = icicleGroup.children[i];
        const k = U.clamp01((iceVis - .05) * 1.4);
        ic.scale.y = Math.max(.001, k * (.7 + (i % 3) * .2));
      }
      curtainMesh.visible = iceVis > .06;
      curtainMesh.material.uniforms; // shared uniforms
      poolGroup.visible = true;
      snowMound.visible = iceVis > .1;
      snowMound.scale.set(1 + iceVis * .18, .12 + iceVis * .12 + S.snow * .08, 1 + iceVis * .18);
      snowMound.position.set(POOLX, poolMesh.position.y - .01, POOLZ);
      boulderGroup.visible = true;

      // automatic impact rings
      poolPulse -= dt * (S.flow * .9 + .3);
      if (poolPulse <= 0 && iceVis < .75) {
        poolPulse = .5 + R() * .5;
        addRing(POOLX + (R() - .5) * .24, POOLZ + (R() - .5) * .2, .32 + S.flow * .12, true);
      }
      // rain ripple sources
      for (const src of WG_.rippleSource) {
        src.acc = (src.acc || 0) + dt * (src.rate || 3);
        while (src.acc > 1) { src.acc -= 1; addRing(src.x + (R() - .5) * .05, src.z + (R() - .5) * .05, .18 + R() * .2, true); }
      }

      if (fishMats && WG.env.tex) {
        fishMats.silver.envMap = WG.env.tex; fishMats.orange.envMap = WG.env.tex;
        fishMats.silver.needsUpdate = true; fishMats.orange.needsUpdate = true;
      }
      updateFish(dt);
      updateParticles(dt);

      // reflection cadence
      if (Q.reflections) {
        reflFrame++;
        if (Q.level >= 2 || (reflFrame & 1) === 0) renderReflection();
      }
      lakeMat.uniforms.uRefl.value = Q.reflections ? 1 : 0;
      crossMat.uniforms.uRefl.value = Q.reflections ? 1 : 0;
    } catch (e) {
      WG.warn('water:update', e);
    }
  },
  dispose() {
    for (const u of allUniformSets) {
      for (const k in u) if (u[k] && u[k].value && u[k].value.isTexture) u[k].value.dispose();
    }
    if (reflRT) reflRT.dispose();
    group.clear();
  }
});

let fallsGeoBase = [];
function updateFallsGeometry(ly, py) {
  // strands and curtain are rebuilt as cheap strips scaled by y between lip and pool
  for (const child of fallsGroup.children) {
    if (child === tongueMesh || child === icicleGroup) continue;
    if (!child.geometry.userData.basePos) {
      const arr = child.geometry.attributes.position.array.slice();
      child.geometry.userData.basePos = arr;
    }
    const base = child.geometry.userData.basePos;
    const arr = child.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const top = base[i + 1];
      const bz = base[i + 2];
      const frac = top + 1;
      const yTop = ly - Math.min(.26, (ly - py) * .34);
      arr[i] = base[i] * (1 + frac * 1.35);
      arr[i + 1] = py + frac * (yTop - py);
      arr[i + 2] = -1.42 + frac * .17 + bz;
    }
    child.geometry.attributes.position.needsUpdate = true;
    child.geometry.computeBoundingSphere();
  }
  // hide specks when no strands visible
}

/* seed fish etc. once built */
WG.on('lightning', (e) => {
  if (e && e.pos && built && (lakeInside(e.pos.x, e.pos.z) || nearRiver(e.pos.x, e.pos.z))) {
    addSplash(e.pos.x, e.pos.z, .9);
  }
});
})();