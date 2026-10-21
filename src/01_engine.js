/* ===== 01_engine.js — renderer, camera, post, loop ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util;

/* ---------- capability ---------- */
function glOk() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    WG.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || '');
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}
if (!glOk()) {
  const n = document.getElementById('nogl'); if (n) n.style.display = 'flex';
  const l = document.getElementById('loading'); if (l) l.style.display = 'none';
  return;
}
if (/swiftshader|llvmpipe|software/i.test(WG.gpu || '') && !WG.quality.forced) {
  WG.quality.level = 0; WG.quality.dpr = Math.min(devicePixelRatio || 1, 1);
  WG.quality.reflections = false; WG.quality.tiltShift = false; WG.quality.blur = false;
}
if (/Apple M\d|NVIDIA|Radeon|Intel.*Arc/i.test(WG.gpu || '') && WG.quality.level < 1 && !WG.quality.mobile) WG.quality.level = Math.max(WG.quality.level, 1);

/* ---------- scene / renderer ---------- */
const scene = WG.scene = new THREE.Scene();
scene.background = WG.col('#171310');
scene.fog = new THREE.FogExp2(WG.col('#241e19').getHex(), 0.0075);
for (const k in WG.groups) scene.add(WG.groups[k]);

const canvas = document.getElementById('c');
const renderer = WG.renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: false, stencil: false, depth: true,
  powerPreference: 'high-performance', preserveDrawingBuffer: false
});
renderer.setPixelRatio(WG.quality.dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.info.autoReset = false;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); WG.warn('gl', 'context lost'); });
canvas.addEventListener('webglcontextrestored', () => { WG.warn('gl', 'context restored'); setTimeout(() => location.reload(), 500); });

/* ---------- camera ---------- */
const camera = WG.camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.12, 160);
scene.add(camera);

const rig = WG.cameraRig = {
  az: THREE.MathUtils.degToRad(22), el: THREE.MathUtils.degToRad(25), dist: 20.4,
  target: new THREE.Vector3(0, 2.05, 0),
  azT: THREE.MathUtils.degToRad(22), elT: THREE.MathUtils.degToRad(25), distT: 20.4,
  panX: 0, panY: 0, panXT: 0, panYT: 0,
  trauma: 0, shakeT: 0, idle: 0, intro: 1,
  fov: 34, fovT: 34,
  baseEl: THREE.MathUtils.degToRad(25), baseDist: 20.4,
  orbit(dx, dy) {
    this.azT -= dx * 0.0052;
    this.elT = U.clamp(this.elT + dy * 0.0042, 0.035, 1.46);
    WG.state.lastInput = WG.state.sceneTime;
  },
  zoom(f) {
    this.userZoomed = true;
    let d = this.distT * Math.pow(1.0016, f);
    if (this.distT < 13) d = this.distT * Math.pow(1.0026, f);
    this.distT = U.clamp(d, 7.6, 46);
    WG.state.lastInput = WG.state.sceneTime;
  },
  pan(dx, dy) {
    const s = this.dist * 0.0011;
    this.panXT = U.clamp(this.panXT - Math.cos(this.az) * dx * s, -3, 3);
    this.panYT = U.clamp(this.panYT + dy * s, -1.6, 2.2);
  },
  shake(a) { this.trauma = Math.min(1, this.trauma + a); },
  focus(p, dist) {
    this.target.lerp(p, .55);
    if (dist) this.distT = U.clamp(dist, 8, 40);
  },
  reset() {
    this.azT = THREE.MathUtils.degToRad(22); this.elT = THREE.MathUtils.degToRad(25);
    this.distT = 20.4; this.panXT = this.panYT = 0; this.target.set(0, 2.05, 0);
  }
};

function resize() {
  const w = innerWidth, h = innerHeight;
  const portraitPhone = h > w * 1.4 && Math.min(w, h) < 620;
  rig.baseDist = portraitPhone ? 43 : (w < 760 ? 22.6 : 20.4);
  rig.fovT = portraitPhone ? 46 : (w < 760 ? 38 : 34);
  if (portraitPhone && !rig.portraitSet) {
    rig.portraitSet = true; rig.dist = rig.distT = 43; rig.target.y = 2.4;
    MQ_PORTRAIT: {}
  }
  if (!portraitPhone) rig.portraitSet = false;
  camera.aspect = w / h; camera.fov = rig.fov; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, WG.quality.dpr));
  renderer.setSize(w, h, false);
  post.resize(w, h);
  WG.state.dpiDirty = true;
  if (!portraitPhone) rig.distT = Math.min(rig.distT, rig.baseDist * 1.6);
}
addEventListener('resize', resize);

