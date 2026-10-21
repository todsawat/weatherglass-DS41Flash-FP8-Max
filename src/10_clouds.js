/* ===== 10_clouds.js — soft volumetric cumulus with tactile physics ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const C = WG.clouds = { ready: false, list: [], pickables: [], max: 10, hovered: null };
const MAX_LOBES = 13;
const lobeGeo = new THREE.IcosahedronGeometry(1, WG.quality.cloudSegs >= 12 ? 3 : 2);

const sharedU = () => ({
  uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: WG.col('#fff4e4') },
  uSkyCol: { value: WG.col('#5b7d9a') }, uGroundCol: { value: WG.col('#4d4a44') },
  uWater: { value: 0 }, uPeach: { value: 0 }, uNight: { value: 0 }, uHover: { value: 0 },
  uDissolve: { value: 0 }, uOpacity: { value: 1 }, uFlash: { value: 0 }, uSquash: { value: 0 },
  uSeed: { value: Math.random() * 100 }, uStorm: { value: 0 },
  uLobes: { value: Array.from({ length: MAX_LOBES }, () => new THREE.Vector3()) }
});
const VS = `
attribute float aLobe;
uniform float uTime, uSeed; uniform vec3 uLobes[${MAX_LOBES}];
varying vec3 vN, vV, vW, vLocal; varying float vY;
void main(){
  vec3 p = position;
  int li = int(aLobe);
  p += uLobes[li];
  vec3 n = normalize(normal);
  float t = uTime * .055;
  float n1 = sin(p.x*2.6 + t + uSeed) * cos(p.y*2.2 - t*.7) * sin(p.z*2.9 + t*.4);
  float n2 = sin(p.y*6.2 - t*1.1 + uSeed) * .45;
  p += n * (n1 * .17 + n2 * .085);
  vec4 wp = modelMatrix * vec4(p, 1.);
  vW = wp.xyz; vLocal = position;
  vN = normalize(mat3(modelMatrix) * n);
  vV = normalize(cameraPosition - wp.xyz);
  vY = position.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FS = `
uniform float uWater, uPeach, uNight, uHover, uDissolve, uOpacity, uFlash, uTime, uStorm;
uniform vec3 uSunCol, uSkyCol, uGroundCol, uSunDir;
varying vec3 vN, vV, vW, vLocal; varying float vY;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(vV);
  vec3 dom = normalize(vec3(vLocal.x, max(vLocal.y, -0.2) + .3, vLocal.z));
  n = normalize(mix(n, dom, .34));
  n += (vec3(hash(vW.xz * 7.), hash(vW.yz * 9.), hash(vW.xy * 11.)) - .5) * .34;
  n = normalize(n);
  float fres = pow(1. - abs(dot(n, v)), 2.0);
  float up = n.y * .5 + .5;
  float h = clamp((vY + .55) / 1.2, 0., 1.);
  vec3 white = vec3(.93, .93, .92);
  vec3 grey = vec3(.62, .65, .69);
  vec3 slate = vec3(.31, .34, .38);
  vec3 col = mix(white, grey, smoothstep(.16, .7, uWater));
  col = mix(col, slate, smoothstep(.58, 1., uWater) * .9);
  col *= mix(.36, 1.04, smoothstep(-.02, .62, up));
  col *= mix(.78, 1.03, h);
  col = mix(col, col * uGroundCol * 1.7 + .01, (1. - up) * .42);
  col = mix(col, col * vec3(.7, .74, .82), (1. - up) * .3);
  col *= mix(.6, 1., smoothstep(-.62, .12, vY));
  col *= 1. - uStorm * .7;
  col = mix(col, vec3(.09, .11, .14), uStorm * .7);
  col = mix(col, col * uSkyCol * 1.5, up * .18);
  float ndl = dot(n, uSunDir);
  float diff = smoothstep(-.4, .85, ndl);
  col = mix(col * .72, col * (1.12 + .45 * max(ndl, 0.)), diff);
  float lining = pow(max(dot(v, -uSunDir), 0.), 3.) * smoothstep(.1, 1., ndl + .4);
  col += uSunCol * lining * .8 * (1. - uWater * .4);
  col = mix(col, col * vec3(1.2, .95, .78) * 1.06, uPeach * (.3 + up * .45));
  col = mix(col, col * vec3(.4, .48, .7) + vec3(.015, .02, .04), uNight * .85);
  col += uSunCol * fres * (.05 + lining * .35);
  col += vec3(.72, .84, 1.) * uFlash * (.45 + fres * 1.4);
  col += vec3(.92, .88, .78) * uHover * (.1 + fres * .2);
  col *= .975 + hash(floor(vW.xz * 11. + vW.y * 6.)) * .05;
  float edge = 1. - smoothstep(.08, .78, fres);
  float a = clamp(edge, 0., 1.) * (.82 + .18 * smoothstep(.1, .55, up)) * (1. + uStorm * .5);
  a *= smoothstep(-.62, -.3, vY + sin(vW.x * 3.1 + uTime) * .05);
  a *= .86 + .28 * hash(floor(vW.xz * 8. + vW.y * 4.));
  a *= 1. - smoothstep(.7, 1., uDissolve) * smoothstep(.35, .85, hash(floor(vW.xz * 14.)));
  gl_FragColor = vec4(col, a * uOpacity);
}`;

function buildGeometry(lobes) {
  const pos = [], nor = [], lobeArr = [];
  const v = new THREE.Vector3(), nn = new THREE.Vector3(), nm = new THREE.Matrix3(), m = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let li = 0; li < lobes.length; li++) {
    const l = lobes[li];
    e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    q.setFromEuler(e);
    m.compose(l.base, q, l.scale);
    nm.getNormalMatrix(m);
    const p = lobeGeo.attributes.position, n = lobeGeo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      nn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      pos.push(v.x, v.y, v.z); nor.push(nn.x, nn.y, nn.z); lobeArr.push(li);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aLobe', new THREE.Float32BufferAttribute(lobeArr, 1));
  g.computeBoundingSphere();
  g.boundingSphere.radius *= 1.35;
  return g;
}

let nextId = 1;
const rand = (a, b) => a + Math.random() * (b - a);

C.spawn = function (pos, size) {
  size = size || rand(.58, 1.0);
  const u = sharedU();
  u.uSeed.value = Math.random() * 100;
  const mat = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VS, fragmentShader: FS,
    transparent: true, depthWrite: true, depthTest: true, side: THREE.FrontSide
  });
  const n = MAX_LOBES;
  const layout = [
    [0, 0, 0, 1.08], [-.62, -.06, .06, .74], [.62, -.05, -.04, .76],
    [0, -.1, .48, .64], [-.05, -.08, -.48, .62], [-.52, .24, -.16, .58],
    [.44, .26, .12, .6], [0, .32, -.02, .64], [-.2, -.2, .26, .54],
    [.26, -.18, -.28, .56], [-.82, -.1, .14, .44], [.82, -.09, .08, .46], [.04, .04, .72, .48]
  ];
  const lobes = [];
  const r = size;
  for (let i = 0; i < n; i++) {
    const [lx, ly, lz, ls] = layout[i % layout.length];
    const wx = r * rand(.9, 1.1);
    lobes.push({
      base: new THREE.Vector3(lx * r * wx, ly * r, lz * r * wx),
      scale: new THREE.Vector3(ls * r * rand(.96, 1.3), ls * r * rand(.58, .8), ls * r * rand(.9, 1.2)),
      off: new THREE.Vector3(), vel: new THREE.Vector3()
    });
  }
  const group = new THREE.Group();
  group.position.copy(pos);
  const mesh = new THREE.Mesh(buildGeometry(lobes), mat);
  mesh.renderOrder = 20; mesh.frustumCulled = false;
  group.add(mesh);
  const tower = new THREE.Mesh(lobeGeo, mat);
  tower.scale.set(r * .5, r * 1.5, r * .5); tower.position.set(0, r * .8, 0); tower.visible = false;
  group.add(tower);
  const anvil = new THREE.Mesh(lobeGeo, mat);
  anvil.scale.set(r * 2.0, r * .16, r * 1.5); anvil.position.set(0, r * 2.05, 0); anvil.visible = false;
  group.add(anvil);
  const baseDisc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: WG.tex.contact, color: WG.col('#4a515b'), transparent: true, opacity: .3, depthWrite: false
  }));
  baseDisc.rotation.x = Math.PI / 2;
  baseDisc.position.y = -r * .55;
  baseDisc.scale.set(r * 2.6, r * 1.7, 1);
  group.add(baseDisc);
  const pick = new THREE.Mesh(new THREE.SphereGeometry(r * 1.45, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(pick);
  WG.groups.clouds.add(group);
  const cloud = {
    id: nextId++, group, mesh, mat, u, lobes, pick, tower, anvil, baseDisc, pos: group.position,
    base: pos.clone(), vel: new THREE.Vector3(), radius: r * 1.3, size: r, baseSize: r,
    water: 0, state: 'dry', squeeze: 0, tremble: 0, charge: 0, chargeT: 0,
    rainRate: 0, storm: 0, age: S.sceneTime, heldAt: -1, held: false, hover: 0, hoverTarget: 0,
    touched: S.sceneTime, drag: new THREE.Vector3(), dragV: new THREE.Vector3(),
    wobble: 0, opacity: 0, dissolve: 0, dead: false, strikeT: 0, strikeCount: 0
  };
  pick.userData.cloud = cloud;
  C.pickables.push(pick);
  C.list.push(cloud);
  cloud.baseY = pos.y;
  while (C.list.length > C.max) {
    let oldest = null;
    for (const c of C.list) if (!c.held && c !== cloud && (!oldest || c.touched < oldest.touched)) oldest = c;
    if (!oldest) break; C.dissolve(oldest);
  }
  WG.emit('cloudspawn', cloud);
  return cloud;
};

C.dissolve = function (cloud) {
  if (!cloud || cloud.dead) return;
  cloud.dead = true;
  const pi = C.pickables.indexOf(cloud.pick); if (pi >= 0) C.pickables.splice(pi, 1);
  const idx = C.list.indexOf(cloud); if (idx >= 0) C.list.splice(idx, 1);
  const start = S.sceneTime;
  const tick = () => {
    if (!cloud.group.parent) return;
    const k = (S.sceneTime - start) / 1.7;
    if (k >= 1) {
      WG.groups.clouds.remove(cloud.group); cloud.mesh.geometry.dispose(); cloud.mat.dispose();
      return;
    }
    cloud.dissolve = k;
    cloud.group.scale.setScalar(1 + k * .3);
    cloud.mat.uniforms.uOpacity.value = 1 - k;
    requestAnimationFrame(tick);
  };
  tick();
  WG.emit('cloudgone', cloud);
};

C.nearest = function (point, maxDist) {
  let best = null, bd = maxDist * maxDist;
  for (const c of C.list) {
    if (c.dead) continue;
    const d = c.pos.distanceToSquared(point);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
};
C.atPointer = () => C.hovered;
C.squeeze = function (cloud, dt) { cloud.squeeze = Math.min(1, cloud.squeeze + dt * .55); cloud.touched = S.sceneTime; };
C.hold = function (cloud) {
  if (!cloud) return;
  cloud.held = true; cloud.heldAt = S.sceneTime; cloud.touched = S.sceneTime;
  WG.emit('cloudhold', cloud);
};
C.release = function (cloud, vel) {
  if (!cloud) return;
  cloud.held = false;
  if (vel) cloud.vel.add(vel);
  cloud.heldAt = -1;
  WG.emit('cloudrelease', cloud);
};
C.strike = function (cloud) {
  const from = cloud.pos.clone(); from.y -= cloud.size * .4;
  let to = null, best = null;
  if (WG.flora && WG.flora.trees) {
    for (const tr of WG.flora.trees) {
      if (Math.abs(tr.base.x) > 5.9 || Math.abs(tr.base.z) > 3.9) continue;
      const d = tr.base.distanceTo(cloud.pos) * (1 + (2.6 - tr.height) * .08);
      if (!best || d < best) { best = d; to = tr.base; }
    }
  }
  if (!to) {
    const lx = WG.terrain && WG.terrain.inLake ? WG.terrain.inLake(cloud.pos.x, cloud.pos.z) : false;
    if (lx) to = new THREE.Vector3(cloud.pos.x, S.waterY, U.clamp(cloud.pos.z, -3, 3.6));
    else {
      const gx = U.clamp(cloud.pos.x, -5, 5), gz = U.clamp(cloud.pos.z, -3., 3.6);
      const y = WG.terrain.heightAt ? WG.terrain.heightAt(gx, gz) : .3;
      to = new THREE.Vector3(gx, y, gz);
    }
  }
  cloud.strikeT = 1.8; cloud.charge = 0; cloud.water = Math.max(0, cloud.water - .12);
  cloud.u.uFlash.value = 1;
  if (WG.weather && WG.weather.bolt) WG.weather.bolt(from, to, 1);
  else WG.emit('lightning', { pos: to, cloud });
};

C.merge = function (a, b) {
  if (!a || !b || a.dead || b.dead) return a;
  const big = a.size >= b.size ? a : b, small = a.size >= b.size ? b : a;
  const size = Math.min(2.7, Math.sqrt(big.size * big.size + small.size * small.size));
  big.water = U.clamp01(big.water + small.water * .7 + .2);
  big.size = size; big.wobble = 1;
  big.vel.addScaledVector(small.vel, .3);
  C.dissolve(small);
  WG.emit('cloudmerge', { a: big, b: small });
  if (big.size > 1.5 && big.water > .62 && big.storm <= 0) { big.storm = .01; WG.emit('cloudstorm', big); }
  return big;
};
C.clearAll = function () {
  for (const c of [...C.list]) {
    c.dead = true;
    WG.groups.clouds.remove(c.group);
    const bi = blobs.findIndex(b => b.cloud === c);
    if (bi >= 0) { WG.groups.clouds.remove(blobs[bi].mesh); blobs.splice(bi, 1); }
  }
  C.list.length = 0; C.pickables.length = 0;
};
C.setHover = function (cloud) {
  for (const c of C.list) c.hoverTarget = c === cloud ? 1 : 0;
  C.hovered = cloud;
};

/* shadow blobs */
const blobs = [];
function updateBlobs(dt) {
  for (let i = blobs.length - 1; i >= 0; i--) {
    const b = blobs[i];
    if (b.cloud.dead) { WG.groups.clouds.remove(b.mesh); b.mesh.material.dispose(); blobs.splice(i, 1); continue; }
    const c = b.cloud;
    const y = WG.terrain.heightAt ? WG.terrain.heightAt(c.pos.x, c.pos.z) : .3;
    b.mesh.position.set(c.pos.x, y + .02, c.pos.z);
    const s = c.size * 3.4;
    b.mesh.scale.set(s, s, 1);
    b.mesh.rotation.z = -S.windAngle;
    const want = (c.rainRate * .5 + c.water * .16) * (y > -0.8 ? 1 : .4);
    b.opacity = U.damp(b.opacity, want, 2, dt);
    b.mesh.material.opacity = b.opacity;
    b.mesh.visible = b.opacity > .01;
  }
  for (const c of C.list) {
    if (blobs.some(b => b.cloud === c)) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: WG.tex.contact, color: 0x000000, transparent: true, opacity: 0, depthWrite: false
    }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
    WG.groups.clouds.add(m);
    blobs.push({ cloud: c, mesh: m, opacity: 0 });
  }
}

