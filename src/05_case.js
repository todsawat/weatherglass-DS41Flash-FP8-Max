/* ===== 05_case.js — glass case, aged brass frame, walnut plinth, plaque, gauge ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const R = WG.rng('case');
const DEG = Math.PI / 180;

/* geometry constants (contract §2) */
const IX = 6, IZ = 4;                 // interior half sizes
const BLOCK_Y = -1.8;                 // underside of the block / top of plinth
const WALL_TOP = 7.4;
const LID_TOP = 7.85;
const PLINTH_TOP = -1.8, PLINTH_BOT = -3.0;
const PLINTH_X = 6.4, PLINTH_Z = 4.4;
const POST_X = 6.09, POST_Z = 4.09;
const FRIEZE_Z = 4.348;               // front face of the frieze moulding
const PANE_T = 0.02;

const caseApi = WG.case = {
  ready: false, glassPanes: [], plinth: null, lid: null,
  gauge: { needles: null, tap: null }, pickables: []
};
WG.glass = { panes: caseApi.glassPanes };

let ready = false;
let plinth = null, lid = null, glassMat = null, gaugeRoot = null, gaugeFace = null, domeMat = null;
let needleHum = null, needleTemp = null, gaugeHit = null;
const glassEdgeMats = [];
const brassMats = [];
const needleState = { h: 0.46, t: 0.63, hv: 0, tv: 0 };
let tapPulse = 0, quiver = 0;
let probe = 0;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/* ---------------------------------------------------------------- helpers */
function lathe(profile, segs) {
  const pts = profile.map(p => new THREE.Vector2(p[0], p[1]));
  return new THREE.LatheGeometry(pts, segs);
}
function roundedRectShape(hx, hz, r) {
  const s = new THREE.Shape();
  const rr = Math.min(r, hx - 0.001, hz - 0.001);
  s.moveTo(-hx + rr, hz);
  s.lineTo(hx - rr, hz); s.absarc(hx - rr, hz - rr, rr, Math.PI / 2, 0, true);
  s.lineTo(hx, -hz + rr); s.absarc(hx - rr, -hz + rr, rr, 0, -Math.PI / 2, true);
  s.lineTo(-hx + rr, -hz); s.absarc(-hx + rr, -hz + rr, rr, -Math.PI / 2, -Math.PI, true);
  s.lineTo(-hx, hz - rr); s.absarc(-hx + rr, hz - rr, rr, Math.PI, Math.PI / 2, true);
  s.closePath();
  return s;
}
function roundedRectPath(cx, cy, hx, hz, r, out) {
  const rr = Math.min(r, hx - 0.001, hz - 0.001);
  const arcs = [
    [cx + hx - rr, cy + hz - rr, Math.PI / 2, 0],
    [cx + hx - rr, cy - hz + rr, 0, -Math.PI / 2],
    [cx - hx + rr, cy - hz + rr, -Math.PI / 2, -Math.PI],
    [cx - hx + rr, cy + hz - rr, Math.PI, Math.PI / 2]
  ];
  const push = (x, y) => out.push(x, y);
  push(cx - hx + rr, cy + hz);
  push(cx + hx - rr, cy + hz);
  for (const [ax, ay, a0, a1] of arcs) {
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      push(ax + Math.cos(a) * rr, ay + Math.sin(a) * rr);
    }
  }
  push(cx - hx + rr, cy - hz);
  push(cx - hx + rr, cy + hz);
  return out;
}

/* ---------------------------------------------------------------- materials */
function brassMat(color, roughness, metalness, env) {
  const m = new THREE.MeshStandardMaterial({
    map: WG.tex.brass, roughnessMap: WG.tex.brassRough,
    color: new THREE.Color(color), roughness, metalness,
    envMapIntensity: env, envMap: WG.env.tex
  });
  brassMats.push(m);
  return m;
}
let matPolished, matMid, matDark, matPatina, matWalnut, matCream, matEdge, matSteel, matRed, matHit, matShaft, matDomeGlass;


