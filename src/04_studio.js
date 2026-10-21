/* ===== 04_studio.js — photographic studio: backdrop, table, softboxes, dust ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const R = WG.rng('studio');
const studio = WG.studio = { ready: false };

let backdrop = null, table = null, pool = null, contact = null, falloff = null, dust = null, dustMat = null;
let dustPos = null, dustPhase = null, dustCount = 0;
const haloDir = new THREE.Vector3(0, 0.08, -1);
const sunFlat = new THREE.Vector3(-0.8, 0, -0.45);
const envPanels = [];
let lastBucket = -1, envT = 0, dustAcc = 0;

/* ---------------------------------------------------------------- backdrop */
const bgUniforms = {
  uLow: { value: new THREE.Color('#15110e').convertSRGBToLinear() },
  uHigh: { value: new THREE.Color('#0a0908').convertSRGBToLinear() },
  uHalo: { value: haloDir },
  uSunDir: { value: sunFlat },
  uHaloCol: { value: new THREE.Color('#4a3f32').convertSRGBToLinear() },
  uHaloStr: { value: 1 },
  uNight: { value: 0 },
  uStorm: { value: 0 },
  uGolden: { value: 0 },
  uFlash: { value: 0 },
  uDay: { value: 1 },
  uNoise: { value: WG.tex.noise },
  uTime: { value: 0 }
};

