/* ===== 13_animals.js — birds, butterflies, dragonflies, fireflies ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state, Q = WG.quality;
if (!WG.groups || !WG.groups.animals) return;
const R = WG.rng('animals');
const T = () => WG.terrain;
const animals = WG.groups.animals;
const birdGroup = new THREE.Group(); birdGroup.name = 'birds';
const bugGroup = new THREE.Group(); bugGroup.name = 'bugs';
const flyGroup = new THREE.Group(); flyGroup.name = 'fireflies';
animals.add(birdGroup, bugGroup, flyGroup);

WG.animals = {
  ready: false,
  flush() { try { flushAll(); } catch (e) { WG.warn('animals:flush', e); } },
  scatter(pos, radius) {
    try {
      if (!pos) return;
      const x = pos.x, z = pos.z, r = radius || 1.6;
      for (const b of birds) {
        if (Math.hypot(b.pos.x - x, b.pos.z - z) < r * 1.6) scare(b);
      }
      for (const ins of butterflies) if (Math.hypot(ins.pos.x - x, ins.pos.z - z) < r) ins.scare = 1;
      for (const d of dragonflies) if (Math.hypot(d.pos.x - x, d.pos.z - z) < r) d.scare = 1;
    } catch (e) { WG.warn('animals:scatter', e); }
  }
};

const state = { flying: true, timer: 26, landing: false, landT: 0, flightY: 4.9, anchor: new THREE.Vector3(), count: 0 };
const birds = [], butterflies = [], dragonflies = [];
let ready = false, lastFlush = -99, flashT = 0;

function groundAt(x, z) {
  const t = T();
  if (t && t.ready && t.heightAt) { try { return t.heightAt(x, z); } catch (e) {} }
  return .6;
}

/* ---------- shared geometries ---------- */
const bodyGeo = new THREE.SphereGeometry(1, 8, 6);
const wingGeo = new THREE.BufferGeometry();
wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .015, .085, 0, -.03, .07, 0, .075], 3));
wingGeo.computeVertexNormals();
const tailGeo = new THREE.BufferGeometry();
tailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .01, -.022, 0, .09, .022, 0, .09], 3));
tailGeo.computeVertexNormals();
const eyeGeo = new THREE.SphereGeometry(.0065, 5, 4);
const eyeMat = new THREE.MeshBasicMaterial({ color: WG.col('#141414') });

const birdMats = [
  new THREE.MeshStandardMaterial({ color: WG.col('#59616b'), roughness: .8 }),
  new THREE.MeshStandardMaterial({ color: WG.col('#7a6148'), roughness: .82 })
];
const bellyMat = new THREE.MeshStandardMaterial({ color: WG.col('#cfc4ad'), roughness: .85 });
const wingMat = new THREE.MeshStandardMaterial({ color: WG.col('#4b535c'), roughness: .8, side: THREE.DoubleSide });

function buildBird(i) {
  const g = new THREE.Group();
  const mat = birdMats[i % 2];
  const body = new THREE.Mesh(bodyGeo, mat);
  body.scale.set(.024, .021, .05); g.add(body);
  const belly = new THREE.Mesh(bodyGeo, bellyMat);
  belly.scale.set(.019, .014, .036); belly.position.y = -.008; g.add(belly);
  const head = new THREE.Mesh(bodyGeo, mat);
  head.scale.setScalar(.018); head.position.set(0, .012, .04); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.005, .014, 5), new THREE.MeshStandardMaterial({ color: WG.col('#c8a05a'), roughness: .6 }));
  beak.rotation.x = Math.PI / 2; beak.position.set(0, .012, .058); g.add(beak);
  const wl = new THREE.Mesh(wingGeo, wingMat); wl.position.x = -.012; g.add(wl);
  const wr = new THREE.Mesh(wingGeo, wingMat); wr.position.x = .012; wr.scale.x = -1; g.add(wr);
  const tail = new THREE.Mesh(tailGeo, mat); tail.position.z = -.045; g.add(tail);
  const e1 = new THREE.Mesh(eyeGeo, eyeMat), e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(.011, .016, .052); e2.position.set(-.011, .016, .052); g.add(e1, e2);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  birdGroup.add(g);
  return { g, wl, wr, body, tail, pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(), mode: 'fly', modeT: 0, perch: null, phase: R() * 6, wander: R() * 6, peckT: 0, scareT: 0 };
}

