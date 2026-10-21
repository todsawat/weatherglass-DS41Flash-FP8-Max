/* ===== 11_weather.js — rain, snow, hail, fog, lightning, rainbow, aurora ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const R = WG.rng('weather');
const weather = WG.weather = { ready: false, rainColumns: [] };
let ready = false;

/* ---------------------------------------------------------------- pools */
const QL = WG.quality.level;
const MAX_DROPS = [180, 420, 780][QL];
const MAX_FLAKES = [90, 220, 420][QL];
const MAX_HAIL = [0, 40, 80][QL];
const MAX_SPARKS = [40, 90, 150][QL];

const drops = [];
const flakes = [];
const hails = [];
const sparks = [];
const columns = new Map();

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
  _p = new THREE.Vector3(), _s = new THREE.Vector3();

/* rain streak instanced quads */
const rainGeo = new THREE.PlaneGeometry(.035, 1, 1, 1);
rainGeo.translate(0, .5, 0);
const rainMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(1.55, 1.65, 1.75), transparent: true, opacity: .55,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true
});
const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, MAX_DROPS);
rainMesh.frustumCulled = false; rainMesh.renderOrder = 24;
rainMesh.count = 0;
WG.groups.weather.add(rainMesh);

const dropGeo = new THREE.PlaneGeometry(.055, .055);
const flakeMat = new THREE.PointsMaterial({
  map: WG.tex.glow, color: new THREE.Color('#ffffff'), transparent: true, opacity: .9,
  size: .085, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const flakeGeo = new THREE.BufferGeometry();
flakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_FLAKES * 3), 3));
const flakeMesh = new THREE.Points(flakeGeo, flakeMat);
flakeMesh.frustumCulled = false; flakeMesh.renderOrder = 25;
WG.groups.weather.add(flakeMesh);

const hailGeo = new THREE.IcosahedronGeometry(.035, 0);
const hailMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e8eef2'), roughness: .25, metalness: 0, transparent: true, opacity: .85 });
const hailMesh = new THREE.InstancedMesh(hailGeo, hailMat, Math.max(1, MAX_HAIL));
hailMesh.frustumCulled = false; hailMesh.castShadow = false;
WG.groups.weather.add(hailMesh);

const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
const sparkMat = new THREE.PointsMaterial({
  map: WG.tex.glow, color: new THREE.Color(4.5, 3.2, 1.7), transparent: true, opacity: 1,
  size: .13, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const sparkMesh = new THREE.Points(sparkGeo, sparkMat);
sparkMesh.frustumCulled = false;
WG.groups.weather.add(sparkMesh);

/* ---------------------------------------------------------------- columns */
function columnFor(cloud) {
  let c = columns.get(cloud.id);
  if (c) return c;
  c = { cloud, front: 0, end: 0, started: false, output: 0, acc: 0, baseY: 0, radius: 1, rate: 0 };
  columns.set(cloud.id, c);
  weather.rainColumns.push(c);
  return c;
}

function spawnDrop(c, emitY) {
  if (drops.length >= MAX_DROPS) return;
  const a = R() * Math.PI * 2, r = Math.sqrt(R()) * c.radius;
  const x = c.cloud.pos.x + Math.cos(a) * r;
  const z = c.cloud.pos.z + Math.sin(a) * r;
  drops.push({
    x, y: emitY, z,
    vy: -(9 + R() * 5), len: .3 + R() * .42,
    col: c, life: 5, splashed: false
  });
}

function spawnFlake(c, emitY) {
  if (flakes.length >= MAX_FLAKES) return;
  const a = R() * Math.PI * 2, r = Math.sqrt(R()) * c.radius;
  flakes.push({
    x: c.cloud.pos.x + Math.cos(a) * r, y: emitY, z: c.cloud.pos.z + Math.sin(a) * r,
    vy: -(.55 + R() * .5), ph: R() * 9, life: 22
  });
}

function spawnHail(c, emitY) {
  if (hails.length >= MAX_HAIL) return;
  const a = R() * Math.PI * 2, r = Math.sqrt(R()) * c.radius * .6;
  hails.push({
    x: c.cloud.pos.x + Math.cos(a) * r, y: emitY, z: c.cloud.pos.z + Math.sin(a) * r,
    vy: -(7 + R() * 3), bounces: 0, life: 4
  });
}

function groundY(x, z) {
  if (WG.terrain && WG.terrain.heightAt) return WG.terrain.heightAt(x, z);
  return 0;
}
function splashAt(x, z, strength, onWater) {
  if (onWater && WG.water && WG.water.ring) WG.run('w', () => WG.water.ring(x, z, strength));
  if (sparks.length < MAX_SPARKS && R() < .5) {
    sparks.push({ x, y: groundY(x, z) + .02, z, vy: 1.1 + R() * 1.2, life: .45, g: -7, warm: 0 });
  }
}

/* ---------------------------------------------------------------- lightning */
const L = { bolt: null, forks: [], t: 0, life: 0, seq: 0, glow: 0, target: null };
const boltMat = new THREE.LineBasicMaterial({
  color: new THREE.Color(5.5, 7.4, 12), transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false
});
const boltGroup = new THREE.Group();
boltGroup.visible = false;
WG.groups.weather.add(boltGroup);
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: WG.tex.glow, color: new THREE.Color(2.2, 2.8, 4.6), transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
}));
glowSprite.scale.setScalar(4);
boltGroup.add(glowSprite);

