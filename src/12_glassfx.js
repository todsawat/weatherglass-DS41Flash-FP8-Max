/* ===== 12_glassfx.js — condensation, beads, runs, frost, wipe, tap rings ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const R = WG.rng('glassfx');
const glassfx = WG.glassfx = { ready: false, smudges: [] };
let ready = false;

const layers = [];   /* per pane */
const WIPE_RES = WG.quality.level >= 1 ? 128 : 96;

const VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = `
precision highp float;
uniform float uTime, uMist, uFrost, uRain, uHum, uGlow, uSide, uSeed, uShake, uFlash;
uniform vec4 uRingA, uRingB;
uniform sampler2D uWipe, uNoise;
varying vec2 vUv;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 34.45); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float s = 0., a = .5;
  for (int i = 0; i < 4; i++){ s += vnoise(p) * a; p *= 2.03; a *= .5; }
  return s;
}

void main(){
  vec2 uv = vUv;
  /* gentle shimmer from a pane knock */
  uv += vec2(sin(uTime * 46. + uSeed) * .0016, cos(uTime * 39. + uSeed) * .0012) * uShake;

  float edge = smoothstep(.34, .0, min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y)));
  float top = smoothstep(.62, 1., uv.y);
  float n = fbm(uv * vec2(7.0, 5.0) + uSeed * 4.0);
  float n2 = fbm(uv * vec2(19.0, 13.0) + uSeed * 9.0);
  float spread = uMist;

  /* where the mist sits: edges and the top first */
  float wet = spread * (edge * 1.05 + top * .5 + .08) * (0.5 + n * .95);
  wet += uRain * .10 * n2;

  /* clear runs: a few wobbling drops leaving streaks */
  float runCol = 0.;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float hx = hash(vec2(fi, uSeed)) * .86 + .07;
    float speed = .055 + hash(vec2(uSeed, fi)) * .05;
    float phase = fract(uTime * speed + hash(vec2(fi, uSeed + 3.0)));
    float xw = hx + sin(phase * 11. + fi) * .006;
    float d = abs(uv.x - xw);
    float trail = smoothstep(.012, .0, d) * smoothstep(phase - .22, phase, uv.y) * smoothstep(phase + .01, phase - .02, uv.y);
    runCol = max(runCol, trail);
  }
  wet *= (1. - runCol * .8);

  /* wipe mask */
  float w = texture2D(uWipe, uv).r;
  wet *= (1. - w * .95);

  /* beads */
  vec2 gc = uv * vec2(96.0, 128.0);
  vec2 gi = floor(gc);
  float bh = hash(gi + uSeed);
  float bead = 0.;
  if (bh > .74) {
    vec2 bc = (fract(gc) - .5);
    float r = .07 + bh * .15;
    bead = smoothstep(r, r * .55, length(bc)) * smoothstep(.2, .62, spread) * smoothstep(.45, .9, uSide);
  }
  float runDot = 0.;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float hx = hash(vec2(fi, uSeed)) * .86 + .07;
    float speed = .055 + hash(vec2(uSeed, fi)) * .05;
    float phase = fract(uTime * speed + hash(vec2(fi, uSeed + 3.0)));
    float xw = hx + sin(phase * 11. + fi) * .006;
    float d = length(uv - vec2(xw, phase));
    runDot = max(runDot, smoothstep(.011, .006, d));
  }

  /* frost fern below freezing */
  float fern = 0.;
  if (uFrost > .01) {
    float f1 = fbm(uv * vec2(30.0, 22.0));
    float f2 = fbm(uv * vec2(70.0, 54.0) + 3.0);
    fern = smoothstep(.62, .86, f1 * .6 + f2 * .5 + edge * .35) * uFrost;
  }

  /* tap rings */
  float ring = 0.;
  for (int i = 0; i < 2; i++){
    vec4 rg = i == 0 ? uRingA : uRingB;
    if (rg.z > 0.) {
      float t = (uTime - rg.z);
      if (t < 1.6) {
        float d = length((uv - rg.xy) * vec2(1.6, 1.0));
        float rr = t * .42;
        ring += smoothstep(.05, .0, abs(d - rr)) * (1. - t / 1.6) * .85;
        ring += smoothstep(.035, .0, abs(d - rr * .62)) * (1. - t / 1.6) * .45;
      }
    }
  }

  float a = clamp(wet * .40 + bead * .20 + runDot * .42 + fern * .46 + ring * .42, 0., .46);
  vec3 col = vec3(.86, .90, .90);
  col = mix(col, vec3(.98, .97, .94), uGlow * .8);
  col += ring * vec3(.55, .75, .95);
  col += runDot * vec3(.6, .75, .85);
  col += bead * .25;
  /* iridescent rim on the taps */
  col += ring * vec3(.25 + .3 * sin(uTime * 3.), .2, .3);
  col += uFlash * vec3(.5, .55, .8);
  /* wet ridge on the wipe boundary */
  float wEdge = smoothstep(.06, .0, abs(dFdx(w) * 6.) + abs(dFdy(w) * 6.)) * smoothstep(.01, .06, w);
  col += wEdge * .12;
  a += wEdge * .10;
  gl_FragColor = vec4(col, a);
}`;

function makeWipeCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = WIPE_RES;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, WIPE_RES, WIPE_RES);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return { canvas: c, ctx: g, tex: t };
}

function build() {
  const panes = (WG.glass && WG.glass.panes) || [];
  for (const pane of panes) {
    const wipe = makeWipeCanvas();
    const geo = new THREE.PlaneGeometry(pane.width, pane.height, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uMist: { value: 0 }, uFrost: { value: 0 }, uRain: { value: 0 },
        uHum: { value: 0 }, uGlow: { value: 0 }, uSide: { value: pane.id === 0 ? 1 : .4 }, uSeed: { value: R() * 100 },
        uShake: { value: 0 }, uFlash: { value: 0 },
        uRingA: { value: new THREE.Vector4(0, 0, -9, 0) },
        uRingB: { value: new THREE.Vector4(0, 0, -9, 0) },
        uWipe: { value: wipe.tex }, uNoise: { value: WG.tex.noise }
      },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    const inward = pane.inward || pane.normal.clone().negate();
    mesh.position.copy(pane.center).addScaledVector(inward, .0065);
    mesh.rotation.y = pane.rotY || 0;
    mesh.renderOrder = 9 + pane.id;
    mesh.frustumCulled = false;
    mesh.visible = false;
    WG.groups.glassfx.add(mesh);
    const layer = {
      pane, mesh, wipe, ringI: 0, shake: 0, fadeT: 0, fadeAcc: 0,
      lastWipe: -99
    };
    layers.push(layer);
    glassfx.smudges.push({ pane: pane.id, uv: new THREE.Vector2(R(), R()), r: .05 + R() * .1 });
  }
}

/* ---------------------------------------------------------------- API */
function layerFor(i) { return layers.find(l => l.pane.id === i) || layers[i]; }