const bgVert = `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const bgFrag = `
  uniform vec3 uLow, uHigh, uHalo, uSunDir, uHaloCol;
  uniform float uHaloStr, uNight, uStorm, uGolden, uFlash, uDay, uTime;
  uniform sampler2D uNoise;
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);
    vec3 fl = normalize(vec3(d.x, 0.0, d.z));
    float up = d.y;

    /* vertical falloff: warm and a touch lighter low, near-black overhead */
    float v = smoothstep(-0.28, 0.72, up);
    vec3 col = mix(uLow, uHigh, v);
    col *= 1.0 - 0.22 * smoothstep(0.35, 1.0, up);

    /* warmth toward the side the sun sits on */
    float sunSide = max(dot(fl, uSunDir), 0.0);
    col *= mix(1.0, 1.17, sunSide * sunSide * (0.35 + uDay * 0.65));

    /* cloth mottling — soft, large-scale, camera independent */
    vec2 uv = vec2(atan(d.z, d.x) * 0.1591549 + 0.5, up * 0.55);
    float m = texture2D(uNoise, uv * vec2(3.0, 1.6)).r * 0.62
            + texture2D(uNoise, uv * vec2(9.0, 5.0) + vec2(0.31, 0.12)).r * 0.28
            + texture2D(uNoise, uv * vec2(23.0, 14.0) + vec2(0.73, 0.51)).r * 0.12;
    col *= 0.80 + m * 0.42;

    /* soft vertical cloth folds */
    float fold = sin(uv.x * 6.2831 * 13.0 + texture2D(uNoise, uv * vec2(4.0, 0.7)).r * 9.0);
    col *= 1.0 + fold * 0.022;

    /* halo behind the case, always camera-centred */
    float h = max(dot(d, uHalo), 0.0);
    float halo = pow(h, 30.0) * 0.55 + pow(h, 2.6) * 0.42 + pow(h, 1.35) * 0.10;
    col += uHaloCol * halo * uHaloStr;

    /* mood: golden amber, storm grime, night, lightning */
    col = mix(col, col * vec3(1.16, 0.94, 0.72) + vec3(0.030, 0.017, 0.004), uGolden * 0.85);
    col *= 1.0 - uStorm * 0.42;
    vec3 nightCol = col * vec3(0.40, 0.45, 0.60) + vec3(0.004, 0.005, 0.008);
    col = mix(col, nightCol, uNight);
    col += (uFlash * 0.55) * vec3(0.72, 0.78, 1.0) * (0.35 + halo * 0.9);

    /* gentle dither so the dark gradient never bands */
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) / 255.0;

    gl_FragColor = vec4(col, 1.0);
  }`;

function buildBackdrop() {
  const seg = WG.quality.level >= 1 ? 28 : 16;
  const geo = new THREE.SphereGeometry(74, seg, Math.max(9, seg >> 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: bgUniforms, vertexShader: bgVert, fragmentShader: bgFrag,
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  backdrop = new THREE.Mesh(geo, mat);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -10;
  backdrop.name = 'backdrop';
  WG.groups.studio.add(backdrop);
}

/* ---------------------------------------------------------------- table */
function tableTexture() {
  const size = WG.quality.level >= 2 ? 1024 : 512;
  return WG.canvasTex(size, size, (g, w, h) => {
    g.fillStyle = '#231a12'; g.fillRect(0, 0, w, h);
    const planks = 4, ph = h / planks;
    for (let p = 0; p < planks; p++) {
      const y0 = p * ph;
      const base = 30 + R() * 12;
      g.fillStyle = `rgb(${(base + 4) | 0},${(base - 6) | 0},${(base - 14) | 0})`;
      g.fillRect(0, y0, w, ph - 1);
      /* grain: long wavering strokes along the plank */
      for (let i = 0; i < 130; i++) {
        const gy = y0 + R() * ph;
        const dark = R() < .68;
        g.strokeStyle = dark ? `rgba(${12 + R() * 14 | 0},${8 + R() * 10 | 0},${5 + R() * 8 | 0},${.10 + R() * .30})`
                             : `rgba(${86 + R() * 40 | 0},${66 + R() * 30 | 0},${46 + R() * 22 | 0},${.035 + R() * .10})`;
        g.lineWidth = .5 + R() * 1.7;
        g.beginPath();
        for (let x = 0; x <= w; x += 14) {
          const y = gy + Math.sin(x / 90 + i * 1.7 + p) * (1.2 + R() * 2.4) + Math.sin(x / 21 + i) * .5;
          x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
      /* pores */
      for (let i = 0; i < 240; i++) {
        g.fillStyle = `rgba(6,4,3,${.12 + R() * .30})`;
        g.fillRect(R() * w, y0 + R() * ph, .6 + R() * 1.5, .6 + R() * 2.4);
      }
      /* worn sheen patches */
      for (let i = 0; i < 5; i++) {
        const cx = R() * w, cy = y0 + R() * ph, r = 26 + R() * 90;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, `rgba(126,100,72,${.03 + R() * .05})`);
        gr.addColorStop(1, 'rgba(126,100,72,0)');
        g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      /* butt joint, staggered along the plank */
      const jx = ((p * 0.37 + R() * 0.22) % 1) * w;
      g.fillStyle = 'rgba(3,2,2,.75)'; g.fillRect(jx, y0, 2.2, ph);
      g.fillStyle = 'rgba(150,120,88,.10)'; g.fillRect(jx + 2.2, y0, 1, ph);
      /* seam between planks */
      g.fillStyle = 'rgba(2,1,1,.92)'; g.fillRect(0, y0 + ph - 2, w, 2);
      g.fillStyle = 'rgba(150,122,90,.10)'; g.fillRect(0, y0 + ph - 3.2, w, 1.2);
      /* rough sawn mottling */
      for (let i = 0; i < 700; i++) {
        g.fillStyle = `rgba(${R() < .5 ? 0 : 190},${R() < .5 ? 0 : 170},${R() < .5 ? 0 : 140},${.015 + R() * .035})`;
        g.fillRect(R() * w, y0 + R() * ph, 1 + R() * 3, 1);
      }
    }
  }, { repeat: [11, 6.5] });
}

function buildTable() {
  const w = 122, d = 88;
  const tex = tableTexture();
  const rough = (() => {
    const t = WG.canvasTex(256, 256, (g, ww, hh) => {
      const img = g.createImageData(ww, hh);
      for (let i = 0; i < img.data.length; i += 4) {
        const x = (i / 4) % ww, y = (i / 4 / ww) | 0;
        const n = WG.fbm2(x / 22, y / 22, 4) * .7 + WG.noise2(x / 3, y / 40) * .3;
        const v = 168 + (n - .5) * 90;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = U.clamp(v, 60, 240); img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }, { linear: true, repeat: [7, 4] });
    return t;
  })();
  const mat = new THREE.MeshStandardMaterial({
    map: tex, bumpMap: tex, bumpScale: .055, roughnessMap: rough,
    color: WG.col('#12100c'), roughness: 1, metalness: 0,
    envMapIntensity: .35
  });
  const geo = new THREE.PlaneGeometry(w, d, 1, 1);
  table = new THREE.Mesh(geo, mat);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -3.0;
  table.receiveShadow = true;
  table.name = 'table';
  WG.groups.studio.add(table);

  /* a few raised board lips for real parallax near the lens */
  const lipGeo = new THREE.BoxGeometry(1, .022, 1);
  const lipMat = new THREE.MeshStandardMaterial({
    map: tex, color: WG.col('#4a4438'), roughness: .95, metalness: 0,
    envMapIntensity: .3
  });
  const lips = WG.quality.level >= 1 ? 7 : 3;
  for (let i = 0; i < lips; i++) {
    const m = new THREE.Mesh(lipGeo, lipMat);
    const ang = R() * Math.PI * 2;
    const rad = 9.5 + R() * 14;
    m.position.set(Math.cos(ang) * rad, -2.987 + R() * .006, Math.sin(ang) * rad * .72);
    m.scale.set(2 + R() * 7, 1, .5 + R() * 1.3);
    m.rotation.y = (R() - .5) * .12;
    m.receiveShadow = true;
    WG.groups.studio.add(m);
  }

  /* pool of light where the object sits */
  const poolTex = WG.canvasTex(256, 256, (g, ww, hh) => {
    const gr = g.createRadialGradient(ww / 2, hh / 2, 0, ww / 2, hh / 2, ww / 2);
    gr.addColorStop(0, 'rgba(255,231,196,.55)');
    gr.addColorStop(.42, 'rgba(255,220,180,.20)');
    gr.addColorStop(.72, 'rgba(255,206,160,.055)');
    gr.addColorStop(1, 'rgba(255,198,150,0)');
    g.fillStyle = gr; g.fillRect(0, 0, ww, hh);
  }, { wrap: THREE.ClampToEdgeWrapping, repeat: [1, 1] });
  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTex, transparent: true, opacity: .38, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: true
  });
  pool = new THREE.Mesh(new THREE.PlaneGeometry(23, 17), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -2.989;
  pool.renderOrder = 2;
  WG.groups.studio.add(pool);

  /* deep contact shadow under the plinth */
  const cMat = new THREE.MeshBasicMaterial({
    map: WG.tex.contact, transparent: true, opacity: .92, depthWrite: false,
    color: new THREE.Color(0.35, 0.28, 0.230), fog: true
  });
  contact = new THREE.Mesh(new THREE.PlaneGeometry(23, 16.5), cMat);
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -2.9935;
  contact.renderOrder = 1;
  WG.groups.studio.add(contact);

  /* pool falloff: keeps the table dark away from the case */
  const falloffTex = WG.canvasTex(256, 256, (g, ww, hh) => {
    const gr = g.createRadialGradient(ww / 2, hh / 2, 0, ww / 2, hh / 2, ww / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(.15, 'rgba(255,255,255,1)');
    gr.addColorStop(.35, 'rgba(198,184,165,1)');
    gr.addColorStop(.52, 'rgba(90,78,64,1)');
    gr.addColorStop(.68, 'rgba(24,20,16,1)');
    gr.addColorStop(1, 'rgba(6,5,4,1)');
    g.fillStyle = gr; g.fillRect(0, 0, ww, hh);
  }, { wrap: THREE.ClampToEdgeWrapping });
  falloff = new THREE.Mesh(new THREE.PlaneGeometry(114, 82), new THREE.MeshBasicMaterial({
    map: falloffTex, blending: THREE.MultiplyBlending, depthWrite: false, transparent: true, fog: false
  }));
  falloff.rotation.x = -Math.PI / 2;
  falloff.position.y = -2.9995;
  falloff.renderOrder = 3;
  WG.groups.studio.add(falloff);
}

/* ---------------------------------------------------------------- dust */
function buildDust() {
  dustCount = [70, 150, 260][WG.quality.level] | 0;
  dustPos = new Float32Array(dustCount * 3);
  dustPhase = new Float32Array(dustCount);
  const sizes = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (R() * 2 - 1) * 11;
    dustPos[i * 3 + 1] = -1.5 + R() * 10;
    dustPos[i * 3 + 2] = (R() * 2 - 1) * 7;
    dustPhase[i] = R() * 100;
    sizes[i] = .7 + R() * 1.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(dustPhase, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  dustMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uPR: { value: WG.quality.dpr } },
    vertexShader: `
      attribute float aPhase; attribute float aSize;
      uniform float uTime, uPR; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = .45 + .55 * sin(uTime * 1.3 + aPhase);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPR * (42.0 / max(1.0, -mv.z));
      }`,
    fragmentShader: `
      uniform float uOpacity; varying float vA;
      void main(){
        vec2 p = gl_PointCoord - .5; float d = length(p);
        float a = smoothstep(.5, .05, d);
        gl_FragColor = vec4(vec3(1.0, .94, .84), a * vA * uOpacity);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  dust = new THREE.Points(geo, dustMat);
  dust.frustumCulled = false;
  WG.groups.studio.add(dust);
}