function walnutFigure() {
  const size = WG.quality.level >= 2 ? 768 : 512;
  return WG.canvasTex(size, size, (g, w, h) => {
    g.fillStyle = '#4a3venue'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d573a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 210; i++) {
      const y0 = R() * h;
      const dark = R() < .7;
      g.strokeStyle = dark
        ? `rgba(${26 + R() * 22 | 0},${17 + R() * 15 | 0},${11 + R() * 10 | 0},${.20 + R() * .40})`
        : `rgba(${156 + R() * 56 | 0},${118 + R() * 42 | 0},${82 + R() * 28 | 0},${.08 + R() * .20})`;
      g.lineWidth = .6 + R() * 2.6;
      const amp = 3 + R() * 14;
      const ph = R() * 9;
      g.beginPath();
      for (let x = 0; x <= w; x += 5) {
        const y = y0 + Math.sin(x / 74 + ph) * amp + Math.sin(x / 17 + ph * 3) * (amp * .28);
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    /* crotch swirls */
    for (let i = 0; i < 5; i++) {
      const cx = R() * w, cy = R() * h, r0 = 8 + R() * 26;
      for (let k = 0; k < 16; k++) {
        g.strokeStyle = `rgba(20,13,8,${.06 + R() * .16})`; g.lineWidth = .8 + R() * 1.4;
        g.beginPath();
        g.ellipse(cx, cy, r0 + k * (2 + R()), (r0 + k * (1.4 + R())) * .55, R() * 3, 0, 7);
        g.stroke();
      }
    }
    /* pores */
    for (let i = 0; i < 5200; i++) {
      g.fillStyle = `rgba(24,15,9,${.12 + R() * .26})`;
      g.fillRect(R() * w, R() * h, .6 + R() * 1.1, .7 + R() * 2.6);
    }
    /* paler worn sheen along the top edge of the map */
    const top = g.createLinearGradient(0, 0, 0, h * .18);
    top.addColorStop(0, 'rgba(206,168,120,.20)'); top.addColorStop(1, 'rgba(206,168,120,0)');
    g.fillStyle = top; g.fillRect(0, 0, w, h * .18);
  }, { repeat: [1, 1] });
}

function buildMaterials() {
  matPolished = brassMat('#d2b487', .18, .95, 1.8);
  matMid = brassMat('#a98a5b', .40, .88, 1.2);
  matDark = brassMat('#6b5430', .56, .82, .78);
  matShaft = brassMat('#b0935f', .38, .9, 1.1);
  matShaft.vertexColors = true;
  matPatina = new THREE.MeshStandardMaterial({
    color: WG.col('#4d5a45'), roughness: .88, metalness: .28, envMapIntensity: .35
  });
  matSteel = new THREE.MeshStandardMaterial({ color: WG.col('#3f5d86'), roughness: .24, metalness: .95, envMapIntensity: 1.25 });
  matRed = new THREE.MeshStandardMaterial({ color: WG.col('#c4402c'), roughness: .2, metalness: .25, envMapIntensity: .8 });
  matHit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001, depthWrite: false });
  brassMats.push(matPatina, matSteel, matRed);
  for (const m of brassMats) m.userData.envBase = m.envMapIntensity;

  const vc = new THREE.MeshPhysicalMaterial({
    map: walnutFigure(), bumpMap: WG.tex.walnut, bumpScale: .012,
    color: WG.col('#8a6246'), roughness: .4, metalness: 0,
    clearcoat: .62, clearcoatRoughness: .30, envMapIntensity: .55, vertexColors: true,
    emissive: new THREE.Color('#171009'), emissiveIntensity: 1
  });
  matWalnut = vc;
  matCream = new THREE.MeshStandardMaterial({ color: WG.col('#e6dcc4'), roughness: .8, metalness: 0, envMapIntensity: .35 });
  matEdge = new THREE.MeshBasicMaterial({
    color: WG.col('#63a892'), transparent: true, opacity: .5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  });
  glassEdgeMats.push(matEdge);
}

/* ---------------------------------------------------------------- plinth */
const PROFILE = [
  [-1.800, 0.014], [-1.803, 0.005], [-1.809, 0.000], [-1.817, 0.004],
  [-1.827, 0.020], [-1.838, 0.044], [-1.850, 0.064], [-1.865, 0.076],
  [-1.877, 0.070], [-1.888, 0.054], [-1.898, 0.047], [-1.909, 0.050],
  [-1.921, 0.047], [-1.950, 0.052], [-2.220, 0.052], [-2.470, 0.052],
  [-2.505, 0.064], [-2.528, 0.082], [-2.548, 0.080], [-2.568, 0.058],
  [-2.596, 0.030], [-2.640, 0.016], [-2.700, 0.013], [-2.850, 0.012],
  [-2.930, 0.019], [-2.975, 0.014], [-3.000, 0.021]
];
const PLINTH_VERT_COL_TOP = new THREE.Color(1.16, 1.1, 1.04);
const PLINTH_VERT_COL_BOT = new THREE.Color(0.72, 0.68, 0.64);

