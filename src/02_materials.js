/* ===== 02_materials.js — shared procedural textures & materials ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util;
WG.tex = {};

WG.canvas = function (w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  return c;
};
WG.canvasTex = function (w, h, draw, opts = {}) {
  const t = new THREE.CanvasTexture(WG.canvas(w, h, draw));
  t.wrapS = t.wrapT = opts.wrap || THREE.RepeatWrapping;
  t.colorSpace = opts.linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, WG.renderer.capabilities.getMaxAnisotropy());
  if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
  return t;
};

/* noise helper texture (linear, for shaders) */
WG.tex.noise = (function () {
  const c = WG.canvas(256, 256, (g) => {
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const x = (i / 4) % 256, y = (i / 4 / 256) | 0;
      const v = 255 * WG.fbm2(x / 38, y / 38, 5);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t;
})();

/* radial glow sprite */
function radialTex(size, stops) {
  return WG.canvasTex(size, size, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { wrap: THREE.ClampToEdgeWrapping });
}
WG.tex.glow = radialTex(128, [[0, 'rgba(255,255,255,1)'], [.22, 'rgba(255,245,225,.75)'], [.55, 'rgba(255,230,190,.18)'], [1, 'rgba(255,220,180,0)']]);
WG.tex.contact = radialTex(128, [[0, 'rgba(0,0,0,.85)'], [.5, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]);

/* sun flare: core, halo, 6 spikes, horizontal streak */
WG.tex.sun = (function () {
  return WG.canvasTex(256, 256, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    let gr = g.createRadialGradient(cx, cy, 0, cx, cy, 48);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,248,226,.95)');
    gr.addColorStop(1, 'rgba(255,226,170,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 48, 0, 7); g.fill();
    gr = g.createRadialGradient(cx, cy, 12, cx, cy, 116);
    gr.addColorStop(0, 'rgba(255,236,196,.30)'); gr.addColorStop(.45, 'rgba(255,214,160,.10)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 116, 0, 7); g.fill();
    g.save(); g.translate(cx, cy); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      const len = i % 2 === 0 ? 104 : 62;
      const grad = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      grad.addColorStop(0, 'rgba(255,250,235,.85)'); grad.addColorStop(1, 'rgba(255,225,180,0)');
      g.strokeStyle = grad; g.lineWidth = i % 2 === 0 ? 3 : 1.6;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
    }
    const sg = g.createLinearGradient(-118, 0, 118, 0);
    sg.addColorStop(0, 'rgba(255,240,210,0)'); sg.addColorStop(.5, 'rgba(255,252,244,.9)'); sg.addColorStop(1, 'rgba(255,240,210,0)');
    g.strokeStyle = sg; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-118, 0); g.lineTo(118, 0); g.stroke();
    g.restore();
  }, { wrap: THREE.ClampToEdgeWrapping });
})();

/* moon disc texture with maria and craters */
WG.tex.moon = WG.canvasTex(256, 256, (g, w, h) => {
  const cx = w / 2, cy = h / 2;
  let gr = g.createRadialGradient(cx, cy, 0, cx, cy, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.42, 'rgba(0,0,0,0)');
  gr.addColorStop(.46, 'rgba(210,226,255,.18)'); gr.addColorStop(.6, 'rgba(190,210,255,.06)'); gr.addColorStop(1, 'rgba(180,200,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.save(); g.beginPath(); g.arc(cx, cy, 44, 0, 7); g.clip();
  const base = g.createRadialGradient(cx - 10, cy - 8, 4, cx, cy, 46);
  base.addColorStop(0, '#f2f0e8'); base.addColorStop(.8, '#cfcdc6'); base.addColorStop(1, '#a7a8a6');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(110,118,126,.45)';
  const patch = [[-12, -8, 13, 8], [12, 6, 10, 12], [-3, 20, 15, 6], [4, -20, 9, 7], [-20, 10, 7, 10]];
  for (const [x, y, rx, ry] of patch) { g.beginPath(); g.ellipse(cx + x, cy + y, rx, ry, 0, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4, r = (i * 13) % 40; g.beginPath();
    g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, (i % 3) + 1, 0, 7); g.fill();
  }
  const sh = g.createLinearGradient(cx - 44, cy - 44, cx + 30, cy + 44);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,14,26,.42)');
  g.fillStyle = sh; g.fillRect(0, 0, w, h);
  g.restore();
}, { wrap: THREE.ClampToEdgeWrapping });

/* star point */
WG.tex.star = radialTex(64, [[0, 'rgba(255,255,255,1)'], [.18, 'rgba(230,240,255,.9)'], [.5, 'rgba(200,220,255,.18)'], [1, 'rgba(180,200,255,0)']]);

/* brass maps */
WG.tex.brass = (function () {
  const c = WG.canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#c8ad7c'; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = WG.fbm2(x / 5.2, y / 42, 4) * .5 + WG.fbm2(x / 32, y / 32, 3) * .5;
      const streak = WG.noise2(x / 2.5, y / 70) * .35;
      const v = (n - .5) * 46 + (streak - .17) * 34;
      d[i] = U.clamp(d[i] + v, 0, 255); d[i + 1] = U.clamp(d[i + 1] + v * .92, 0, 255); d[i + 2] = U.clamp(d[i + 2] + v * .65, 0, 255);
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 2.4 + .4;
      g.fillStyle = `rgba(${40 + Math.random() * 40},${60 + Math.random() * 30},45,${.12 + Math.random() * .3})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
WG.tex.brassRough = WG.canvasTex(256, 256, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const x = (i / 4) % w, y = (i / 4 / w) | 0;
    const v = 110 + (WG.fbm2(x / 26, y / 26, 4) - .5) * 150 + (WG.noise2(x / 3, y / 50) - .5) * 25;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = U.clamp(v, 20, 235); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, { linear: true });

/* walnut maps */
WG.tex.walnut = (function () {
  const c = WG.canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#3a2a1e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 190; i++) {
      const y0 = Math.random() * h;
      g.strokeStyle = `rgba(${18 + Math.random() * 26},${12 + Math.random() * 18},${8 + Math.random() * 12},${.25 + Math.random() * .4})`;
      g.lineWidth = .6 + Math.random() * 2.2;
      g.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const y = y0 + Math.sin(x / 60 + i) * (5 + Math.random() * 8) + Math.sin(x / 17 + i * 2) * 2.4;
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(120,88,58,${.05 + Math.random() * .12})`; g.lineWidth = .8 + Math.random() * 1.4;
      const y0 = Math.random() * h; g.beginPath();
      for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x / 44 + i) * 9; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(0,0,0,${.04 + Math.random() * .1})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1, 1 + Math.random() * 2);
    }
  });
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; return t;
})();

