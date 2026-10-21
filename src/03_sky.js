/* ===== 03_sky.js — sun, moon, stars, light, time, season ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const DEG = Math.PI / 180;

const sun = new THREE.Group(), moon = new THREE.Group();
WG.groups.sky.add(sun, moon);

const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: WG.tex.sun, color: WG.col('#fff3d6'), transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, depthTest: true, opacity: 1
}));
sunGlow.scale.setScalar(9.5);
sun.add(sunGlow);
const sunCore = new THREE.Mesh(new THREE.SphereGeometry(.46, 20, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.4, 7.2) }));
sun.add(sunCore);
const sunPick = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
sun.add(sunPick);

const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({
  map: WG.tex.moon, color: WG.col('#cfe0ff'), transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, opacity: 1
}));
moonDisc.scale.setScalar(4.2);
moon.add(moonDisc);
const moonRing = new THREE.Sprite(new THREE.SpriteMaterial({
  map: WG.tex.glow, color: WG.col('#9fb9ff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0
}));
moonRing.scale.setScalar(13);
moon.add(moonRing);
const moonPick = new THREE.Mesh(new THREE.SphereGeometry(3.0, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
moon.add(moonPick);
WG.sky = { sun, moon, sunPick, moonPick, dragSun, dragMoon, ready: false };

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(WG.col('#b9d3e6').getHex(), WG.col('#3a2e22').getHex(), .7);
WG.scene.add(hemi);
const ambient = new THREE.AmbientLight(WG.col('#7590b4').getHex(), .16);
WG.scene.add(ambient);

const sunLight = new THREE.DirectionalLight(WG.col('#fff4e4').getHex(), 2.6);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(WG.quality.shadowMap, WG.quality.shadowMap);
const sc = sunLight.shadow.camera;
sc.left = -13; sc.right = 13; sc.top = 16; sc.bottom = -14; sc.near = .5; sc.far = 80;
sunLight.shadow.bias = -0.00035; sunLight.shadow.normalBias = .028; sunLight.shadow.radius = 3.5;
sunLight.target.position.set(0, 0, 0);
WG.scene.add(sunLight, sunLight.target);
const moonLight = new THREE.DirectionalLight(WG.col('#adc5ff').getHex(), 0);
moonLight.castShadow = false;
moonLight.target.position.set(0, 0, 0);
WG.scene.add(moonLight, moonLight.target);
const fill = new THREE.DirectionalLight(WG.col('#ffe8cd').getHex(), .0);
fill.position.set(-7, 9, 16); fill.target.position.set(0, 2, 0);
WG.scene.add(fill, fill.target);
WG.sky.fill = fill;
WG.sky.light = sunLight;
WG.sky.moonLight = moonLight;
WG.sky.hemi = hemi;

/* ---------- stars ---------- */
const starGeo = new THREE.BufferGeometry();
const N = WG.quality.stars;
const sp = new Float32Array(N * 3), sc2 = new Float32Array(N * 3), ss = new Float32Array(N), sph = new Float32Array(N);
const R = WG.rng('stars');
for (let i = 0; i < N; i++) {
  sp[i * 3] = (R() * 2 - 1) * 5.75;
  sp[i * 3 + 1] = 3.4 + R() * 3.7;
  sp[i * 3 + 2] = (R() * 2 - 1) * 3.8;
  const warm = R();
  const c = warm < .25 ? WG.cols.starB : WG.cols.starA;
  sc2[i * 3] = c.r; sc2[i * 3 + 1] = c.g; sc2[i * 3 + 2] = c.b;
  ss[i] = .6 + R() * 2.4; sph[i] = R() * 10;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
starGeo.setAttribute('aColor', new THREE.BufferAttribute(sc2, 3));
starGeo.setAttribute('aSize', new THREE.BufferAttribute(ss, 1));
starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sph, 1));
const starMat = new THREE.ShaderMaterial({
  uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uPR: { value: WG.quality.dpr } },
  vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aPhase;
    uniform float uTime, uPR; varying vec3 vC; varying float vTw;
    void main(){ vec4 mv = modelViewMatrix * vec4(position,1.);
      vTw = .55 + .45 * sin(uTime * 1.7 + aPhase * 6.28);
      vC = aColor; gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPR * (95. / -mv.z); }`,
  fragmentShader: `uniform float uOpacity; varying vec3 vC; varying float vTw;
    void main(){ vec2 p = gl_PointCoord - .5; float d = length(p);
      float a = smoothstep(.5, .0, d); a *= a;
      float cross = max(0., 1. - abs(p.x) * 22.) + max(0., 1. - abs(p.y) * 22.);
      gl_FragColor = vec4(vC * (1. + cross * .6), a * vTw * uOpacity); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const stars = new THREE.Points(starGeo, starMat);
stars.frustumCulled = false;
WG.groups.sky.add(stars);

/* shooting star */
const shootTex = WG.canvasTex(64, 8, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.85, 'rgba(235,242,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const rg = g.createRadialGradient(w - 2, h / 2, 0, w - 2, h / 2, 8);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, w, h);
}, { wrap: THREE.ClampToEdgeWrapping });
const shootMat = new THREE.MeshBasicMaterial({ map: shootTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
const shoot = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .18), shootMat);
shoot.visible = false; shoot.frustumCulled = false;
WG.groups.sky.add(shoot);
let shootT = 8 + Math.random() * 12, shootLife = 0, shootFrom = new THREE.Vector3(), shootDir = new THREE.Vector3();
function shootingStar(dt) {
  shootT -= dt;
  if (shootT <= 0 && S.night > .5 && S.cloudCover < .55) {
    shootT = 15 + Math.random() * 25; shootLife = 1;
    shootFrom.set(-5 + Math.random() * 2, 5.5 + Math.random() * 1.2, -3 + Math.random() * 2);
    shootDir.set(5 + Math.random() * 3, -1.2 - Math.random(), 1 + Math.random() * 3).normalize();
    shoot.visible = true;
  }
  if (shootLife > 0) {
    shootLife -= dt * .8;
    const p = shootFrom.clone().addScaledVector(shootDir, (1 - shootLife) * 7.5);
    shoot.position.copy(p);
    shoot.lookAt(p.clone().add(shootDir));
    shootMat.opacity = Math.max(0, shootLife) * .9;
    if (shootLife <= 0) shoot.visible = false;
  }
}

/* ---------- time ---------- */
let hourTarget = null;
const time = WG.time = {
  get value() { return S.time; },
  addHours(dh) {
    let v = S.time + dh;
    v = ((v % 24) + 24) % 24;
    S.time = v; hourTarget = null; WG.emit('time', v);
  },
  glideTo(h) {
    hourTarget = h;
    // choose nearest wrap
    let d = h - S.time;
    while (d > 12) { hourTarget -= 24; d = hourTarget - S.time; }
    while (d < -12) { hourTarget += 24; d = hourTarget - S.time; }
  },
  setTime(h, glide) { if (glide) time.glideTo(h); else { S.time = h; hourTarget = null; WG.emit('time', h); } }
};
function updateTime(dt) {
  if (S.playing) {
    S.time = (S.time + dt * 24 / 300) % 24;
    hourTarget = null;
    return;
  }
  if (hourTarget !== null) {
    const d = hourTarget - S.time;
    S.time += d * Math.min(1, dt * 3.4);
    if (Math.abs(d) < .002) { S.time = hourTarget; hourTarget = null; }
    S.time = ((S.time % 24) + 24) % 24;
  }
}
let dragT = 0, dragV = 0, dragMode = 0;
function dragSun(dh) { time.addHours(dh); dragV = dh; dragT = .35; WG.emit('sundrag'); }
function dragMoon(dh) { time.addHours(dh); dragV = dh; dragT = .35; }

/* ---------- season ---------- */
let seasonT = 0, seasonVel = 0;
WG.season = {
  get value() { return S.season; },
  set(v, glide) {
    const target = ((v % 4) + 4) % 4;
    if (!glide) { S.season = target; return; }
    seasonT = target;
    let d = target - S.season; while (d > 2) d -= 4; while (d < -2) d += 4; seasonT = S.season + d;
    WG.emit('season', target);
  },
  nudge(d) { S.season = ((S.season + d) % 4 + 4) % 4; seasonT = S.season; }
};
let lastSeasonIdx = 0;
function updateSeason(dt) {
  if (S.season !== seasonT) {
    const diff = seasonT - S.season;
    S.season += Math.sign(diff) * Math.min(Math.abs(diff), dt * .62);
    if (Math.abs(diff) < .002) { S.season = ((seasonT % 4) + 4) % 4; }
  }
  S.season = ((S.season % 4) + 4) % 4;
  const idx = Math.floor(S.season + .5) % 4;
  if (idx !== lastSeasonIdx) { lastSeasonIdx = idx; WG.emit('seasonchange', idx); }
}

/* ---------- celestial ---------- */
const SUN_R = 27;
const maxAltBySeason = (s) => [47.5, 63, 45, 32][Math.floor(s + .5) % 4];
function skyAngle(t) { return (t - 12) / 24 * Math.PI * 2; }
function altAt(t, season) {
  const rise = 6, set = 18;
  if (t >= rise && t <= set) return maxAltBySeason(season) * Math.sin(Math.PI * (t - rise) / 12) * DEG;
  return -22 * DEG * Math.sin(Math.PI * ((t < rise ? t + 24 : t) - set) / 12);
}
function computeCelestial() {
  const alt = altAt(S.time, S.season);
  const az = skyAngle(S.time);
  S.sunAlt = alt / DEG; S.sunAz = az;
  const visual = alt * .085;
  const ca = Math.cos(Math.max(visual, -.4));
  const az2 = az + Math.PI / 2 - .34;
  sun.position.set(-Math.sin(az2) * ca * SUN_R, Math.sin(visual) * SUN_R, Math.cos(az2) * ca * SUN_R);
  moon.position.set(Math.sin(az2) * ca * SUN_R * .97, -Math.sin(visual) * SUN_R, -Math.cos(az2) * ca * SUN_R);
  S.sunPos.copy(sun.position); S.moonPos.copy(moon.position);
  S.moonAlt = -S.sunAlt; S.moonAz = az + Math.PI;
}

/* occlusion by mountains (coarse) */
let occT = 0;
function sunOccluded() {
  const d = sun.position.clone().normalize();
  const wallZ = -4, wallX = 6;
  let px = 0, pz = 0, t = 0;
  if (d.z < -0.12) { t = wallZ / d.z; }
  else if (Math.abs(d.x) > 0.1) { t = (d.x > 0 ? wallX : -wallX) / d.x; }
  else return 0;
  if (t <= 0) return 0;
  px = d.x * t; pz = d.z * t;
  const h = (WG.terrain && WG.terrain.heightAt ? WG.terrain.heightAt(U.clamp(px, -5.9, 5.9), U.clamp(pz, -3.9, 3.9)) : 0) + .06;
  return d.y * t < h ? 1 : 0;
}

/* ---------- per-frame ---------- */
WG.register('sky', {
  order: 10,
  init() {
    computeCelestial();
    WG.sky.ready = true;
  },
  update(dt, t) {
    updateTime(dt);
    updateSeason(dt);
    computeCelestial();
    occT -= dt;
    if (occT < 0) { occT = .2; S.sunOcc = sunOccluded(); }
    const alt = S.sunAlt, ngt = U.smoothstep(1, 9, -alt);
    const dir = U.smoothstep(-4, 9, alt);
    const cover = U.clamp01(S.cloudCover + S.storm * .45);
    S.night = ngt;
    S.dusk = U.smoothstep(6, -2, alt) * (1 - ngt) * .85;
    S.daylight = U.clamp01(dir * (1 - cover * .72) + .04);
    S.golden = U.clamp01(U.smoothstep(15, 2, alt) * (1 - ngt)) * (S.time > 13 ? 1 : .55);
    const warm = S.golden;
    const sunCol = WG.cols.sunlight.clone().lerp(WG.col('#ffcf9c'), U.clamp01(warm * .9 + U.smoothstep(18, 2, alt) * .4));
    sunCol.lerp(WG.col('#ff9a63'), U.smoothstep(9, 0, alt) * .7);
    sunGlow.material.color.copy(sunCol).lerp(WG.col('#ffd7a2'), .45).multiplyScalar(1.15);
    sunGlow.material.opacity = U.clamp01(.9 * S.sunVis + .15) * (1 - cover * .6);
    sunGlow.scale.setScalar(9.5 + (S.hoverSun ? 1.8 : 0) + (1 - U.clamp01(alt / 20)) * 3.2);
    sunCore.material.color.copy(sunCol).multiplyScalar(10);
    sunCore.scale.setScalar(1 + (1 - U.clamp01(alt / 35)) * .22);
    sun.visible = alt > -4;
    moon.visible = true;
    moonDisc.material.opacity = U.clamp01(U.smoothstep(-4, 8, -alt) * .95 + .05) * (1 - cover * .7);
    moonDisc.material.color = WG.cols.moon.clone().multiplyScalar(S.hoverMoon ? 1.5 : 1.1);
    moonRing.material.opacity = moonDisc.material.opacity * S.humidity * .35;
    moonRing.scale.setScalar(11 + S.humidity * 5);
    S.moonVis = U.clamp01(U.smoothstep(-4, 8, -alt)) * (1 - cover * .65);
    S.sunVis = U.clamp01(U.smoothstep(-3, 6, alt)) * (1 - cover * .55) * (1 - (S.sunOcc || 0));
    // lights
    const lvl = U.clamp01(S.sunVis);
    sunLight.intensity = 4.4 * lvl * (1 - S.storm * .5) + .05;
    sunLight.color.copy(sunCol);
    WG.tmp.v1.copy(sun.position); WG.tmp.v1.z *= -1; WG.tmp.v1.x *= .92; sunLight.position.copy(WG.tmp.v1).multiplyScalar(1.35);
    const ml = U.clamp01(S.moonVis) * (1 - S.cloudCover * .7);
    moonLight.intensity = 1.0 * ml;
    WG.tmp.v1.copy(moon.position); WG.tmp.v1.z *= -1; moonLight.position.copy(WG.tmp.v1).multiplyScalar(1.5);
    hemi.intensity = .55 + lvl * .75 + ml * .25;
    hemi.color.copy(WG.cols.sunlight).lerp(WG.cols.moon, ngt * .75);
    hemi.groundColor.copy(WG.cols.grassShade).lerp(WG.cols.soil, .5);
    ambient.intensity = .17 + ngt * .08 + lvl * .08;
    ambient.color.copy(WG.cols.moon);
    // exposure & background & fog
    S.exposure = 1.3 + ngt * .55 + S.golden * .06 - S.storm * .12;
    const bg = WG.col('#181411').lerp(WG.col('#2a2119'), S.golden * .7).lerp(WG.col('#121010'), ngt)
      .lerp(WG.col('#0d0b0a'), S.storm * .6);
    WG.scene.background.copy(bg);
    WG.scene.fog.color.copy(bg).lerp(WG.cols.cloud, S.fog * .35 + S.humidity * .1);
    WG.scene.fog.density = Math.min(.012, .0023 + S.humidity * .004 + S.fog * .012 + S.rain * .006 + S.snowfall * .003 + S.storm * .003);
    // stars
    const starOp = S.night * U.clamp01(1 - S.cloudCover * 1.2) * U.clamp01(1 - S.fog * 1.1) * U.clamp01(1 - S.storm);
    starMat.uniforms.uOpacity.value = starOp * .95;
    starMat.uniforms.uTime.value = t;
    starMat.uniforms.uPR.value = rendererPixelRatio();
    stars.visible = starOp > .01;
    if (stars.visible) stars.scale.setScalar(1);
    shootingStar(dt);
    fill.intensity = .1 + lvl * 1.15;
    fill.color.copy(WG.cols.sunlight).lerp(WG.col('#ffd6ad'), S.golden * .8);
    // sun hover
    if (S.hoverSun) sunGlow.material.opacity = Math.min(1, sunGlow.material.opacity + .2);
    WG.env.dirty = true;
  }
});
function rendererPixelRatio() { return WG.renderer.getPixelRatio(); }

/* season reset on init */
lastSeasonIdx = Math.floor(S.season + .5) % 4;
})();