function buildPlinth() {
  const cornerR = 0.2;
  const edgeSeg = 10, cornerSeg = 5;
  const rings = [];
  let perimeter = 0;
  let prev = null;
  for (const [y, inset] of PROFILE) {
    const hx = PLINTH_X - inset, hz = PLINTH_Z - inset;
    const pts = [];
    /* perimeter in order: front edge, right, back, left with corner arcs */
    const push = (x, z) => pts.push(x, z);
    const edge = (x0, z0, x1, z1, n) => {
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        push(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f);
      }
    };
    edge(-(hx - cornerR), hz, hx - cornerR, hz, edgeSeg);
    for (let i = 1; i <= cornerSeg; i++) {
      const a = (Math.PI / 2) * (1 - i / cornerSeg);
      push(hx - cornerR + Math.cos(a) * cornerR, hz - cornerR + Math.sin(a) * cornerR);
    }
    edge(hx, hz - cornerR, hx, -(hz - cornerR), edgeSeg);
    for (let i = 1; i <= cornerSeg; i++) {
      const a = -(Math.PI / 2) * (i / cornerSeg);
      push(hx - cornerR + Math.cos(a) * cornerR, -hz + cornerR + Math.sin(a) * cornerR);
    }
    edge(hx - cornerR, -hz, -(hx - cornerR), -hz, edgeSeg);
    for (let i = 1; i <= cornerSeg; i++) {
      const a = -Math.PI / 2 - (Math.PI / 2) * (i / cornerSeg);
      push(-hx + cornerR + Math.cos(a) * cornerR, -hz + cornerR + Math.sin(a) * cornerR);
    }
    edge(-hx, -(hz - cornerR), -hx, hz - cornerR, edgeSeg);
    for (let i = 1; i <= cornerSeg; i++) {
      const a = Math.PI - (Math.PI / 2) * (i / cornerSeg);
      push(-hx + cornerR + Math.cos(a) * cornerR, hz - cornerR + Math.sin(a) * cornerR);
    }
    if (prev) {
      let p = 0;
      for (let i = 0; i < pts.length; i += 2) {
        if (i >= 2) p += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      }
      perimeter += p;
    }
    prev = pts;
    rings.push({ y, pts });
  }

  const pos = [], nor = [], uv = [], col = [], idx = [];
  const V = (x, y, z, u, v, c) => {
    pos.push(x, y, z); uv.push(u, v); col.push(c.r, c.g, c.b); nor.push(0, 0, 0);
    return pos.length / 3 - 1;
  };
  const vertPerRing = rings[0].pts.length / 2;
  const ringStart = [];
  let runU = 0;
  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    ringStart.push(pos.length / 3);
    let u = runU;
    const v = (ring.y - PLINTH_BOT) / 1.2;
    const shade = U.clamp01((PLINTH_TOP - ring.y) / 1.2);
    const c = PLINTH_VERT_COL_TOP.clone().lerp(PLINTH_VERT_COL_BOT, Math.pow(shade, .7));
    /* the frieze faces the lens: lift it out of the backlight */
    let front = 0;
    for (let j = 0; j < vertPerRing; j++) front = Math.max(front, ring.pts[j * 2 + 1]);
    const frontF = U.smoothstep(2.4, 4.2, front);
    c.multiplyScalar(1 + frontF * 1.75);
    for (let j = 0; j < vertPerRing; j++) {
      const x = ring.pts[j * 2], z = ring.pts[j * 2 + 1];
      V(x, ring.y, z, u, v * 2.1, c);
      if (j < vertPerRing - 1) u += Math.hypot(ring.pts[j * 2 + 2] - x, ring.pts[j * 2 + 3] - z) / 1.15;
    }
    runU = u;
  }
  for (let ri = 0; ri < rings.length - 1; ri++) {
    const a0 = ringStart[ri], b0 = ringStart[ri + 1];
    const wrap = vertPerRing;
    for (let j = 0; j < wrap - 1; j++) {
      const a = a0 + j, b = a0 + j + 1, c = b0 + j, d = b0 + j + 1;
      idx.push(a, c, b, b, c, d);
    }
    /* close the ring seam */
    idx.push(a0 + wrap - 1, b0 + wrap - 1, a0, a0, b0 + wrap - 1, b0);
  }
  /* caps */
  const topRing = ringStart[0], botRing = ringStart[rings.length - 1];
  const topC = V(0, PLINTH_TOP, 0, .5, .5, PLINTH_VERT_COL_TOP);
  const botC = V(0, PLINTH_BOT, 0, .5, .5, PLINTH_VERT_COL_BOT);
  for (let j = 0; j < vertPerRing; j++) {
    idx.push(topC, topRing + j, topRing + (j + 1) % vertPerRing);
    idx.push(botC, botRing + (j + 1) % vertPerRing, botRing + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  plinth = new THREE.Mesh(geo, matWalnut);
  plinth.name = 'plinth';
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  WG.groups.case.add(plinth);
  caseApi.plinth = plinth;
}

/* ---------------------------------------------------------------- brass frame */
function buildFrame() {
  const seg = WG.quality.level >= 1 ? 18 : 10;
  const ballSeg = WG.quality.level >= 2 ? 18 : 12;

  /* flared turned base */
  const baseProfile = [
    [.205, 0], [.205, .022], [.178, .036], [.166, .052], [.171, .068],
    [.158, .086], [.132, .108], [.115, .142], [.113, .182], [.100, .215],
    [.096, .255], [.099, .300], [.091, .355], [.086, .400], [.089, .425]
  ];
  const baseGeo = lathe(baseProfile, seg);
  /* plain shaft with subtle taper */
  const shaftH = 9.45;
  const shaftGeo = new THREE.CylinderGeometry(.083, .089, shaftH, seg, WG.quality.level >= 1 ? 6 : 1);
  /* collar + cap under the finial */
  const collarGeo = lathe([[.086, 0], [.115, .012], [.128, .036], [.124, .060], [.104, .075], [.097, .092]], seg);
  const capGeo = lathe([[.097, 0], [.108, .012], [.104, .028], [.083, .042], [.070, .052]], seg);
  const finialGeo = new THREE.SphereGeometry(.098, ballSeg, Math.max(8, ballSeg - 4));

  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const g = new THREE.Group();
    g.position.set(POST_X * sx, 0, POST_Z * sz);
    const base = new THREE.Mesh(baseGeo, matDark);
    base.position.y = BLOCK_Y - .02; base.castShadow = true;
    g.add(base);
    const shaft = new THREE.Mesh(shaftGeo, matShaft);
    shaft.position.y = BLOCK_Y + .40 + shaftH / 2;
    shaft.castShadow = true;
    /* vertex ageing: dark at the bottom, brighter up top */
    const cols = [];
    const pa = shaftGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const f = U.clamp01((pa.getY(i) + shaftH / 2) / shaftH);
      const v = U.lerp(.52, 1.30, Math.pow(f, .62));
      cols.push(v, v * .99, v * .95);
    }
    shaftGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.add(shaft);
    const collar = new THREE.Mesh(collarGeo, matPolished);
    collar.position.y = LID_TOP + .05; collar.castShadow = true;
    g.add(collar);
    const cap = new THREE.Mesh(capGeo, matPolished);
    cap.position.y = LID_TOP + .145; cap.castShadow = true;
    g.add(cap);
    const finial = new THREE.Mesh(finialGeo, matPolished);
    finial.position.y = LID_TOP + .32; finial.castShadow = true;
    g.add(finial);
    WG.groups.case.add(g);
  }

  /* rails */
  const railMatTop = [matMid, matMid, matPolished, matDark, matMid, matMid];
  const railMatShoe = [matDark, matDark, matMid, matDark, matDark, matDark];
  const railGeo = new THREE.BoxGeometry(1, 1, 1);
  const rail = (w, h, x, y, z, mats) => {
    const m = new THREE.Mesh(railGeo, mats);
    m.scale.set(w, h, .125);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    WG.groups.case.add(m);
    return m;
  };
  const topY = WALL_TOP - .20, shoeY = BLOCK_Y + .225;
  rail(12.36, .24, 0, topY, IZ + .0625, railMatTop);
  rail(12.36, .24, 0, topY, -IZ - .0625, railMatTop);
  rail(8.36, .24, IX + .0625, topY, 0, railMatTop);
  rail(8.36, .24, -IX - .0625, topY, 0, railMatTop);
  rail(12.36, .45, 0, shoeY, IZ + .0625, railMatShoe);
  rail(12.36, .45, 0, shoeY, -IZ - .0625, railMatShoe);
  rail(8.36, .45, IX + .0625, shoeY, 0, railMatShoe);
  rail(8.36, .45, -IX - .0625, shoeY, 0, railMatShoe);

  /* dome rivets: nine along each long side, five along each short side, both rails */
  const domeGeo = new THREE.SphereGeometry(.03, WG.quality.level >= 1 ? 10 : 6, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const rows = [];
  for (const y of [topY, shoeY]) {
    rows.push({ y, z: IZ + .126, axis: 'x', n: 9, span: 5.1, rot: 0 });
    rows.push({ y, z: -IZ - .126, axis: 'x', n: 9, span: 5.1, rot: Math.PI });
    rows.push({ y, x: IX + .126, axis: 'z', n: 5, span: 2.5, rot: -Math.PI / 2 });
    rows.push({ y, x: -IX - .126, axis: 'z', n: 5, span: 2.5, rot: Math.PI / 2 });
  }
  let count = 0;
  for (const r of rows) count += r.n;
  const rivets = new THREE.InstancedMesh(domeGeo, matMid, count);
  rivets.castShadow = true;
  const mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), eul = new THREE.Euler(), scv = new THREE.Vector3(1, 1, .62);
  let ri = 0;
  for (const r of rows) {
    for (let i = 0; i < r.n; i++) {
      const f = r.n === 1 ? 0 : (i / (r.n - 1) - .5) * 2;
      const along = f * r.span;
      const px = r.axis === 'x' ? along : r.x;
      const pz = r.axis === 'x' ? r.z : along;
      eul.set(Math.PI / 2, 0, r.rot);
      qt.setFromEuler(eul);
      mtx.compose(new THREE.Vector3(px, r.y, pz), qt, scv);
      rivets.setMatrixAt(ri++, mtx);
    }
  }
  rivets.instanceMatrix.needsUpdate = true;
  WG.groups.case.add(rivets);

  /* patina freckles low down and in the recesses */
  const patCount = WG.quality.level >= 1 ? 74 : 36;
  const patGeo = new THREE.SphereGeometry(.036, 6, 4);
  const patina = new THREE.InstancedMesh(patGeo, matPatina, patCount);
  for (let i = 0; i < patCount; i++) {
    let px, py, pz;
    const pick = R();
    if (pick < .46) {
      px = (R() < .5 ? -1 : 1) * (IX + .04 + R() * .1);
      pz = (R() * 2 - 1) * (IZ - .2);
      py = BLOCK_Y + .02 + R() * .5;
    } else if (pick < .8) {
      px = (R() * 2 - 1) * (IX - .2);
      pz = (R() < .5 ? -1 : 1) * (IZ + .04 + R() * .1);
      py = BLOCK_Y + .02 + R() * .5;
    } else {
      px = (R() < .5 ? -1 : 1) * POST_X + (R() - .5) * .18;
      pz = (R() < .5 ? -1 : 1) * POST_Z + (R() - .5) * .18;
      py = BLOCK_Y + R() * .7;
    }
    eul.set(R() * 3, R() * 3, R() * 3); qt.setFromEuler(eul);
    const sc = .5 + R() * 1.4;
    mtx.compose(new THREE.Vector3(px, py, pz), qt, new THREE.Vector3(sc, sc * .55, sc));
    patina.setMatrixAt(i, mtx);
  }
  patina.instanceMatrix.needsUpdate = true;
  WG.groups.case.add(patina);

  /* lid centre knob */
  const knob = new THREE.Group();
  const knobDisc = new THREE.Mesh(lathe([[.165, 0], [.165, .022], [.132, .035], [.082, .048], [.068, .062], [.070, .075]], seg), matPolished);
  knob.add(knobDisc);
  const knobBall = new THREE.Mesh(new THREE.SphereGeometry(.082, ballSeg, Math.max(8, ballSeg - 4)), matPolished);
  knobBall.position.y = .128;
  knob.add(knobBall);
  const knobTip = new THREE.Mesh(new THREE.SphereGeometry(.032, 8, 6), matPolished);
  knobTip.position.y = .205;
  knob.add(knobTip);
  knob.position.set(0, LID_TOP - .002, 0);
  knob.traverse(o => { if (o.isMesh) o.castShadow = true; });
  WG.groups.case.add(knob);
}