/* rock texture */
WG.tex.rock = WG.canvasTex(512, 512, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const strata = Math.sin(y / 9 + WG.fbm2(x / 40, y / 40, 4) * 8) * .12;
    const n = WG.fbm2(x / 7, y / 7, 5) * .7 + WG.fbm2(x / 55, y / 55, 3) * .3;
    const v = U.clamp(95 + (n - .5) * 100 + strata * 120, 24, 210);
    img.data[i] = v; img.data[i + 1] = v * .98; img.data[i + 2] = v * .93; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(30,28,27,${.2 + Math.random() * .4})`; g.lineWidth = .5 + Math.random();
    const x = Math.random() * w, y = Math.random() * h;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + (Math.random() - .5) * 60, y + (Math.random() - .5) * 60); g.stroke();
  }
}, { linear: false });

WG.tex.soil = WG.canvasTex(512, 512, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const n = WG.fbm2(x / 11, y / 11, 5);
    const v = U.clamp(60 + (n - .5) * 55, 20, 120);
    img.data[i] = v; img.data[i + 1] = v * .74; img.data[i + 2] = v * .55; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
});

WG.tex.grain = WG.canvasTex(256, 256, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - .5) * 70; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, { linear: true });

WG.tex.grid = WG.canvasTex(512, 512, (g, w, h) => {
  for (let y = 0; y < h; y += 32) {
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = `rgba(${70 + Math.random() * 20},${70 + Math.random() * 15},${64 + Math.random() * 15},1)`;
      g.fillRect(x, y, 32, 32);
      g.fillStyle = 'rgba(20,20,20,.35)'; g.fillRect(x, y, 1, 32); g.fillRect(x, y, 32, 1);
    }
  }
});

WG.mat = {
  brass(opts = {}) {
    return new THREE.MeshStandardMaterial({
      color: WG.col(opts.color || '#b99864'), metalness: opts.metalness ?? .92, roughness: opts.roughness ?? .34,
      map: opts.map || WG.tex.brass, roughnessMap: WG.tex.brassRough, envMapIntensity: opts.env ?? 1.2,
      normalScale: new THREE.Vector2(.35, .35), side: opts.side || THREE.FrontSide
    });
  },
  darkBrass() {
    const m = WG.mat.brass({ color: '#8c7348', roughness: .45, env: .8 });
    return m;
  },
  walnut() {
    return new THREE.MeshStandardMaterial({ map: WG.tex.walnut, color: WG.col('#6b5038'), roughness: .42, metalness: 0, envMapIntensity: .55 });
  },
  rock() {
    return new THREE.MeshStandardMaterial({ map: WG.tex.rock, color: WG.col('#8c8a84'), roughness: .95, metalness: 0, envMapIntensity: .25 });
  },
  glowSprite(color, opacity = 1, size = 1) {
    const m = new THREE.SpriteMaterial({ map: WG.tex.glow, color: WG.col(color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
  }
};

/* default env map application helper */
WG.applyEnv = function (mat) {
  mat.envMap = WG.env.tex; mat.needsUpdate = true;
};
})();