function buildBolt(from, to) {
  for (const c of boltGroup.children.slice()) if (c !== glowSprite) { c.geometry.dispose(); boltGroup.remove(c); }
  const pts = [];
  const N = 14;
  const dir = new THREE.Vector3().subVectors(to, from);
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    _p.copy(from).addScaledVector(dir, f);
    const j = (1 - f) * .55 + .1;
    _p.x += (R() - .5) * j; _p.z += (R() - .5) * j;
    pts.push(_p.clone());
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  boltGroup.add(new THREE.Line(g, boltMat));
  for (let k = 1; k <= 2; k++) {
    const off = (k === 1 ? .045 : -.045);
    const g2 = new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().add(new THREE.Vector3(off, 0, off * .6))));
    boltGroup.add(new THREE.Line(g2, boltMat));
  }
  for (let k = 0; k < 3; k++) {
    const fromI = 4 + ((R() * (N - 7)) | 0);
    if (!pts[fromI]) continue;
    const bp = [pts[fromI].clone()];
    const bd = new THREE.Vector3(dir.x, 0, dir.z).normalize().multiplyScalar(.6 + R() * .7);
    for (let i = 1; i <= 5; i++) {
      _p.copy(bp[0]).addScaledVector(dir, .055 * i).addScaledVector(bd, i * .16);
      _p.x += (R() - .5) * .22; _p.z += (R() - .5) * .22;
      bp.push(_p.clone());
    }
    boltGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bp), boltMat));
  }
}

function strikeTarget() {
  let best = null, bestH = 0;
  if (WG.flora && WG.flora.trees) {
    for (const t of WG.flora.trees) {
      if (!t.base) continue;
      const h = t.height || 1;
      if (h > bestH) { bestH = h; best = t; }
    }
  }
  if (best) return { pos: new THREE.Vector3(best.base.x, best.base.y + bestH * .9, best.base.z), tree: best, water: false };
  if (WG.water && WG.water.surface) return { pos: new THREE.Vector3(2.75, S.waterY, 2.65), water: true };
  return { pos: new THREE.Vector3(0, .6, 0), water: false };
}

function doBolt(fromPos, power) {
  const tgt = strikeTarget();
  buildBolt(fromPos, tgt.pos);
  L.t = 0; L.life = 1.1; L.seq = 0; L.target = tgt;
  boltGroup.visible = true;
  boltMat.opacity = 1;
  glowSprite.position.copy(tgt.pos);
  glowSprite.material.opacity = 1;
  glowSprite.scale.setScalar(3 + power * 2);
  S.flash = Math.min(.5, S.flash + .28 * power);
  WG.run('post', () => WG.post.flash && WG.post.flash(.8));
  WG.run('cam', () => WG.cameraRig.shake(.32 * power));
  if (WG.animals) WG.run('animals', () => WG.animals.flush());
  if (WG.audio && WG.audio.event) {
    const d = WG.camera ? WG.camera.position.distanceTo(tgt.pos) : 12;
    WG.run('audio', () => WG.audio.event('crack', { pos: tgt.pos }));
    setTimeout(() => WG.run('audio', () => WG.audio.event('thunder', { delay: .1, dist: d })), 180 + d * 55);
  }
  if (tgt.tree && WG.flora && WG.flora.burst) WG.run('flora', () => WG.flora.burst(tgt.tree, 'shake'));
  if (tgt.water && WG.water && WG.water.splash) WG.run('water', () => WG.water.splash(tgt.pos.x, tgt.pos.z, 2.4));
  for (let i = 0; i < 18; i++) {
    if (sparks.length >= MAX_SPARKS) break;
    sparks.push({
      x: tgt.pos.x + (R() - .5) * .3, y: tgt.pos.y, z: tgt.pos.z + (R() - .5) * .3,
      vy: 1.4 + R() * 2.6, life: .7 + R() * .6, g: -8, warm: 1
    });
  }
  WG.emit('lightning', { pos: tgt.pos, power });
}