/* ---------------------------------------------------------------- glass */
function smudgeTexture() {
  const size = WG.quality.level >= 2 ? 512 : (WG.quality.level >= 1 ? 384 : 256);
  return WG.canvasTex(size, size, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    /* greasy smudges — soft, low contrast */
    for (let i = 0; i < 9; i++) {
      const cx = R() * w, cy = R() * h, r = 18 + R() * 70;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      gr.addColorStop(0, `rgba(255,255,255,${.05 + R() * .07})`);
      gr.addColorStop(.55, `rgba(255,255,255,${.02 + R() * .04})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(cx, cy, r, r * (.5 + R() * .8), R() * 3, 0, 7); g.fill();
    }
    /* fingerprints: ridge arcs */
    for (let f = 0; f < 3; f++) {
      const cx = R() * w, cy = R() * h, rad = 9 + R() * 8;
      g.save(); g.translate(cx, cy); g.rotate(R() * 6.28);
      g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = .8;
      for (let i = 0; i < 9; i++) {
        g.beginPath(); g.ellipse(0, 0, rad + i * 1.5, (rad + i * 1.5) * .72, 0, .5, 4.3); g.stroke();
      }
      g.restore();
    }
    /* hairline scratches */
    for (let i = 0; i < 16; i++) {
      const x = R() * w, y = R() * h, a = R() * 6.28, len = 12 + R() * 90;
      g.strokeStyle = `rgba(255,255,255,${.05 + R() * .12})`; g.lineWidth = .5 + R() * .6;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * len * .5 + (R() - .5) * 12, y + Math.sin(a) * len * .5 + (R() - .5) * 12,
        x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    /* dust specks */
    for (let i = 0; i < 190; i++) {
      g.fillStyle = `rgba(255,255,255,${.06 + R() * .2})`;
      g.fillRect(R() * w, R() * h, .7 + R() * 1.3, .7 + R() * 1.3);
    }
    /* pack: G = roughness (20 base -> 255 on grime), A = faint visible film */
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      const v = 20 + a * .92;
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
      d[i + 3] = a * .42;
    }
    g.putImageData(img, 0, 0);
  }, { wrap: THREE.ClampToEdgeWrapping });
}

function buildGlassMaterial(strength = 1) {
  const gs = Number(strength).toFixed(3);
  const smudge = smudgeTexture();
  smudge.repeat.set(1, 1);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#d9efe6').convertSRGBToLinear(), metalness: 0, roughness: .23,
    transparent: true, opacity: 1, depthWrite: false,
    side: THREE.DoubleSide, envMap: WG.env.tex, envMapIntensity: 1.7,
    roughnessMap: smudge, toneMapped: false, fog: false
  });
  m.userData.smudge = smudge;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSmudge = { value: smudge };
    sh.uniforms.uTint = { value: WG.cols.glassTint.clone().multiplyScalar(.10) };
    sh.uniforms.uEdgeCol = { value: WG.cols.glassEdge.clone().multiplyScalar(.22) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFres;\nvarying vec2 vGUv;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 gp = modelViewMatrix * vec4(transformed, 1.0);
        vFres = pow(1.0 - abs(dot(normalize(normalMatrix * objectNormal), normalize(-gp.xyz))), 3.0);
        vGUv = uv;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uSmudge;\nuniform vec3 uTint, uEdgeCol;\nuniform float uStrength;\nvarying float vFres;\nvarying vec2 vGUv;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 smp = texture2D(uSmudge, vGUv);
        vec2 ed = min(vGUv, 1.0 - vGUv);
        float edge = smoothstep(0.14, 0.0, min(ed.x, ed.y));
        float fres = clamp(vFres, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint, (fres * 0.6 + edge * 0.22) * (.4 + ${gs} * .6));
        diffuseColor.rgb += uEdgeCol * edge * 0.18;
        diffuseColor.a = clamp(0.004 + (fres * fres * 0.30 + fres * 0.03 + edge * 0.05 + smp.a * 0.11) * ${gs}, 0.0, 0.38);`);
  };
  m.customProgramCacheKey = () => 'wg-glass';
  glassMat = m;
  return m;
}

function buildGlass() {
  const gmat = buildGlassMaterial();
  const defs = [
    { id: 0, nx: 0, nz: 1, cx: 0, cz: IZ + PANE_T / 2, rot: 0, w: 2 * IX, rotY: 0 },
    { id: 1, nx: 1, nz: 0, cx: IX + PANE_T / 2, cz: 0, rot: 0, w: 2 * IZ, rotY: Math.PI / 2 },
    { id: 2, nx: 0, nz: -1, cx: 0, cz: -IZ - PANE_T / 2, rot: 0, w: 2 * IX, rotY: Math.PI },
    { id: 3, nx: -1, nz: 0, cx: -IX - PANE_T / 2, cz: 0, rot: 0, w: 2 * IZ, rotY: -Math.PI / 2 }
  ];
  const h = WALL_TOP - BLOCK_Y;
  for (const d of defs) {
    const geo = new THREE.PlaneGeometry(d.w, h, 1, 1);
    const mesh = new THREE.Mesh(geo, gmat);
    mesh.position.set(d.cx, (WALL_TOP + BLOCK_Y) / 2, d.cz);
    mesh.rotation.y = d.rotY;
    mesh.renderOrder = 6;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = 'pane' + d.id;
    const normal = new THREE.Vector3(d.nx, 0, d.nz);
    const u = new THREE.Vector3(-d.nz, 0, d.nx);
    mesh.userData.pane = d.id;
    mesh.userData.pick = 'glass';
    mesh.userData.pickable = true;
    mesh.userData.normal = normal;
    const entry = {
      id: d.id, mesh, normal, inward: normal.clone().negate(), width: d.w, height: h,
      center: mesh.position.clone(), u, v: new THREE.Vector3(0, 1, 0), rotY: d.rotY,
      group: WG.groups.glass
    };
    caseApi.glassPanes.push(entry);
    caseApi.pickables.push(mesh);
    mesh.castShadow = false; WG.groups.glass.add(mesh);

    /* glowing cut edge along the top of the wall */
    const strip = new THREE.Mesh(new THREE.BoxGeometry(d.w, .009, .016), matEdge);
    strip.position.set(d.cx, WALL_TOP - .006, d.cz);
    strip.renderOrder = 7;
    WG.groups.glass.add(strip);
  }

  /* lid slab: thick, bevelled, overhanging */
  const shape = roundedRectShape(IX + .25, IZ + .25, .26);
  const lidGeo = new THREE.ExtrudeGeometry(shape, {
    depth: .36, bevelEnabled: true, bevelThickness: .045, bevelSize: .045,
    bevelSegments: 3, curveSegments: WG.quality.level >= 1 ? 10 : 6
  });
  lidGeo.rotateX(-Math.PI / 2);
  lid = new THREE.Mesh(lidGeo, buildGlassMaterial(.38));
  lid.position.y = LID_TOP - .45;
  lid.renderOrder = 7;
  lid.name = 'lid';
  lid.userData.pick = 'glass';
  lid.userData.pane = -1;
  lid.userData.pickable = true;
  lid.castShadow = false; WG.groups.glass.add(lid);
  caseApi.lid = lid;

  /* bright bevelled rim: a thin additive band round the lid edge */
  const bandShape = roundedRectShape(IX + .252, IZ + .252, .262);
  bandShape.holes.push((() => {
    const p = new THREE.Path();
    const inner = roundedRectPath(0, 0, IX + .236, IZ + .236, .246, []);
    p.moveTo(inner[0], inner[1]);
    for (let i = 2; i < inner.length; i += 2) p.lineTo(inner[i], inner[i + 1]);
    p.closePath();
    return p;
  })());
  const bandGeo = new THREE.ExtrudeGeometry(bandShape, { depth: .020, bevelEnabled: false, curveSegments: 8 });
  bandGeo.rotateX(-Math.PI / 2);
  const band = new THREE.Mesh(bandGeo, matEdge);
  band.position.y = LID_TOP - .26;
  band.renderOrder = 8;
  WG.groups.glass.add(band);
}

/* ---------------------------------------------------------------- plaque */
function plaqueTexture() {
  return WG.canvasTex(1024, 154, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = 12;
    const rr = (x, y, ww, hh, rad) => {
      g.beginPath();
      g.moveTo(x + rad, y);
      g.arcTo(x + ww, y, x + ww, y + hh, rad);
      g.arcTo(x + ww, y + hh, x, y + hh, rad);
      g.arcTo(x, y + hh, x, y, rad);
      g.arcTo(x, y, x + ww, y, rad);
      g.closePath();
    };
    g.save();
    rr(1, 1, w - 2, h - 2, r); g.clip();
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#d8bd8c'); gr.addColorStop(.32, '#b09668');
    gr.addColorStop(.62, '#c4a878'); gr.addColorStop(1, '#8f764c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    /* brushed streaks */
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(${R() < .5 ? 255 : 60},${R() < .5 ? 240 : 50},${R() < .5 ? 205 : 32},${.02 + R() * .05})`;
      g.lineWidth = .6 + R() * 1.1;
      const y = R() * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (R() - .5) * 2); g.stroke();
    }
    /* darkening toward the edges */
    const eg = g.createLinearGradient(0, 0, 0, h);
    eg.addColorStop(0, 'rgba(60,44,24,.32)'); eg.addColorStop(.5, 'rgba(60,44,24,0)'); eg.addColorStop(1, 'rgba(40,29,16,.45)');
    g.fillStyle = eg; g.fillRect(0, 0, w, h);
    g.restore();

    /* double border */
    g.strokeStyle = 'rgba(48,35,18,.78)'; g.lineWidth = 2.4;
    rr(15, 13, w - 30, h - 26, 6); g.stroke();
    g.strokeStyle = 'rgba(48,35,18,.5)'; g.lineWidth = 1.1;
    rr(23, 20, w - 46, h - 40, 4); g.stroke();
    g.strokeStyle = 'rgba(255,236,198,.30)'; g.lineWidth = 1;
    rr(16.4, 14.4, w - 32.8, h - 28.8, 6); g.stroke();

    /* diamonds at each end */
    const diamond = (x, y, s) => {
      g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * .72, y); g.lineTo(x, y + s); g.lineTo(x - s * .72, y); g.closePath();
      g.fillStyle = 'rgba(46,33,17,.82)'; g.fill();
    };
    diamond(48, h / 2, 9); diamond(w - 48, h / 2, 9);

    /* engraved lettering */
    const text = 'WEATHERGLASS';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = '700 58px "Iowan Old Style", Palatino, Georgia, serif';
    const gap = 12;
    let total = 0;
    for (const ch of text) total += g.measureText(ch).width + gap;
    total -= gap;
    let x = (w - total) / 2;
    for (const ch of text) {
      const cw = g.measureText(ch).width;
      g.fillStyle = 'rgba(255,240,208,.5)';
      g.fillText(ch, x + 1.2, h / 2 + 2.4);
      g.fillStyle = 'rgba(28,19,9,.96)';
      g.fillText(ch, x, h / 2 + 1);
      x += cw + gap;
    }
    /* rounded mask edge */
    g.globalCompositeOperation = 'destination-in';
    rr(1, 1, w - 2, h - 2, r); g.fill();
  }, { wrap: THREE.ClampToEdgeWrapping });
}

function buildPlaque() {
  const shape = roundedRectShape(1.16, .152, .024);
  const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 2, curveSegments: 6 });
  const plate = new THREE.Mesh(plateGeo, matMid);
  plate.position.set(0, -2.23, FRIEZE_Z + .001);
  plate.castShadow = true;
  WG.groups.case.add(plate);

  const faceMat = new THREE.MeshStandardMaterial({
    map: plaqueTexture(), transparent: true, roughness: .5, metalness: .35,
    envMap: WG.env.tex, envMapIntensity: .9, alphaTest: .35
  });
  brassMats.push(faceMat);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.32, .304), faceMat);
  face.position.set(0, -2.23, FRIEZE_Z + .061);
  WG.groups.case.add(face);

  /* two tiny slot screws */
  const slotGeo = new THREE.BoxGeometry(.052, .012, .012);
  for (const sx of [-1.06, 1.06]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(.021, .019, .012, 10), matPolished);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(sx, -2.23, FRIEZE_Z + .066);
    WG.groups.case.add(screw);
    const slot = new THREE.Mesh(slotGeo, matDark);
    slot.position.set(sx, -2.23, FRIEZE_Z + .0725);
    slot.rotation.z = sx > 0 ? .45 : -.3;
    WG.groups.case.add(slot);
  }
}

/* ---------------------------------------------------------------- gauge */
const GX = 2.66, GY = -2.215, GZ = FRIEZE_Z;

function gaugeFaceTexture() {
  const size = WG.quality.level >= 2 ? 512 : 320;
  return WG.canvasTex(size, size, (g, w, h) => {
    const cx = w / 2, cy = h / 2, r = w / 2 - 2;
    g.clearRect(0, 0, w, h);
    const bg = g.createRadialGradient(cx, cy - r * .12, r * .08, cx, cy, r);
    bg.addColorStop(0, '#fbf5e6'); bg.addColorStop(.62, '#f0e5cb');
    bg.addColorStop(.88, '#cdbf9e'); bg.addColorStop(1, '#ad9c7c');
    g.fillStyle = bg;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();

    /* soft blue band below zero on the inner scale */
    const startA = 135 * DEG, sweep = 270 * DEG;
    const ang = f => startA + sweep * f;
    g.strokeStyle = 'rgba(86,124,176,.42)'; g.lineWidth = r * .085;
    g.beginPath(); g.arc(cx, cy, r * .74, ang(0), ang(20 / 60)); g.stroke();
    /* soft green band over 40-60 humidity */
    g.strokeStyle = 'rgba(104,150,98,.46)'; g.lineWidth = r * .075;
    g.beginPath(); g.arc(cx, cy, r * .915, ang(.4), ang(.6)); g.stroke();

    /* outer humidity scale, 0..100 */
    g.strokeStyle = 'rgba(24,30,52,.95)';
    for (let v = 0; v <= 100; v += 2) {
      const a = ang(v / 100);
      const major = v % 20 === 0, mid = v % 10 === 0;
      const len = major ? r * .13 : mid ? r * .085 : r * .05;
      g.lineWidth = major ? 2.6 : mid ? 1.7 : 1.0;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (r * .95), cy + Math.sin(a) * (r * .95));
      g.lineTo(cx + Math.cos(a) * (r * .95 - len), cy + Math.sin(a) * (r * .95 - len));
      g.stroke();
    }
    g.fillStyle = 'rgba(20,27,48,.97)';
    g.font = `600 ${Math.round(r * .125)}px "Iowan Old Style", Palatino, Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let v = 0; v <= 100; v += 20) {
      const a = ang(v / 100), rr = r * .66;
      g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      g.rotate(a + Math.PI / 2);
      g.fillText(String(v), 0, 0); g.restore();
    }

    /* inner temperature scale, -20..40 */
    g.strokeStyle = 'rgba(104,26,20,.95)';
    for (let v = -20; v <= 40; v += 2) {
      const a = ang((v + 20) / 60);
      const major = v % 10 === 0, mid = v % 5 === 0;
      const len = major ? r * .12 : mid ? r * .075 : r * .045;
      g.lineWidth = major ? 2.4 : mid ? 1.5 : .9;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (r * .72), cy + Math.sin(a) * (r * .72));
      g.lineTo(cx + Math.cos(a) * (r * .72 - len), cy + Math.sin(a) * (r * .72 - len));
      g.stroke();
    }
    g.fillStyle = 'rgba(126,28,20,.98)';
    g.font = `600 ${Math.round(r * .112)}px "Iowan Old Style", Palatino, Georgia, serif`;
    for (let v = -20; v <= 40; v += 10) {
      const a = ang((v + 20) / 60), rr = r * .505;
      g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      g.rotate(a + Math.PI / 2);
      g.fillText(v < 0 ? '\u2212' + Math.abs(v) : String(v), 0, 0); g.restore();
    }

    /* lettering */
    g.fillStyle = 'rgba(20,25,40,.92)';
    g.font = `700 ${Math.round(r * .094)}px -apple-system, "Segoe UI", sans-serif`;
    const spaced = (txt, y, gap) => {
      let tot = 0;
      for (const ch of txt) tot += g.measureText(ch).width + gap;
      tot -= gap;
      let x = cx - tot / 2;
      for (const ch of txt) { g.fillText(ch, x, y); x += g.measureText(ch).width + gap; }
    };
    spaced('HUMIDITY %', cy - r * .30, r * .022);
    g.font = `600 ${Math.round(r * .11)}px "Iowan Old Style", Palatino, Georgia, serif`;
    g.fillText('\u00B0C', cx, cy + r * .30);
    g.fillStyle = 'rgba(34,30,25,.85)';
    g.font = `italic ${Math.round(r * .062)}px "Iowan Old Style", Palatino, Georgia, serif`;
    g.fillText('Weatherglass & Co.', cx, cy + r * .64);

    /* subtle vignette + grime */
    const vg = g.createRadialGradient(cx, cy, r * .55, cx, cy, r);
    vg.addColorStop(0, 'rgba(70,55,32,0)'); vg.addColorStop(1, 'rgba(62,48,28,.34)');
    g.fillStyle = vg; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }, { wrap: THREE.ClampToEdgeWrapping });
}