/* ---------- post-processing ---------- */
const post = WG.post = (function () {
  let w = 1, h = 1;
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false, format: THREE.RGBAFormat };
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, samples: WG.quality.level >= 1 ? 2 : 0 });
  sceneRT.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const brightRT = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false, samples: 0 });
  const blurA = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false, samples: 0 });
  const blurB = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false, samples: 0 });
  const dofA = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false, samples: 0 });
  const dofB = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false, samples: 0 });
  const quadGeo = new THREE.BufferGeometry();
  quadGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  quadGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(quadGeo, null); quad.frustumCulled = false;
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const VS = `varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`;
  function mat(frag, uniforms, extra) {
    return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra });
  }
  const brightMat = mat(`
    uniform sampler2D tSrc; uniform vec2 texel; uniform float threshold, knee; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tSrc, vUv + texel*.5).rgb * .25 + texture2D(tSrc, vUv - texel*.5).rgb * .25
             + texture2D(tSrc, vUv + vec2(texel.x,-texel.y)*.5).rgb * .25 + texture2D(tSrc, vUv + vec2(-texel.x,texel.y)*.5).rgb * .25;
      float l = max(c.r, max(c.g, c.b));
      float k = max(0., l - threshold) / max(knee + l - threshold, 1e-4);
      gl_FragColor = vec4(min(c, vec3(22.)) * k * k, 1.);
    }`, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 0.9 }, knee: { value: .7 } });
  const blurMat = mat(`
    uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb * .2270270;
      c += (texture2D(tSrc, vUv + dir * 1.3846).rgb + texture2D(tSrc, vUv - dir * 1.3846).rgb) * .3162162;
      c += (texture2D(tSrc, vUv + dir * 3.2308).rgb + texture2D(tSrc, vUv - dir * 3.2308).rgb) * .0702702;
      gl_FragColor = vec4(c, 1.);
    }`, { tSrc: { value: null }, dir: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending });
  const copyMat = mat(`uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.); }`, { tSrc: { value: null } });
  const finalMat = mat(`
    uniform sampler2D tSharp, tBlur, tBloom, tSrc;
    uniform vec2 res; uniform float exposure, vignette, grain, time, focusStr, focusPos, focusWidth, warm, flash;
    uniform vec3 flashCol; uniform float blurOn;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    void main(){
      vec2 uv = vUv;
      vec2 dir = uv - .5;
      float ca = dot(dir, dir) * .0022;
      vec3 sharp = vec3(texture2D(tSharp, uv + dir * ca).r, texture2D(tSharp, uv).g, texture2D(tSharp, uv - dir * ca).b);
      vec3 c = sharp;
      if (blurOn > .5) {
        float d = abs(uv.y - focusPos);
        float m = smoothstep(focusWidth, focusWidth + .30, d) * focusStr;
        m = max(m, smoothstep(.44, .92, abs(uv.y - .5)) * .65 * focusStr);
        vec3 bl = texture2D(tBlur, uv).rgb;
        c = mix(sharp, bl, clamp(m, 0., .96));
      }
      c += texture2D(tBloom, uv).rgb * .55;
      c += flashCol * flash * (0.28 + 0.5 * texture2D(tSrc, uv).a);
      c *= exposure;
      c = aces(c);
      float gw = smoothstep(.35, 1., c.g * .6 + c.r * .4 + c.b * .25);
      c = mix(c, c * vec3(1.06, 1.0, .92), gw * warm);
      c += vec3(.008, .006, .004) * warm;
      float vig = smoothstep(.28, .92, length(dir * vec2(1.04, .92)));
      c *= mix(1., .78, vig * vignette);
      float gr = hash(uv * res + fract(time) * 137.13) - .5;
      c += gr * grain;
      c = pow(max(c, 0.), vec3(.4545));
      c += (hash(uv * res + 3.1) - .5) / 255.;
      gl_FragColor = vec4(c, 1.);
    }`, {
    tSharp: { value: null }, tBlur: { value: null }, tBloom: { value: null }, tSrc: { value: null },
    res: { value: new THREE.Vector2(1, 1) }, exposure: { value: 1.05 }, vignette: { value: .85 }, grain: { value: .021 },
    time: { value: 0 }, focusStr: { value: .0 }, focusPos: { value: .52 }, focusWidth: { value: .13 }, warm: { value: 1 },
    blurOn: { value: WG.quality.tiltShift ? 1 : 0 }, flash: { value: 0 }, flashCol: { value: new THREE.Color(0, 0, 0) }
  });
  let scale = 1;
  function resize(w2, h2) {
    w = w2; h = h2;
    const pr = renderer.getPixelRatio();
    const pw = Math.max(2, Math.floor(w * pr)), ph = Math.max(2, Math.floor(h * pr));
    sceneRT.setSize(pw, ph);
    brightRT.setSize(Math.max(2, pw >> 2), Math.max(2, ph >> 2));
    blurA.setSize(Math.max(2, pw >> 2), Math.max(2, ph >> 2));
    blurB.setSize(Math.max(2, pw >> 2), Math.max(2, ph >> 2));
    dofA.setSize(Math.max(2, pw >> 1), Math.max(2, ph >> 1));
    dofB.setSize(Math.max(2, pw >> 1), Math.max(2, ph >> 1));
    finalMat.uniforms.res.value.set(pw, ph);
    finalMat.uniforms.blurOn.value = WG.quality.tiltShift ? 1 : 0;
  }
  function blit(m, target) {
    quad.material = m; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam);
  }
  function render(dt, focus) {
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);
    // focus / smart resize
    if (scale !== WG.quality.scale) { scale = WG.quality.scale; renderer.setPixelRatio(Math.min(devicePixelRatio, WG.quality.dpr) * scale); resize(innerWidth, innerHeight); }
    const pa = renderer.getPixelRatio();
    brightMat.uniforms.tSrc.value = sceneRT.texture;
    brightMat.uniforms.texel.value.set(1 / (w * pa), 1 / (h * pa));
    blit(brightMat, brightRT);
    if (WG.quality.blur) {
      blurMat.uniforms.tSrc.value = brightRT.texture;
      blurMat.uniforms.dir.value.set(3.5 / (w * pa / 4), 0);
      blit(blurMat, blurA);
      blurMat.uniforms.tSrc.value = blurA.texture;
      blurMat.uniforms.dir.value.set(0, 3.5 / (h * pa / 4));
      blit(blurMat, blurB);
    } else {
      blit(copyMat, blurB);
    }
    if (WG.quality.tiltShift) {
      const dofRadius = .7 + focus.strength * 1.9;
      blurMat.uniforms.tSrc.value = sceneRT.texture;
      blurMat.uniforms.dir.value.set(dofRadius / (w * pa / 2), 0);
      blit(blurMat, dofA);
      blurMat.uniforms.tSrc.value = dofA.texture;
      blurMat.uniforms.dir.value.set(0, dofRadius / (h * pa / 2));
      blit(blurMat, dofB);
      finalMat.uniforms.tBlur.value = dofB.texture;
    } else {
      finalMat.uniforms.tBlur.value = sceneRT.texture;
    }
    finalMat.uniforms.tSharp.value = sceneRT.texture;
    finalMat.uniforms.tBloom.value = blurB.texture;
    finalMat.uniforms.tSrc.value = sceneRT.texture;
    finalMat.uniforms.focusStr.value = focus.strength;
    finalMat.uniforms.focusWidth.value = focus.width;
    finalMat.uniforms.focusPos.value = focus.center;
    finalMat.uniforms.time.value = WG.state.sceneTime;
    finalMat.uniforms.exposure.value = WG.state.exposure;
    finalMat.uniforms.warm.value = 1 + WG.state.golden * .55;
    finalMat.uniforms.flash.value = WG.state.flash;
    finalMat.uniforms.flashCol.value.copy(WG.state.flashColor || WG.cols.moon);
    blit(finalMat, null);
    renderer.info.reset();
  }
  return {
    resize, render,
    setFocus() {}, flash() {},
    setExposure(v) { WG.state.exposure = v; }
  };
})();