/* ---------------------------------------------------------------- fill card */
let fill = null;
function buildFill() {
  const pl = new THREE.PointLight(WG.col('#ffd9ae').getHex(), 1.4, 13, 2);
  pl.position.set(.5, -1.1, 6.4);
  WG.scene.add(pl);
  WG.studio.plinthLight = pl;
  fill = new THREE.DirectionalLight(WG.col('#ffdcb2').getHex(), .9);
  fill.castShadow = false;
  fill.position.set(-3.5, -0.4, 16);
  fill.target.position.set(0, -2.1, 3.2);
  WG.scene.add(fill, fill.target);
}

/* ---------------------------------------------------------------- env rig */
function tuneEnv() {
  const set = (i, w, h, hex, intensity, pos) => {
    const p = WG.env.scene.children[i];
    if (!p) return;
    p.scale.set(w, h, 1);
    p.material.color.copy(new THREE.Color(hex)).multiplyScalar(intensity);
    p.userData.base = p.material.color.clone();
    p.userData.warm = new THREE.Color(hex);
    p.userData.intensity = intensity;
    p.position.copy(pos);
    p.lookAt(0, 3, 0);
  };
  /* four tall softboxes round the room + one overhead — subtle, wide, warm */
  set(0, 2.5, 19, '#fff0d8', 4.2, new THREE.Vector3(-15, 4.5, 8));
  set(1, 2.5, 19, '#ffeccf', 3.6, new THREE.Vector3(16, 4.5, 7.5));
  set(2, 3.0, 17, '#ffe6c6', 2.6, new THREE.Vector3(4, 5, -17));
  set(3, 3.0, 16, '#ffe0ba', 2.0, new THREE.Vector3(-5, 6, 18));
  set(4, 10, 10, '#fff6e6', 2.9, new THREE.Vector3(1, 21, 2));
  envPanels.length = 0;
  for (const p of WG.env.scene.children) envPanels.push(p);
  WG.env.refresh();
}