function buildGauge() {
  gaugeRoot = new THREE.Group();
  gaugeRoot.position.set(GX, GY, GZ);
  WG.groups.case.add(gaugeRoot);

  /* mounting collar sunk into the frieze */
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(.248, .244, .07, 32), matMid);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = .035;
  collar.castShadow = true;
  gaugeRoot.add(collar);

  const faceMap = gaugeFaceTexture();
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceMap, roughness: .62, metalness: .08, envMap: WG.env.tex, envMapIntensity: .25,
    transparent: true, alphaTest: .5, emissive: new THREE.Color('#2a2118'), emissiveIntensity: 1
  });
  brassMats.push(faceMat);
  gaugeFace = new THREE.Mesh(new THREE.CircleGeometry(.224, 48), faceMat);
  gaugeFace.position.z = .077;
  gaugeRoot.add(gaugeFace);

  /* bezel */
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(.234, .024, 10, 44), matPolished);
  bezel.position.z = .0805;
  bezel.castShadow = true;
  gaugeRoot.add(bezel);
  const bezelLip = new THREE.Mesh(new THREE.CylinderGeometry(.268, .260, .026, 40), matMid);
  bezelLip.rotation.x = Math.PI / 2;
  bezelLip.position.z = .060;
  gaugeRoot.add(bezelLip);

  /* needles */
  const pivot = new THREE.Group();
  pivot.position.z = .0835;
  gaugeRoot.add(pivot);
  const mkNeedle = (len, wdt, mat, z) => {
    const geo = new THREE.BoxGeometry(wdt, len, .008);
    geo.translate(0, len / 2 - .012, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z;
    m.castShadow = false;
    pivot.add(m);
    return m;
  };
  needleHum = mkNeedle(.208, .0105, matSteel, 0);
  needleTemp = mkNeedle(.148, .0125, matRed, .009);

  const hubCap = new THREE.Mesh(new THREE.SphereGeometry(.024, 12, 8), matPolished);
  hubCap.scale.z = .55;
  hubCap.position.z = .0935;
  pivot.add(hubCap);

  /* domed crystal */
  const domeGeo = new THREE.SphereGeometry(.234, 28, 12, 0, Math.PI * 2, 0, 1.12);
  domeGeo.rotateX(Math.PI / 2);
  domeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dff0ea').convertSRGBToLinear(), metalness: 0, roughness: .05,
    transparent: true, opacity: .075, envMap: WG.env.tex, envMapIntensity: 1.45,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, fog: false
  });
  brassMats.push(domeMat);
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.z = .0805;
  dome.scale.z = .42;
  dome.renderOrder = 9;
  gaugeRoot.add(dome);

  /* hit target */
  gaugeHit = new THREE.Mesh(new THREE.CircleGeometry(.32, 20), matHit);
  gaugeHit.position.z = .115;
  gaugeHit.userData.pick = 'gauge';
  gaugeHit.userData.pickable = true;
  gaugeRoot.add(gaugeHit);
  caseApi.pickables.push(gaugeHit);
  caseApi.gauge.picker = gaugeHit;

  setNeedleTargets(S.temp, S.humidity * 100, true);
}