weather.bolt = function (from, to, power) {
  power = power == null ? 1 : power;
  doBolt(from ? from.clone() : new THREE.Vector3(0, 7.2, -2), power);
};

/* ---------------------------------------------------------------- fog */
const fogGroup = new THREE.Group();
WG.groups.weather.add(fogGroup);
const fogPlanes = [];
let fogMat = null;
function buildFog() {
  const size = 4;
  const tex = WG.tex.noise;
  fogMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: tex }, uTime: { value: 0 }, uDensity: { value: 0 },
      uWind: { value: new THREE.Vector2() }, uTint: { value: new THREE.Color('#e9e6de') },
      uGold: { value: 0 }, uFlash: { value: 0 }
    },
    vertexShader: `varying vec2 vUv; varying vec3 vW;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uTime, uDensity, uGold, uFlash;
      uniform vec2 uWind; uniform vec3 uTint; varying vec2 vUv; varying vec3 vW;
      void main(){
        vec2 uv = vUv * 2.2;
        float n = texture2D(uTex, uv + uWind * uTime * .02).r * 0.55;
        n += texture2D(uTex, uv * 2.3 - uWind * uTime * .035).r * 0.3;
        n += texture2D(uTex, uv * 5.1 + vec2(uTime * .01, 0.)).r * 0.15;
        float edge = smoothstep(0., .16, vUv.x) * smoothstep(1., .84, vUv.x)
                   * smoothstep(0., .12, vUv.y) * smoothstep(1., .88, vUv.y);
        float a = smoothstep(.38, .78, n) * uDensity * edge;
        vec3 col = mix(uTint, vec3(1., .82, .55), uGold);
        col += uFlash * vec3(.72, .78, 1.);
        gl_FragColor = vec4(col, a * .3);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending
  });
  for (let i = 0; i < size; i++) {
    const g = new THREE.PlaneGeometry(11.6, 7.6, 1, 1);
    const m = new THREE.Mesh(g, fogMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, .18 + i * .30, 0);
    m.scale.setScalar(1 - i * .06);
    m.renderOrder = 26 + i;
    fogGroup.add(m);
    fogPlanes.push(m);
  }
}

weather.fogPuff = function (pos, size) {
  if (!pos) return;
  S.fogExtra = U.clamp01((S.fogExtra || 0) + .14 * (size || 1));
  S.fog = U.clamp01(Math.max(S.fog || 0, S.fogExtra));
};

/* ---------------------------------------------------------------- rainbow / aurora */
const rainbow = new THREE.Mesh(
  new THREE.TorusGeometry(9.4, .34, 8, 96, Math.PI),
  new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      uniform float uOpacity; varying vec2 vUv;
      void main(){
        float f = vUv.y;
        vec3 c = vec3(0.);
        c += vec3(1., .18, .12) * smoothstep(.62, 1., f);
        c += vec3(1., .62, .12) * (smoothstep(.42, .56, f) - smoothstep(.6, .72, f)) * 1.4;
        c += vec3(.95, .95, .25) * (smoothstep(.3, .42, f) - smoothstep(.42, .54, f));
        c += vec3(.25, .85, .35) * (smoothstep(.18, .3, f) - smoothstep(.3, .42, f));
        c += vec3(.28, .5, 1.) * (smoothstep(.06, .18, f) - smoothstep(.18, .3, f));
        c += vec3(.42, .3, .95) * (1. - smoothstep(.06, .22, f));
        gl_FragColor = vec4(c, uOpacity * (1. - smoothstep(.82, 1., f)) * .9);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  })
);
rainbow.visible = false;
WG.groups.weather.add(rainbow);
const rainbow2 = rainbow.clone();
rainbow2.material = rainbow.material;
rainbow2.scale.setScalar(1.22);
rainbow2.position.z = -.2;
WG.groups.weather.add(rainbow2);

const aurora = new THREE.Group();
aurora.visible = false;
WG.groups.weather.add(aurora);
const auroraMats = [];
for (let i = 0; i < 3; i++) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uPh: { value: i * 2.1 } },
    vertexShader: `varying vec2 vUv; uniform float uTime, uPh;
      void main(){ vUv = uv; vec3 p = position;
        p.y += sin(uv.x * 6.283 + uTime * .6 + uPh) * .22;
        p.z += sin(uv.x * 4.1 + uTime * .4 + uPh) * .5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.); }`,
    fragmentShader: `uniform float uOpacity, uTime, uPh; varying vec2 vUv;
      void main(){
        float band = smoothstep(.0, .25, vUv.y) * smoothstep(1., .55, vUv.y);
        float streak = .55 + .45 * sin(vUv.x * 42. + sin(vUv.x * 7. + uTime * .8 + uPh) * 4.);
        vec3 c = mix(vec3(.12, .95, .5), vec3(.55, .3, .95), smoothstep(.45, 1., vUv.y));
        gl_FragColor = vec4(c, uOpacity * band * streak * .34);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
  auroraMats.push(mat);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 2.4, 20, 1), mat);
  m.position.set(0, 6.2 + i * .25, -2.6 + i * .7);
  aurora.add(m);
}