/* ---------- perches ---------- */
function perchesList() {
  const out = [];
  if (WG.cabin && WG.cabin.perches) for (const p of WG.cabin.perches) out.push(p.clone());
  if (WG.flora && WG.flora.trees) {
    for (const tr of WG.flora.trees) {
      if (!tr || !tr.base) continue;
      out.push(new THREE.Vector3(tr.base.x, tr.base.y + (tr.height || .8) * .92, tr.base.z));
    }
  }
  return out;
}
function sheltersList() {
  const out = [];
  if (WG.cabin && WG.cabin.shelters) for (const p of WG.cabin.shelters) out.push(p.clone());
  if (WG.flora && WG.flora.trees) for (const tr of WG.flora.trees) {
    if (!tr || !tr.base || !tr.group) continue;
    out.push(new THREE.Vector3(tr.base.x + .1, tr.base.y + (tr.height || .8) * .55, tr.base.z + .1));
  }
  return out;
}
function pickPerch(near) {
  const list = (isShelterTime() ? sheltersList() : perchesList()).filter(p => !near || p.distanceTo(near) < 4.2);
  const src = list.length ? list : perchesList();
  if (!src.length) return new THREE.Vector3(-2.9, groundAt(-2.9, 1.3) + .9, 1.3);
  return src[(R() * src.length) | 0].clone();
}
function isShelterTime() { return S.rain > .12 || S.snowfall > .12 || S.storm > .35; }

/* ---------- butterflies / dragonflies ---------- */
const bflyMats = ['#d9d2c2', '#d6b83b', '#c96820', '#5f95c7'].map(c =>
  new THREE.MeshStandardMaterial({ color: WG.col(c), roughness: .85, side: THREE.DoubleSide }));
const bflyWing = new THREE.CircleGeometry(.032, 7);
function buildButterfly(i) {
  const g = new THREE.Group();
  const mat = bflyMats[i % 4];
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: WG.col('#3a3128'), roughness: .8 }));
  body.scale.set(.006, .006, .032); g.add(body);
  const w1 = new THREE.Mesh(bflyWing, mat); w1.position.set(.029, 0, .005); w1.rotation.x = -Math.PI / 2; g.add(w1);
  const w2 = new THREE.Mesh(bflyWing, mat); w2.position.set(-.029, 0, .005); w2.rotation.x = -Math.PI / 2; w2.rotation.y = Math.PI; g.add(w2);
  bugGroup.add(g);
  return { g, w1, w2, pos: new THREE.Vector3(), target: new THREE.Vector3(), phase: R() * 6, scare: 0, settle: 0, turn: R() * 6 };
}
function buildDragonfly(i) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: WG.col(i % 2 ? '#4f9c8e' : '#5b78b5'), roughness: .35, metalness: .25 });
  const body = new THREE.Mesh(bodyGeo, mat); body.scale.set(.01, .01, .06); g.add(body);
  const wingM = new THREE.MeshStandardMaterial({ color: WG.col('#dbe9ea'), transparent: true, opacity: .45, roughness: .2, side: THREE.DoubleSide });
  for (const s of [-1, 1]) for (const z of [.015, -.02]) {
    const w = new THREE.Mesh(bflyWing, wingM);
    w.scale.set(.85, .55, .55); w.position.set(s * .045, .005, z); w.rotation.x = -Math.PI / 2; g.add(w);
  }
  bugGroup.add(g);
  return { g, pos: new THREE.Vector3(), target: new THREE.Vector3(), phase: R() * 6, scare: 0, hover: 1 };
}