C.init = function () {
  C.ready = true;
  const base = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    base.set(-2.6 + i * 2.45, 5.65 + (i % 2) * .3, 2.4 - (i % 2) * .6);
    const c = C.spawn(base, .55 + i * .07);
    c.water = .1 + i * .02;
  }
  WG.emit('cloudsready');
};

function sunLightDir(){ return WG.tmp.v2.copy(WG.sky.light.position).normalize(); }

WG.register('clouds', {
  order: 28,
  init() { try { C.init(); } catch (e) { C.ready = false; WG.warn('clouds', e); } },
  update(dt, t) {
    if (!C.ready) return;
    const bound = { x: 5.5, z: 3.5, yMin: 4.1, yMax: 6.3 };
    const wv = S.windVec;
    for (let ci = C.list.length - 1; ci >= 0; ci--) {
      const c = C.list[ci];
      if (c.dead) continue;
      c.age += dt;
      const r = c.size * 1.45;
      c.hover = U.damp(c.hover, c.hoverTarget || 0, 6, dt);
      c.u.uHover.value = c.hover;
      if (!c.held && c.state !== 'storm') {
        const refill = U.clamp01((S.humidity - .4) * .05) * (1 - S.storm * .2) + .004;
        c.water = U.clamp01(c.water + (refill - .013 * (S.daylight * .7 + .3) * (1 - S.humidity * .8)) * dt);
      }
      if (c.water > .6) c.state = 'wet';
      if (c.water < .18) c.state = 'dry';
      const baseRain = c.storm > 0 ? .5 + S.storm * .55 : (c.state === 'wet' ? U.clamp01((c.water - .4) * 1.4) * .45 : 0);
      const targetRain = Math.min(1.25, baseRain + c.squeeze * (.55 + c.water * .8));
      c.rainRate = U.damp(c.rainRate, targetRain, 2.2, dt);
      if (c.rainRate > .01 && c.water > 0) c.water = Math.max(0, c.water - c.rainRate * dt * .078);
      if (c.held || c.heldAt > 0) c.touched = t;
      if (c.held) {
        const still = t - c.heldAt;
        if (still > .2) C.squeeze(c, dt);
        else c.squeeze = Math.max(0, c.squeeze - dt * .9);
        const ddx = c.drag.x - (c.lastDragX === undefined ? c.drag.x : c.lastDragX);
        const dir = Math.sign(ddx);
        if (Math.abs(ddx) > .004 && c.lastDir !== undefined && dir !== c.lastDir && dir !== 0) {
          c.shakeCount = (c.shakeCount || 0) + 1;
          if (c.shakeCount >= 3 && c.charge < .05) { c.charge = .35; WG.emit('cloudcharge', c); }
        }
        if (Math.abs(ddx) > .004) c.lastDir = dir;
        c.lastDragX = c.drag.x;
        if (c.shakeCount) c.shakeCount = Math.max(0, c.shakeCount - dt * .6);
        if (c.charge > 0) {
          c.chargeT -= dt;
          if (c.chargeT <= 0) { c.chargeT = .22; if (c.charge < 1) c.charge = Math.min(1, c.charge + .2); }
          if (c.charge >= .95 && !c.struckAt) { c.struckAt = t; C.strike(c); c.shakeCount = 0; }
        }
      } else {
        c.squeeze = U.damp(c.squeeze, 0, 1.6, dt);
        c.shakeCount = Math.max(0, (c.shakeCount || 0) - dt);
        if (c.strikeT > 0) { c.strikeT -= dt; if (c.strikeT < 0) { c.struckAt = null; c.charge = 0; } }
      }
      c.tremble = Math.max(c.tremble * (1 - dt * 2), c.squeeze * .5 + c.charge * .8);
      if (c.water <= .01 && !c.held && c.squeeze > .05) C.dissolve(c);
      if (c.storm > 0) {
        c.storm = Math.min(1, c.storm + dt * .18);
        c.water = Math.max(c.water, .6);
        c.tremble = Math.max(c.tremble, .3 * c.storm);
        if (c.storm > .5) {
          c.strikeCount += dt;
          if (c.strikeCount > 11 + Math.random() * 4) { c.strikeCount = 0; C.strike(c); }
        }
      }
      const sizeF = 1 / (.8 + c.size);
      if (c.held) {
        const dx = c.drag.x - c.pos.x, dz = c.drag.z - c.pos.z;
        c.vel.x += (dx * 26 - c.vel.x * 8) * dt;
        c.vel.z += (dz * 26 - c.vel.z * 8) * dt;
        c.dragV.set(c.vel.x, 0, c.vel.z);
        c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt;
      } else {
        const k = .32 * sizeF * (1 + c.storm);
        c.vel.x += (wv.x * k - c.vel.x * 1.1) * dt;
        c.vel.z += (wv.z * k - c.vel.z * 1.1) * dt;
        const gy = c.pos.y - c.baseY;
        c.vel.y += (-gy * 6 - c.vel.y * 3) * dt;
        c.pos.addScaledVector(c.vel, dt);
      }
      c.pos.y += Math.sin(t * .5 + c.id * 2.1) * .0009;
      let squash = 0;
      if (c.pos.x + r > bound.x) { c.pos.x = bound.x - r; if (c.vel.x > 0) c.vel.x *= -.45; squash = 1; }
      if (c.pos.x - r < -bound.x) { c.pos.x = -bound.x + r; if (c.vel.x < 0) c.vel.x *= -.45; squash = 1; }
      if (c.pos.z + r > bound.z) { c.pos.z = bound.z - r; if (c.vel.z > 0) c.vel.z *= -.45; squash = 1; }
      if (c.pos.z - r < -bound.z) { c.pos.z = -bound.z + r; if (c.vel.z < 0) c.vel.z *= -.45; squash = 1; }
      if (c.pos.y + r * .68 > bound.yMax) { c.pos.y = bound.yMax - r * .68; c.vel.y = Math.min(0, c.vel.y); squash = 1; }
      c.pos.y = Math.max(bound.yMin + r * .4, c.pos.y);
      c.u.uSquash.value = U.damp(c.u.uSquash.value, squash * .22 + c.squeeze * .3, 5, dt);
      for (const o of C.list) {
        if (o === c || o.dead) continue;
        if (c.pos.distanceTo(o.pos) < (c.radius + o.radius) * .72) { const res = C.merge(c, o); if (res !== c) ci = Math.min(ci, C.list.indexOf(res)); break; }
      }
      c.wobble = U.damp(c.wobble, 0, 2.4, dt);
      const grow = c.size / Math.max(.01, c.baseSize);
      const sq = 1 - c.squeeze * .3;
      const wob = 1 + Math.sin(t * 9 + c.id) * c.tremble * .035 + c.wobble * Math.sin(t * 13) * .09;
      c.group.scale.set(grow * (1 + c.squeeze * .22) * wob, grow * sq * .82 * wob, grow * (1 + c.squeeze * .16) * wob);
      c.group.position.y = c.pos.y - c.tremble * .015;
      c.opacity = U.damp(c.opacity, 1, 2.5, dt);
      c.u.uWater.value = c.water;
      c.u.uStorm.value = c.storm;
      c.u.uFlash.value = Math.max(c.u.uFlash.value * (1 - dt * 5), c.charge * .55 + c.strikeT * .12);
      c.u.uSunDir.value.copy(sunLightDir()).normalize();
      c.u.uSunCol.value.copy(WG.cols.sunlight).lerp(WG.cols.moon, S.night).multiplyScalar(.55 + S.daylight * .65);
      c.u.uPeach.value = S.golden; c.u.uNight.value = S.night;
      c.u.uOpacity.value = c.opacity;
      c.baseDisc.material.opacity = c.opacity * (.1 + c.water * .26);
      c.tower.visible = c.storm > .08; c.anvil.visible = c.storm > .25;
      const lidY = 7.2;
      const baseTop = c.pos.y + c.size * .9;
      const towerH = Math.max(.14, Math.min(c.size * (1.0 + c.storm * .6), lidY - baseTop - c.size * .2));
      c.tower.scale.set(c.size * .4, towerH, c.size * .4);
      c.tower.position.y = c.size * .9 + towerH * .45;
      c.anvil.scale.set(c.size * (1.05 + c.storm * .5), c.size * .13, c.size * (.8 + c.storm * .3));
      c.anvil.position.y = Math.min(c.size * (1.7 + c.storm * .8), Math.max(c.size * 1.05, lidY - c.pos.y - c.size * .18));
      c.mat.uniforms.uTime.value = t;
      for (let li = 0; li < c.lobes.length; li++) {
        const l = c.lobes[li];
        l.vel.x += (-l.off.x * 21 - l.vel.x * 5) * dt + c.vel.x * .45 * dt;
        l.vel.y += (-l.off.y * 21 - l.vel.y * 5) * dt;
        l.vel.z += (-l.off.z * 21 - l.vel.z * 5) * dt + c.vel.z * .45 * dt;
        l.off.addScaledVector(l.vel, dt).clampLength(0, .42);
        c.u.uLobes.value[li].copy(l.off);
      }
    }
    C.list.sort((a, b) => b.pos.distanceToSquared(WG.camera.position) - a.pos.distanceToSquared(WG.camera.position));
    for (let i = 0; i < C.list.length; i++) C.list[i].group.renderOrder = 100 + i;
    let cover = 0, shadow = 0;
    for (const c of C.list) {
      cover += c.size * (.13 + c.water * .3) * (1 + c.storm * .8);
      shadow += c.size * (.09 + c.water * .28) * U.clamp01(1 - Math.abs(c.pos.x) / 7);
    }
    S.cloudCover = U.damp(S.cloudCover, U.clamp01(cover * .5), .8, dt);
    S.cloudShadow = U.clamp01(shadow * .5);
    S.rain = U.damp(S.rain, U.clamp01(C.list.reduce((a, c) => a + c.rainRate * c.radius * .35, 0) / 2.4), 1.4, dt);
    let storm = 0;
    for (const c of C.list) storm = Math.max(storm, c.storm);
    S.storm = U.damp(S.storm, storm, .5, dt);
    updateBlobs(dt);
  }
});
})();