function setNeedleTargets(temp, hum, snap) {
  const tf = U.clamp01((U.clamp(temp, -20, 40) + 20) / 60);
  const hf = U.clamp01(hum / 100);
  if (snap) { needleState.t = tf; needleState.h = hf; }
  needleState.tTarget = tf;
  needleState.hTarget = hf;
}

function tapGauge() {
  tapPulse = 1;
  needleState.hv += .9 + R() * .5;
  needleState.tv -= .7 + R() * .5;
  quiver = 1;
  if (WG.audio && WG.audio.event) WG.run('audio', () => WG.audio.event('tick', {}));
  WG.emit('gaugetap', {});
}

function updateNeedles(dt, t) {
  if (!needleHum) return;
  const ht = needleState.hTarget ?? .45, tt = needleState.tTarget ?? .6;
  needleState.hv += (ht - needleState.h) * 78 * dt;
  needleState.tv += (tt - needleState.t) * 78 * dt;
  needleState.hv *= Math.exp(-5.2 * dt);
  needleState.tv *= Math.exp(-5.2 * dt);
  needleState.h += needleState.hv * dt;
  needleState.t += needleState.tv * dt;
  const q = (quiver * .007 + .0016) * (1 + S.wind * 1.4);
  quiver *= Math.max(0, 1 - dt * 1.1);
  const qh = (WG.noise2(t * 7.3, 1.1) - .5) * q;
  const qt = (WG.noise2(t * 8.1, 5.7) - .5) * q;
  const ah = 135 + 270 * U.clamp01(needleState.h + qh);
  const at = 135 + 270 * U.clamp01(needleState.t + qt);
  needleHum.rotation.z = -(225 + (ah - 135)) * DEG;
  needleTemp.rotation.z = -(225 + (at - 135)) * DEG;
  if (tapPulse > 0.001) {
    gaugeRoot.rotation.z = Math.sin(t * 46) * tapPulse * .012;
    tapPulse *= Math.max(0, 1 - dt * 4);
  }
}