/* ---------- fireflies ---------- */
let fireflies = null, fireflyData = null, fireflyN = 0;
function buildFireflies() {
  fireflyN = Math.round([110, 180, 260][Q.level] * Q.animals);
  const pos = new Float32Array(fireflyN * 3);
  const phase = new Float32Array(fireflyN);
  const speed = new Float32Array(fireflyN);
  fireflyData = [];
  for (let i = 0; i < fireflyN; i++) {
    const a = R() * Math.PI * 2, r = .4 + R() * 5.2;
    const x = U.clamp(2.75 + Math.cos(a) * r * .9, -5.5, 5.5);
    const z = U.clamp(2.65 + Math.sin(a) * r * .7, -3.5, 3.8);
    const y = groundAt(x, z) + .18 + R() * .6;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    phase[i] = R() * 6.28; speed[i] = .08 + R() * .16;
    fireflyData.push({ ox: x, oz: z, oy: y, ph: R() * 6.28, blink: 1.5 + R() * 4 });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPR: { value: 1 } },
    vertexShader: `attribute float aPhase, aSpeed; uniform float uTime, uPR; varying float vB;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.);
        vB = .5 + .5 * sin(uTime * (1.1 + aSpeed * 2.) + aPhase);
        vB = pow(vB, 2.2);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.2 + vB * 3.4) * uPR * (34. / max(-mv.z, .2)); }`,
    fragmentShader: `uniform float uOpacity; varying float vB;
      void main(){ vec2 p = gl_PointCoord - .5; float d = length(p);
        float a = smoothstep(.5, .0, d); a *= a;
        gl_FragColor = vec4(vec3(.82, 1., .45) * (.9 + vB), a * uOpacity * (.35 + vB)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  fireflies = new THREE.Points(g, mat); fireflies.frustumCulled = false;
  flyGroup.add(fireflies);
}

/* ---------- flock behaviour ---------- */
function scare(b) {
  b.scareT = 2.2 + R() * 1.6;
  b.mode = 'fly';
  b.vel.set((R() - .5) * 2.2, .9 + R() * .7, (R() - .5) * 2.2);
  state.flying = true; state.landing = false; state.timer = 18 + R() * 10;
}
function flushAll() {
  lastFlush = S.sceneTime;
  for (const b of birds) scare(b);
  for (const bf of butterflies) bf.scare = 1;
}
function chooseAnchor() {
  const spots = [[-2.95, 1.35], [0.2, 2.4], [-4, .25], [3.3, .35], [2, 2], [-1, 3.2]];
  const s = spots[(R() * spots.length) | 0];
  state.anchor.set(s[0], 0, s[1]);
}
function startLanding() {
  state.flying = false; state.landing = true; state.landT = 0;
  chooseAnchor();
  const perches = perchesList().filter(p => p.distanceTo(state.anchor) < 4.6);
  let i = 0;
  for (const b of birds) {
    const p = perches.length ? perches[i++ % perches.length].clone() : pickPerch(state.anchor);
    b.perch = p; b.mode = 'land'; b.modeT = .8 + R() * 1.6;
  }
}
function birdAlarm(active) {
  state.flying = active; if (active) state.landing = false;
}

/* ---------- update ---------- */
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function updateBirds(dt, t) {
  const night = S.night > .55;
  const shelter = isShelterTime();
  const activity = (.55 + Q.animals * .45) * (1 - S.night * .35) * (S.season > 2.5 ? .55 : 1) * (1 - S.storm * .4);
  state.timer -= dt * (1 + S.storm * .4);
  for (const b of birds) {
    b.scareT = Math.max(0, b.scareT - dt);
    const active = b.scareT > 0 || (!night && !shelter);
    if (b.mode === 'fly' || b.mode === 'flush') {
      // seek flock anchor / roam
      const tx = state.anchor.x + Math.sin(t * .31 + b.phase) * 2.4;
      const tz = state.anchor.z + Math.cos(t * .27 + b.phase * 1.3) * 1.9;
      const ty = state.flightY + Math.sin(t * .5 + b.phase) * .7;
      _v1.set(tx - b.pos.x, ty - b.pos.y, tz - b.pos.z).normalize();
      // separation
      _v2.set(0, 0, 0);
      for (const o of birds) if (o !== b) {
        const d = b.pos.distanceToSquared(o.pos);
        if (d < .16 && d > 1e-5) _v2.addScaledVector(_v1.copy(b.pos).sub(o.pos), .02 / d);
      }
      _v1.set(tx - b.pos.x, ty - b.pos.y, tz - b.pos.z).normalize().addScaledVector(_v2, 8);
      b.vel.lerp(_v1.multiplyScalar(1.6 + S.storm * .7), Math.min(1, dt * (active ? 2.2 : 5)));
      b.pos.addScaledVector(b.vel, dt);
      // glass & floor avoidance
      if (b.pos.x > 5.5) { b.vel.x -= 1.5; b.pos.x = 5.5; }
      if (b.pos.x < -5.5) { b.vel.x += 1.5; b.pos.x = -5.5; }
      if (b.pos.z > 3.6) { b.vel.z -= 1.5; b.pos.z = 3.6; }
      if (b.pos.z < -3.5) { b.vel.z += 1.5; b.pos.z = -3.5; }
      const g = groundAt(b.pos.x, b.pos.z);
      if (b.pos.y < g + 1) b.vel.y += 2 * dt;
      if (b.pos.y > 7) b.vel.y -= 2 * dt;
      b.pos.y = U.clamp(b.pos.y, g + .5, 7.1);
      if (state.landing) {
        b.modeT -= dt;
        if (b.modeT <= 0) { b.mode = 'land'; }
      } else if (!shelter && !night && state.timer <= 0 && birds.every(o => o.scareT <= 0)) {
        startLanding();
      }
    } else if (b.mode === 'land') {
      if (!b.perch) { b.mode = 'fly'; continue; }
      _v1.copy(b.perch).sub(b.pos);
      const d = _v1.length();
      b.pos.addScaledVector(_v1.normalize(), Math.min(d, dt * 2.4));
      b.vel.lerp(_v1, Math.min(1, dt * 3));
      if (d < .02) {
        b.mode = 'perch'; b.modeT = 10 + R() * 10; b.pos.copy(b.perch);
        state.landT = Math.max(state.landT, b.modeT);
      }
    } else {
      b.modeT -= dt;
      if (b.mode === 'perch') {
        b.pos.copy(b.perch);
        // hop / turn / peck
        if (R() < dt * .8) b.pos.x += (R() - .5) * .02;
        if (R() < dt * 1.2) b.peckT = .3;
        b.peckT = Math.max(0, b.peckT - dt);
        if (state.landing && b.modeT < 1.2) b.mode = 'takeoff';
        if (b.modeT <= 0) { b.mode = 'takeoff'; b.modeT = .7; }
        if (b.scareT > 0) { b.mode = 'fly'; b.modeT = 0; }
      }
      if (b.mode === 'takeoff') {
        b.modeT -= dt;
        b.vel.set((R() - .5) * .3, 1.1, (R() - .5) * .3);
        b.pos.addScaledVector(b.vel, dt);
        if (b.modeT <= 0) { b.mode = 'fly'; }
      }
    }
    // orientation + wings + hop/peck
    b.g.position.copy(b.pos);
    const flying = b.mode === 'fly' || b.mode === 'flush' || b.mode === 'land' || b.mode === 'takeoff';
    if (flying) {
      const speed = b.vel.length();
      const yaw = Math.atan2(b.vel.x, b.vel.z);
      b.g.rotation.y = U.damp(b.g.rotation.y, yaw, 6, dt);
      b.g.rotation.z = U.damp(b.g.rotation.z, U.clamp(-b.vel.x * .12, -.5, .5), 4, dt);
      const flap = Math.sin(t * 26 + b.phase) * (speed > .4 ? .9 : .45);
      b.wl.rotation.z = flap; b.wr.rotation.z = -flap;
      b.g.rotation.x = .05;
    } else {
      const perchYaw = Math.atan2(state.anchor.x - b.pos.x, state.anchor.z - b.pos.z) + Math.sin(t * .3 + b.phase) * .5;
      b.g.rotation.y = U.damp(b.g.rotation.y, perchYaw, 3, dt);
      b.g.rotation.z = 0;
      const peck = b.peckT > 0 ? Math.sin(b.peckT * 22) * .5 : 0;
      b.g.rotation.x = U.damp(b.g.rotation.x, peck, 14, dt);
      const fold = U.damp(b.wl.rotation.z, -.15, 8, dt);
      b.wl.rotation.z = fold; b.wr.rotation.z = -fold;
      // hop bounce
      b.g.position.y += Math.abs(Math.sin(t * 8 + b.phase)) * .001;
      if (night || shelter) b.g.rotation.y += Math.sin(t * .4 + b.phase) * .001;
    }
    b.g.visible = b.pos.y < 7.3;
  }
  if (state.landing && state.landT > 0) {
    state.landT -= dt;
    if (state.landT <= 0 || birds.every(b => b.mode === 'perch')) {
      state.landing = false;
      state.timer = 20 + R() * 14;
      // take off one after another
      let k = 0;
      for (const b of birds) {
        if (b.mode === 'perch') { b.mode = 'takeoff'; b.modeT = .5 + k * .18; b.perch = null; k++; }
      }
    }
  }
}

function updateBugs(dt, t) {
  const warm = U.clamp01(S.temp / 20) * (1 - S.night * .85) * (1 - S.rain * .7) * (1 - S.storm * .8) * U.clamp01(S.daylight * 1.2);
  const seasonOK = S.season > .7 && S.season < 1.9;
  const patches = (WG.flora && WG.flora.flowers) || [];
  for (const bf of butterflies) {
    bf.scare = Math.max(0, bf.scare - dt);
    if (!bf.target || bf.target.equals(WG.tmp.v1.set(0, 0, 0))) bf.target.set(-2 + R() * 4, 0, 0 + R() * 3);
    if (bf.settle > 0) {
      bf.settle -= dt;
      bf.w1.rotation.z = Math.sin(t * 9) * .5; bf.w2.rotation.z = -bf.w1.rotation.z;
      bf.g.position.y = groundAt(bf.pos.x, bf.pos.z) + .1 + Math.sin(t * 2) * .005;
      if (bf.settle <= 0 || bf.scare > 0) {
        if (patches.length) { const p = patches[(R() * patches.length) | 0]; bf.target.set(p.x + (R() - .5) * .4, 0, p.z + (R() - .5) * .4); }
      }
    } else {
      if (bf.scare > 0) { bf.target.set(bf.pos.x + (R() - .5) * 2, 0, bf.pos.z + (R() - .5) * 2); }
      _v1.set(bf.target.x - bf.pos.x, 0, bf.target.z - bf.pos.z);
      const d = _v1.length();
      if (d < .2) { bf.settle = 2 + R() * 4; }
      _v1.y = Math.sin(t * 5 + bf.phase) * .3;
      _v1.normalize().multiplyScalar(.28 * (1 + bf.scare * 2));
      bf.turn += Math.sin(t * 3 + bf.phase) * dt * 4;
      bf.pos.addScaledVector(_v1, dt);
      bf.pos.y = groundAt(bf.pos.x, bf.pos.z) + .18 + Math.sin(t * 2.4 + bf.phase) * .08;
      const flap = Math.sin(t * 22 + bf.phase) * 1.1;
      bf.w1.rotation.z = flap; bf.w2.rotation.z = -flap;
      bf.g.rotation.y = Math.atan2(_v1.x, _v1.z);
    }
    bf.g.position.copy(bf.pos);
    bf.g.visible = warm > .12 && seasonOK && bf.pos.y > .1;
  }
  for (const d of dragonflies) {
    d.scare = Math.max(0, d.scare - dt);
    d.hover -= dt;
    if (d.hover <= 0) {
      d.hover = 1.2 + R() * 2.4;
      // shallows of the lake
      const a = R() * Math.PI * 2, rr = .72 + R() * .22;
      d.target.set(2.75 + Math.cos(a) * 2.35 * rr, 0, 2.65 + Math.sin(a) * 1.75 * rr);
    }
    _v1.set(d.target.x - d.pos.x, .05, d.target.z - d.pos.z);
    const dd = _v1.length();
    if (dd > .06) d.pos.addScaledVector(_v1.normalize(), Math.min(dd, dt * (1.2 + d.scare * 3)));
    d.pos.x = U.clamp(d.pos.x, .5, 5.1);
    d.pos.z = U.clamp(d.pos.z, 1.0, 3.9);
    d.pos.y = Math.max(groundAt(d.pos.x, d.pos.z), S.waterY) + .16 + Math.sin(t * 2 + d.phase) * .03;
    d.g.position.copy(d.pos);
    d.g.rotation.y = Math.atan2(d.target.x - d.pos.x, d.target.z - d.pos.z);
    d.g.visible = S.season > 1.2 && S.season < 2.3 && S.ice < .3 && S.night < .5 && S.rain < .4;
  }
  // fireflies
  if (fireflies) {
    const show = U.clamp01((S.season - 1.1) * 2.2) * U.clamp01((2.2 - S.season) * 2.2) * U.clamp01((S.temp - 9) / 8) *
      U.clamp01(1 - S.rain) * U.clamp01(1 - S.snowfall) * U.clamp01(S.night * 1.4 - .2) * (S.flash > .35 ? 0 : 1);
    fireflies.material.uniforms.uOpacity.value = U.damp(fireflies.material.uniforms.uOpacity.value, show * (flashT > 0 ? .05 : .95), flashT > 0 ? 9 : 2, dt);
    fireflies.visible = fireflies.material.uniforms.uOpacity.value > .01;
    if (fireflies.visible) {
      fireflies.material.uniforms.uTime.value = t;
      fireflies.material.uniforms.uPR.value = Math.min(2, WG.renderer.getPixelRatio());
      const pos = fireflies.geometry.attributes.position.array;
      for (let i = 0; i < fireflyN; i++) {
        const f = fireflyData[i];
        f.ph += dt * .18;
        pos[i * 3] = f.ox + Math.sin(f.ph) * .3 + S.windVec.x * .12;
        pos[i * 3 + 1] = f.oy + Math.sin(f.ph * 1.4) * .16;
        pos[i * 3 + 2] = f.oz + Math.cos(f.ph * .8) * .3 + S.windVec.z * .12;
      }
      fireflies.geometry.attributes.position.needsUpdate = true;
    }
  }
}

WG.register('animals', {
  order: 34,
  init() {
    try {
      const count = Math.max(5, Math.round([5, 7, 9][Q.level] * (Q.animals < .7 ? .85 : 1)));
      for (let i = 0; i < count; i++) {
        const b = buildBird(i);
        b.pos.set(-1 + R() * 3, 4.6 + R() * 1.4, -.5 + R() * 2.5);
        birds.push(b);
      }
      const bflyN = Math.round([5, 8, 11][Q.level] * Q.animals);
      for (let i = 0; i < bflyN; i++) {
        const bf = buildButterfly(i);
        bf.pos.set(-2.4 + R() * 3.2, groundAt(0, 0) + .3, .4 + R() * 2.8);
        butterflies.push(bf);
      }
      const dragN = Math.max(2, Math.round([2, 3, 4][Q.level] * Q.animals));
      for (let i = 0; i < dragN; i++) {
        const d = buildDragonfly(i);
        d.pos.set(2 + R() * 1.5, S.waterY + .3, 2 + R() * 1.2);
        d.target.copy(d.pos);
        dragonflies.push(d);
      }
      buildFireflies();
      state.count = count;
      ready = true; WG.animals.ready = true;
    } catch (e) { WG.warn('animals:init', e); }
  },
  update(dt, t) {
    if (!ready || !WG.ready) return;
    try {
      flashT = Math.max(0, flashT - dt);
      updateBirds(dt, t);
      updateBugs(dt, t);
    } catch (e) { WG.warn('animals:update', e); }
  }
});

WG.on('tap', () => { try { flushAll(); } catch (e) {} });
WG.on('lightning', () => {
  try {
    flashT = 4;
    flushAll();
    for (const b of birds) b.vel.y += 1.5;
  } catch (e) {}
});
WG.on('splash', d => { try { if (d && d.pos) WG.animals.scatter(d.pos, 1.4); } catch (e) {} });
})();