function paintWipe(layer, uv, radius) {
  const g = layer.wipe.ctx, w = WIPE_RES;
  const r = Math.max(6, radius * w);
  const gr = g.createRadialGradient(uv.x * w, (1 - uv.y) * w, 0, uv.x * w, (1 - uv.y) * w, r);
  gr.addColorStop(0, 'rgba(255,255,255,.95)');
  gr.addColorStop(.62, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(uv.x * w, (1 - uv.y) * w, r, 0, 7); g.fill();
  layer.wipe.tex.needsUpdate = true;
  layer.lastWipe = S.sceneTime;
}

glassfx.wipe = function (paneIndex, uv, radius) {
  try {
    const l = layerFor(paneIndex);
    if (!l || !uv) return;
    paintWipe(l, uv, radius || .1);
    if (WG.audio && WG.audio.event) WG.audio.event('squeak', {});
  } catch (e) { WG.warn('glassfx:wipe', e); }
};

glassfx.clear = function (paneIndex, uv) {
  try {
    const l = layerFor(paneIndex);
    if (!l) return;
    if (uv) paintWipe(l, uv, .22);
    else { l.wipe.ctx.fillStyle = '#fff'; l.wipe.ctx.fillRect(0, 0, WIPE_RES, WIPE_RES); l.wipe.tex.needsUpdate = true; }
  } catch (e) { WG.warn('glassfx:clear', e); }
};

glassfx.tap = function (paneIndex, uv) {
  try {
    const l = layerFor(paneIndex);
    if (!l) return;
    const v = l.ringI++ % 2;
    const u = v === 0 ? l.mesh.material.uniforms.uRingA : l.mesh.material.uniforms.uRingB;
    u.value.set(uv ? uv.x : .5, uv ? uv.y : .5, S.sceneTime, 0);
    l.shake = 1;
    WG.emit('tap', { pane: paneIndex, uv });
    if (WG.audio && WG.audio.event) WG.audio.event('tink', { pane: paneIndex });
  } catch (e) { WG.warn('glassfx:tap', e); }
};

/* ---------------------------------------------------------------- update */
WG.register('glassfx', {
  order: 32,
  init() {
    try { build(); ready = true; glassfx.ready = true; } catch (e) { WG.warn('glassfx', e); }
  },
  update(dt) {
    if (!ready) return;
    try {
      const mist = U.clamp01(S.mist);
      const rainOnGlass = U.clamp01(S.rain * .8 + S.snowfall * .25);
      const frost = U.clamp01((Math.min(0, S.temp) / -12)) * U.clamp01(mist * 2.2);
      const glow = U.clamp01(S.sunVis * .6 + S.golden * .4) * U.clamp01(1 - S.cloudCover);
      for (const l of layers) {
        const u = l.mesh.material.uniforms;
        u.uTime.value = S.sceneTime;
        u.uMist.value = U.damp(u.uMist.value, mist, 1.6, dt);
        u.uRain.value = U.damp(u.uRain.value, rainOnGlass, 2.2, dt);
        u.uFrost.value = U.damp(u.uFrost.value, frost, 1.1, dt);
        u.uHum.value = U.clamp01(S.humidity);
        u.uGlow.value = glow;
        u.uFlash.value = S.flash;
        l.shake = Math.max(0, l.shake - dt * 2.1);
        u.uShake.value = l.shake;
        /* slide the pane a hair to sell the shiver */
        const inward = l.pane.inward || l.pane.normal.clone().negate();
        l.mesh.position.copy(l.pane.center)
          .addScaledVector(inward, .0065 + Math.sin(S.sceneTime * 52) * l.shake * .004);
        l.mesh.visible = u.uMist.value > .012 || u.uRain.value > .03 || u.uFrost.value > .01
          || u.uRingA.value.z > S.sceneTime - 1.7 || u.uRingB.value.z > S.sceneTime - 1.7;

        /* slow re-misting of wiped patches (~60s) */
        l.fadeAcc += dt;
        if (l.fadeAcc > .5 && S.sceneTime - l.lastWipe > .8) {
          l.fadeAcc = 0;
          const g = l.wipe.ctx;
          g.fillStyle = 'rgba(0,0,0,.028)';
          g.fillRect(0, 0, WIPE_RES, WIPE_RES);
          l.wipe.tex.needsUpdate = true;
        }
      }
    } catch (e) { WG.warn('glassfx:update', e); }
  },
  dispose() {
    try {
      for (const l of layers) {
        l.mesh.geometry.dispose(); l.mesh.material.dispose(); l.wipe.tex.dispose();
        l.mesh.parent && l.mesh.parent.remove(l.mesh);
      }
      layers.length = 0;
    } catch (e) { WG.warn('glassfx:dispose', e); }
  }
});
})();