/* ---------------------------------------------------------------- tap input */
function onPointerDown(e) {
  if (!ready || !gaugeHit) return;
  try {
    const r = WG.renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, WG.camera);
    const hits = raycaster.intersectObject(gaugeHit, false);
    if (hits.length) tapGauge();
  } catch (err) { WG.warn('case:tap', err); }
}

/* ---------------------------------------------------------------- register */
function onLightning() { quiver = 1; }

function build() {
  buildMaterials();
  buildPlinth();
  buildFrame();
  buildGlass();
  buildPlaque();
  buildGauge();
  WG.on('lightning', onLightning);
  caseApi.gauge.needles = setNeedleTargets;
  caseApi.gauge.tap = tapGauge;
  ready = true;
  caseApi.ready = true;
}

WG.register('case', {
  order: 18,
  init() {
    try { build(); } catch (e) { WG.warn('case', e); }
  },
  update(dt, t) {
    if (!ready) return;
    try {
      /* follow state unless the sim pushes explicit needle values */
      if (!needleState.external) {
        const temp = S.gaugeTemp !== undefined ? S.gaugeTemp : S.temp;
        const hum = S.gaugeHum !== undefined ? S.gaugeHum : S.humidity * 100;
        setNeedleTargets(temp, hum, false);
      }
      updateNeedles(dt, t);

      /* reflective materials track the studio cubemap as it is rebuilt */
      if (WG.env.tex) {
        if (matPolished.envMap !== WG.env.tex) {
          for (const m of brassMats) { m.envMap = WG.env.tex; m.needsUpdate = true; }
          glassMat.envMap = WG.env.tex;
          glassMat.needsUpdate = true;
        }
        const dim = .28 + U.clamp01(S.daylight) * .9 - S.storm * .44 - S.night * .62;
        for (const m of brassMats) {
          const base = m.userData.envBase || 1;
          m.envMapIntensity = U.clamp(m.envMapIntensity * .94 + base * dim * dt * 2.2, .1, 2.4);
        }
      }

      /* glass edge glow responds to the light in the room */
      const glow = .20 + U.clamp01(S.daylight) * .55 + S.golden * .3 - S.storm * .14 - S.night * .13;
      for (const m of glassEdgeMats) m.opacity = U.clamp(glow + S.flash * .9, .04, 1);
      matEdge.color.copy(WG.cols.glassEdge).multiplyScalar(.5 + U.clamp01(S.daylight) * .5);
      if (S.flash > .01) matEdge.color.lerp(WG.cols.moon, U.clamp01(S.flash) * .7);

      /* gauge needles quake faintly whenever the weather is unsettled */
      quiver = Math.max(quiver, S.storm * .5, S.rain * .28);
    } catch (e) { WG.warn('case:update', e); }
  },
  dispose() {
    try {
      WG.off('lightning', onLightning);
    } catch (e) { WG.warn('case:dispose', e); }
  }
});
})();