/* ---------- environment map (softboxes) ---------- */
WG.env = (function () {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#5a5044');
  const panelGeo = new THREE.PlaneGeometry(1, 1);
  const panels = [];
  function panel(w2, h2, col, intensity, pos, look) {
    const m = new THREE.Mesh(panelGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(intensity * 1.5), side: THREE.DoubleSide }));
    m.scale.set(w2, h2, 1); m.position.copy(pos); m.lookAt(look);
    envScene.add(m); panels.push(m); return m;
  }
  const c = new THREE.Vector3(0, 3, 0);
  panel(7, 17, '#fff3e0', 1.8, new THREE.Vector3(-16, 4, 9), c);
  panel(7, 17, '#fff0da', 1.7, new THREE.Vector3(17, 4, 8), c);
  panel(7, 16, '#ffe9cf', 1.0, new THREE.Vector3(4, 5, -18), c);
  panel(8, 15, '#ffe6c8', .9, new THREE.Vector3(-5, 6, 19), c);
  panel(10, 10, '#fff6e8', 1.7, new THREE.Vector3(1, 22, 2), c);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  let tex = null, dirty = true, last = -1;
  function refresh() { dirty = true; }
  function update() {
    if (!dirty || WG.state.sceneTime - last < 0.7) return;
    dirty = false; last = WG.state.sceneTime;
    const dim = U.clamp01(0.18 + WG.state.daylight * .85 - WG.state.storm * .35);
    for (const p of panels) p.material.color.multiplyScalar(0).addScalar(0).add(p.userData?.base || p.material.color);
    // simpler: scale material colors by dim from stored base
    for (let i = 0; i < panels.length; i++) {
      const p = panels[i];
      if (!p.userData.base) p.userData.base = p.material.color.clone();
      p.material.color.copy(p.userData.base).multiplyScalar(dim);
    }
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 100);
    if (tex) tex.dispose();
    tex = rt.texture;
  }
  WG.on('env', refresh);
  return { scene: envScene, refresh, update, get tex() { return tex; } };
})();