/* ---------------------------------------------------------------- update */
let flashCool = 0, rainbowV = 0, auroraV = 0, fogShown = 0;

function updateRain(dt) {
  const list = (WG.clouds && WG.clouds.list) || [];
  const gust = S.windVec;
  for (const c of list) {
    const rate = c.rainRate || 0;
    let col = columns.get(c.id);
    if (rate > .02) {
      col = columnFor(c);
      col.rate = rate;
      col.radius = Math.max(.6, c.radius * .62);
      col.baseY = c.pos.y - c.size * .55;
      if (!S.snowfallOverride && S.tempAt && S.tempAt(c.pos.y) > 0) {
        col.acc += dt * (10 + rate * 46) * (MAX_DROPS / 420);
        while (col.acc > 1) { col.acc -= 1; spawnDrop(col, col.baseY); }
      } else {
        col.acc += dt * (3 + rate * 16) * (MAX_FLAKES / 220);
        while (col.acc > 1) { col.acc -= 1; spawnFlake(col, col.baseY); }
        if (S.temp > 1 && R() < .35) spawnDrop(col, col.baseY);
      }
      if (S.temp > 2 && S.storm > .55 && R() < rate * dt * 2.2) spawnHail(col, col.baseY);
      col.front = Math.min(1, col.front + dt / .35);
    } else if (col) {
      col.front = Math.max(0, col.front - dt / .9);
      if (col.front <= 0) { columns.delete(c.id); }
    }
  }
  /* drops */
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    const col = d.col;
    const gy = groundY(d.x, d.z);
    d.life -= dt;
    d.y += d.vy * dt;
    d.x += gust.x * dt * 1.1;
    d.z += gust.z * dt * 1.1;
    if (d.y <= gy || d.life <= 0) {
      if (d.y <= gy) {
        const onWater = WG.terrain && WG.terrain.inLake ? WG.terrain.inLake(d.x, d.z) : false;
        if (R() < .18) splashAt(d.x, d.z, .6, onWater);
      }
      drops.splice(i, 1);
    }
  }
  /* flakes */
  const pos = flakeGeo.attributes.position.array;
  for (let i = flakes.length - 1; i >= 0; i--) {
    const f = flakes[i];
    f.life -= dt;
    f.y += f.vy * dt;
    f.x += (gust.x * .5 + Math.sin(S.sceneTime * 2 + f.ph) * .16) * dt;
    f.z += (gust.z * .5 + Math.cos(S.sceneTime * 1.7 + f.ph) * .16) * dt;
    if (f.y < groundY(f.x, f.z) + .01 || f.life <= 0) flakes.splice(i, 1);
  }
  for (let i = 0; i < MAX_FLAKES; i++) {
    const f = flakes[i];
    pos[i * 3] = f ? f.x : 0; pos[i * 3 + 1] = f ? f.y : -99; pos[i * 3 + 2] = f ? f.z : 0;
  }
  flakeGeo.attributes.position.needsUpdate = true;
  flakeGeo.setDrawRange(0, Math.max(1, flakes.length));

  /* hail with two bounces */
  for (let i = hails.length - 1; i >= 0; i--) {
    const h = hails[i];
    h.life -= dt;
    h.vy += -14 * dt;
    h.y += h.vy * dt;
    const gy = groundY(h.x, h.z) + .03;
    if (h.y <= gy) {
      h.y = gy;
      if (h.bounces < 2) { h.bounces++; h.vy = Math.abs(h.vy) * .42; }
      else if (R() < .3) splashAt(h.x, h.z, .3, false);
      else h.life = Math.min(h.life, .2);
    }
    if (h.life <= 0) hails.splice(i, 1);
  }
  for (let i = 0; i < hailMesh.count; i++) {
    const h = hails[i];
    if (!h) { _m.makeScale(0, 0, 0); hailMesh.setMatrixAt(i, _m); continue; }
    _p.set(h.x, h.y, h.z); _s.setScalar(1);
    _m.compose(_p, _q.identity(), _s);
    hailMesh.setMatrixAt(i, _m);
  }
  hailMesh.count = hails.length;

  /* rain streaks */
  let n = 0;
  for (const d of drops) {
    if (n >= MAX_DROPS) break;
    _p.set(d.x, d.y, d.z);
    _e.set(Math.atan2(Math.hypot(gust.x, gust.z) * .55, 12), Math.atan2(gust.x, gust.z) + Math.PI, 0);
    _q.setFromEuler(_e);
    _s.set(1, d.len, 1);
    _m.compose(_p, _q, _s);
    rainMesh.setMatrixAt(n++, _m);
  }
  rainMesh.count = n;
  rainMesh.instanceMatrix.needsUpdate = true;
  rainMat.opacity = .30 + Math.min(.5, S.rain * .5);
  rainMesh.visible = n > 0;
  flakeMesh.visible = flakes.length > 0;
  hailMesh.visible = hails.length > 0;

  /* splash sparks */
  const sp = sparkGeo.attributes.position.array;
  for (let i = sparks.length - 1; i >= 0; i--) {
    const k = sparks[i];
    k.life -= dt;
    k.vy += k.g * dt;
    k.y += k.vy * dt;
    if (k.life <= 0) sparks.splice(i, 1);
  }
  for (let i = 0; i < MAX_SPARKS; i++) {
    const k = sparks[i];
    sp[i * 3] = k ? k.x : 0; sp[i * 3 + 1] = k ? k.y : -99; sp[i * 3 + 2] = k ? k.z : 0;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.setDrawRange(0, Math.max(1, sparks.length));
  sparkMesh.visible = sparks.length > 0;
}