/* ---------------------------------------------------------------- weather glue */
let flashPulse = 0;
function onLightning() { flashPulse = 1; }

WG.register('studio', {
  order: 16,
  init() {
    try {
      buildBackdrop();
      buildTable();
      buildDust();
      buildFill();
      tuneEnv();
      WG.on('lightning', onLightning);
      studio.ready = true;
    } catch (e) { WG.warn('studio', e); }
  },
  update(dt, t) {
    if (!studio.ready) return;
    try {
      const night = U.clamp01(S.night), storm = U.clamp01(S.storm), golden = U.clamp01(S.golden);
      const day = U.clamp01(S.daylight);
      /* halo follows the camera around the case */
      const cam = WG.camera;
      haloDir.set(WG.cameraRig.target.x - cam.position.x, (WG.cameraRig.target.y - cam.position.y) * .8, WG.cameraRig.target.z - cam.position.z).normalize();
      sunFlat.set(S.sunPos.x, 0, S.sunPos.z);
      if (sunFlat.lengthSq() < 1e-5) sunFlat.set(-.8, 0, -.5); else sunFlat.normalize();

      flashPulse = Math.max(flashPulse, U.clamp01(S.flash));
      bgUniforms.uNight.value = U.damp(bgUniforms.uNight.value, night, 3, dt);
      bgUniforms.uStorm.value = U.damp(bgUniforms.uStorm.value, storm, 3, dt);
      bgUniforms.uGolden.value = U.damp(bgUniforms.uGolden.value, golden, 3, dt);
      bgUniforms.uDay.value = U.damp(bgUniforms.uDay.value, day, 3, dt);
      bgUniforms.uFlash.value = flashPulse;
      bgUniforms.uHaloStr.value = U.damp(bgUniforms.uHaloStr.value, .26 + day * .95 - night * .14 - storm * .16, 2.5, dt);
      bgUniforms.uTime.value = t;
      bgUniforms.uHaloCol.value.setRGB(.145 + golden * .3, .115 + golden * .15, .086 + golden * .05);
      flashPulse *= Math.max(0, 1 - dt * 5.5);

      /* table pool + contact shadow follow the light */
      pool.material.opacity = .14 + day * .5 - storm * .16 - night * .1;
      if (WG.studio.plinthLight) WG.studio.plinthLight.intensity = .5 + day * 1.1 - night * .5;
      contact.material.opacity = .62 + day * .3;
      fill.intensity = (.62 + day * 1.6) * (1 - night * .25) + flashPulse * .5;

      /* dust only in dry, bright air */
      const dry = (1 - U.clamp01(S.humidity)) * (1 - U.clamp01(S.rain)) * (1 - U.clamp01(S.fog));
      dustMat.uniforms.uOpacity.value = U.damp(dustMat.uniforms.uOpacity.value,
        U.clamp01(day * 1.1) * dry * (1 - night) * .85, 1.6, dt);
      dustMat.uniforms.uTime.value = t;
      if (dustMat.uniforms.uOpacity.value > .004) {
        dustAcc += dt;
        if (dustAcc > 0) {
          dustAcc = 0;
          for (let i = 0; i < dustCount; i++) {
            const ph = dustPhase[i];
            dustPos[i * 3] += (Math.sin(t * .31 + ph) * .06 + S.windVec.x * .22) * dt;
            dustPos[i * 3 + 1] += (-.05 + Math.sin(t * .53 + ph) * .05) * dt;
            dustPos[i * 3 + 2] += (Math.cos(t * .27 + ph) * .05 + S.windVec.z * .22) * dt;
            if (dustPos[i * 3 + 1] < -1.8) { dustPos[i * 3 + 1] = 8.5; dustPos[i * 3] = (R() * 2 - 1) * 11; dustPos[i * 3 + 2] = (R() * 2 - 1) * 7; }
            if (dustPos[i * 3] > 12) dustPos[i * 3] = -12;
            if (dustPos[i * 3] < -12) dustPos[i * 3] = 12;
            if (dustPos[i * 3 + 2] > 8) dustPos[i * 3 + 2] = -8;
            if (dustPos[i * 3 + 2] < -8) dustPos[i * 3 + 2] = 8;
          }
          dust.geometry.attributes.position.needsUpdate = true;
        }
      }

      /* refresh the studio env only when the light mood really shifts */
      const bucket = Math.round(day * 10) + Math.round(night * 6) * 13 + Math.round(storm * 6) * 29 + Math.round(golden * 6) * 47;
      envT += dt;
      if (bucket !== lastBucket || envT > 6) {
        lastBucket = bucket; envT = 0;
        for (const p of envPanels) {
          if (!p.userData.warm) continue;
          p.material.color.copy(p.userData.warm)
            .multiplyScalar(p.userData.intensity * (.22 + day * .92 - storm * .3) * (1 - night * .72));
        }
        WG.env.refresh();
      }
    } catch (e) { WG.warn('studio:update', e); }
  },
  dispose() {
    try {
      WG.off('lightning', onLightning);
      for (const m of [backdrop, table, pool, contact, falloff, dust]) {
        if (!m) continue;
        m.geometry && m.geometry.dispose();
        m.material && m.material.dispose();
        m.parent && m.parent.remove(m);
      }
    } catch (e) { WG.warn('studio:dispose', e); }
  }
});
})();