/* ---------- main loop ---------- */
const clock = new THREE.Clock();
WG.clock = clock;
let acc = 0, frames = 0, fpsTime = 0, lowCount = 0, highCount = 0;
WG.paused = false;

function updateCamera(dt, t) {
  const st = WG.state;
  const portrait = innerHeight > innerWidth * 1.4 && Math.min(innerWidth, innerHeight) < 620;
  if (portrait) {
    rig.fovT = 46; rig.baseDist = 43;
    if (!rig.userZoomed) { rig.distT = Math.max(rig.distT, 43); rig.target.y = 2.4; }
  } else if (rig.wasPortrait) { rig.userZoomed = false; }
  rig.wasPortrait = portrait;
  rig.az = U.damp(rig.az, rig.azT, 7, dt);
  rig.el = U.damp(rig.el, rig.elT, 7, dt);
  rig.dist = U.damp(rig.dist, rig.distT, 6, dt);
  rig.panX = U.damp(rig.panX, rig.panXT, 5, dt);
  rig.panY = U.damp(rig.panY, rig.panYT, 5, dt);
  rig.fov = U.damp(rig.fov, rig.fovT, 5, dt);
  camera.fov = rig.fov;
  const idle = t - st.lastInput;
  rig.idle = idle > 30 ? Math.min(1, (idle - 30) / 30) : 0;
  const sway = rig.idle * (Math.sin(t * .13) * 1.6 + Math.sin(t * .071 + 2) * 2.4);
  const az = rig.az + sway * Math.PI / 180;
  const el = U.clamp(rig.el + rig.idle * Math.sin(t * .09 + 1) * .008, .03, 1.48);
  const d = rig.dist;
  const ty = rig.target.y + rig.panY + Math.sin(t * .61) * .022 + Math.sin(t * .23) * .012;
  const cx = Math.sin(az) * Math.cos(el) * d + rig.panX;
  const cz = Math.cos(az) * Math.cos(el) * d;
  const cy = Math.sin(el) * d + ty;
  camera.position.set(cx, cy, cz);
  camera.lookAt(rig.panX, ty, 0);
  // shake
  rig.trauma = Math.max(0, rig.trauma - dt * 1.7);
  if (rig.trauma > 0) {
    const s = rig.trauma * rig.trauma;
    rig.shakeT += dt * 38;
    camera.position.x += (WG.noise2(rig.shakeT, 1.3) - .5) * s * .45;
    camera.position.y += (WG.noise2(rig.shakeT, 8.1) - .5) * s * .4;
    camera.rotation.z += (WG.noise2(rig.shakeT, 4.7) - .5) * s * .02;
  }
  // intro
  if (rig.intro > 0) {
    rig.intro = Math.max(0, rig.intro - dt * .55);
    const e = U.easeOut(1 - rig.intro);
    camera.fov = U.lerp(rig.fov + 4, rig.fov, e);
  }
  camera.updateProjectionMatrix();
}