function updateFog(dt) {
  if (!fogMat) return;
  const target = U.clamp01(S.fog + S.rain * .1 + S.snowfall * .06);
  fogShown = U.damp(fogShown, target, .8, dt);
  fogGroup.visible = fogShown > .01;
  if (!fogGroup.visible) return;
  fogMat.uniforms.uDensity.value = fogShown;
  fogMat.uniforms.uTime.value = S.sceneTime;
  fogMat.uniforms.uWind.value.set(S.windVec.x, S.windVec.z);
  fogMat.uniforms.uGold.value = U.clamp01(S.golden * 1.2) * (1 - S.night);
  fogMat.uniforms.uFlash.value = S.flash;
  const lift = U.clamp01(S.temp / 14);
  for (let i = 0; i < fogPlanes.length; i++) {
    fogPlanes[i].position.y = .12 + i * (.22 + lift * .16);
    fogPlanes[i].scale.setScalar(1 - i * .07 + lift * .06);
  }
}

function updateLightning(dt) {
  if (L.life <= 0) {
    if (boltGroup.visible) {
      boltMat.opacity = Math.max(0, boltMat.opacity - dt * 6);
      glowSprite.material.opacity = Math.max(0, glowSprite.material.opacity - dt * 4);
      if (boltMat.opacity <= .01) boltGroup.visible = false;
    }
    return;
  }
  L.t += dt;
  L.life -= dt;
  if (L.life > .9) boltMat.opacity = .25 + R() * .2;
  else {
    const step = Math.floor(L.t * 26);
    if (step !== L.seq) {
      L.seq = step;
      boltMat.opacity = step < 4 ? 1 : (R() < .55 ? .9 : .25);
      S.flash = Math.max(S.flash, step < 3 ? .3 : .13);
    }
  }
  glowSprite.material.opacity = Math.max(0, L.life * 1.1);
  glowSprite.scale.setScalar(2.6 + L.life * 3.4);
  if (L.life <= 0) { boltGroup.visible = false; L.target = null; }
}

function updateSky(dt) {
  /* rainbow: rain falling in sunlight with the sun low, opposite the sun */
  const want = U.clamp01((S.rain * 1.4) * S.sunVis * (1 - S.night) * U.smoothstep(38, 8, S.sunAlt)) * (1 - S.storm * .3);
  rainbowV = U.damp(rainbowV, want, 1.1, dt);
  rainbow.visible = rainbow2.visible = rainbowV > .01;
  if (rainbow.visible) {
    rainbow.material.uniforms.uOpacity.value = rainbowV * .55;
    const az = S.moonAz; /* opposite the sun */
    rainbow.position.set(0, .9, 0);
    rainbow.rotation.set(0, 0, 0);
    rainbow.rotation.y = -az + Math.PI / 2;
    rainbow2.rotation.copy(rainbow.rotation);
    rainbow2.position.copy(rainbow.position);
  }
  const auroraWant = U.clamp01(S.night * (1 - S.cloudCover * 1.2) * (S.season > 1.85 && S.season < 2.6 ? 1 : .35) * (1 - S.fog));
  auroraV = U.damp(auroraV, auroraWant, .7, dt);
  aurora.visible = auroraV > .01;
  if (aurora.visible) {
    for (let i = 0; i < auroraMats.length; i++) {
      auroraMats[i].uniforms.uOpacity.value = auroraV;
      auroraMats[i].uniforms.uTime.value = S.sceneTime;
    }
  }
}

WG.register('weather', {
  order: 30,
  init() {
    try {
      buildFog();
      rodHitSetup();
      ready = true; weather.ready = true;
    } catch (e) { WG.warn('weather', e); }
  },
  update(dt) {
    if (!ready) return;
    try {
      flashCool = Math.max(0, flashCool - dt);
      updateRain(dt);
      updateFog(dt);
      updateLightning(dt);
      updateSky(dt);
      updateWisps(dt);
    } catch (e) { WG.warn('weather:update', e); }
  },
  dispose() {
    try {
      [rainGeo, flakeGeo, hailGeo, sparkGeo].forEach(g => g.dispose());
      [rainMat, flakeMat, hailMat, sparkMat, boltMat].forEach(m => m.dispose());
    } catch (e) { WG.warn('weather:dispose', e); }
  }
});

/* scenario / API hooks */
weather.setRain = function (cloud, rate) { if (cloud) cloud.rainRate = rate; };
weather.clearSky = function () {
  for (const c of (WG.clouds && WG.clouds.list) || []) c.rainRate = 0;
  drops.length = 0; flakes.length = 0; hails.length = 0; columns.clear();
};
weather.splash = function (pos, strength) {
  if (!pos) return;
  const onWater = WG.terrain && WG.terrain.inLake ? WG.terrain.inLake(pos.x, pos.z) : false;
  splashAt(pos.x, pos.z, strength || .6, onWater);
};

/* pick the storm cloud as the bolt source when the sim asks */
function rodHitSetup() {
  WG.on('cloudstorm', c => { if (c && c.pos) weather.lastStorm = c; });
}
weather.lastStorm = null;

/* faint white wisps tracing the wind tool */
const wisps = [];
const wispMat = new THREE.SpriteMaterial({
  map: WG.tex.glow, color: new THREE.Color(.9, .95, 1), transparent: true, opacity: .35,
  blending: THREE.AdditiveBlending, depthWrite: false
});
for (let i = 0; i < 26; i++) {
  const sp = new THREE.Sprite(wispMat.clone());
  sp.visible = false; sp.scale.set(.6, .34, 1);
  WG.groups.weather.add(sp);
  wisps.push({ sp, life: 0 });
}
let wispI = 0;
weather.windWisp = function (pos, power) {
  if (!pos) return;
  const w = wisps[wispI++ % wisps.length];
  w.sp.visible = true;
  w.sp.position.copy(pos);
  w.sp.material.opacity = .16 + Math.min(.4, power * .3);
  w.sp.scale.set(.5 + power * .5, .22 + power * .2, 1);
  w.life = .85;
};
function updateWisps(dt) {
  for (const w of wisps) {
    if (w.life <= 0) continue;
    w.life -= dt;
    w.sp.position.x += S.windVec.x * dt * .8;
    w.sp.position.z += S.windVec.z * dt * .8;
    w.sp.position.y += dt * .12;
    w.sp.material.opacity = Math.max(0, w.life) * .38;
    if (w.life <= 0) w.sp.visible = false;
  }
}
weather.strikeNearest = function () {
  const c = (WG.clouds && WG.clouds.list.find(x => x.storm > .3)) || weather.lastStorm;
  if (!c) return;
  doBolt(c.pos.clone().setY(c.pos.y - c.size * .5), .8 + c.storm * .5);
};
})();