function updateFocus() {
  const zf = U.clamp01((rig.distT - 10) / 26);
  const el = rig.el;
  const strength = (1 - zf) * (1 - U.clamp01((el - 1.05) / .4)) * .68;
  const width = U.lerp(.24, .1, 1 - zf);
  return { strength, width, center: .5 };
}
let postFocus = { strength: .4, width: .15, center: .5 };

function step(dt, raw, doRender) {
  const st = WG.state;
  st.dtAvg = st.dtAvg * .92 + raw * .08;
  st.fps = 1 / Math.max(.0001, st.dtAvg);
  st.frames++; st.sceneTime += raw;
  dt = Math.min(dt, 1 / 20);
  if (WG.quality.level === 2) dt = Math.min(dt, 1 / 30);

  // adaptive resolution
  fpsTime += raw; frames++;
  if (fpsTime > 2.4) {
    const fps = frames / fpsTime;
    if (fps < 48 && WG.quality.scale > .62) { lowCount++; highCount = 0; } 
    else if (fps > 57 && WG.quality.scale < 1) { highCount++; lowCount = 0; } 
    else { lowCount = highCount = 0; }
    if (lowCount >= 2) { WG.quality.scale = Math.max(.62, WG.quality.scale - .12); WG.state.dpiDirty = true; lowCount = 0; }
    if (highCount >= 4) { WG.quality.scale = Math.min(1, WG.quality.scale + .08); WG.state.dpiDirty = true; highCount = 0; }
    fpsTime = 0; frames = 0;
  }

  WG.run('camera', () => updateCamera(dt, st.sceneTime));
  for (let i = 0; i < WG.ordered.length; i++) {
    const m = WG.ordered[i];
    if (m.def.failed || !m.def.update) continue;
    try { m.def.update(dt, st.sceneTime); } catch (e) {
      m.def.errCount = (m.def.errCount || 0) + 1;
      if (m.def.errCount === 1) WG.warn('update:' + m.name, e);
      if (m.def.errCount > 12) { m.def.failed = true; WG.failedModules.push(m.name); }
    }
  }
  if (!WG.simulating) WG.run('env', () => WG.env.update());
  postFocus = updateFocus();
  if (doRender !== false) WG.run('post', () => post.render(dt, postFocus));
  st.flash = Math.max(0, st.flash - dt * 6.5);
  if (!WG.ready) WG.markReady();
}
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(0.1, clock.getDelta());
  if (WG.paused) return;
  step(raw, raw, true);
}
WG.stepN = function (n, dt) {
  WG.simulating = true;
  for (let i = 0; i < n; i++) step(dt || 1 / 60, dt || 1 / 60, false);
  WG.simulating = false;
};
WG.simulate = function (seconds, render) {
  const n = Math.max(1, Math.round(seconds * 60));
  WG.simulating = true;
  for (let i = 0; i < n; i++) step(1 / 60, 1 / 60, render && i === n - 1);
  WG.simulating = false;
  WG.env.refresh();
  WG.run('env', () => WG.env.update());
};

/* ---------- init ---------- */
WG.initAll = function () {
  window.__initN = (window.__initN||0)+1;
  for (const { name, def } of WG.ordered) {
    try {
      if (def.init) def.init();
      if (!def.update || true) WG.readyModules.push(name);
    } catch (e) {
      def.failed = true; WG.failedModules.push(name); WG.warn('init:' + name, e);
    }
  }
  if (WG.modules.ui && WG.modules.ui.afterInit) WG.run('ui', () => WG.modules.ui.afterInit());
};
WG.start = function () {
  window.__startN = (window.__startN||0)+1;
  resize();
  if (!WG.inited) { WG.inited = true; WG.initAll(); }
  clock.start();
  requestAnimationFrame(frame);
  setTimeout(() => WG.markReady(), 9000);
};

addEventListener('keydown', e => { WG.state.lastInput = WG.state.sceneTime; });
addEventListener('pointerdown', () => { WG.state.lastInput = WG.state.sceneTime; }, { passive: true });
addEventListener('wheel', () => { WG.state.lastInput = WG.state.sceneTime; }, { passive: true });
addEventListener('resize', () => { WG.state.lastInput = WG.state.sceneTime; });
})();