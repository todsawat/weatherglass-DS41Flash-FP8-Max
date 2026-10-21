/* ===== 09_cabin.js — log cabin, yard, jetty, boat, smoke, windows ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state, Q = WG.quality;
if (!WG.groups || !WG.groups.props) return;
const R = WG.rng('cabin');
const group = new THREE.Group(); group.name = 'cabinGroup';
WG.groups.props.add(group);

const CABIN = { x: -2.95, z: 1.35, rot: THREE.MathUtils.degToRad(30) };
const JETTY = { x: 0.02, z: 2.42 };
const BOAT = { x: 1.12, z: 2.24 };
const BOAT_ANCHOR = new THREE.Vector3(BOAT.x, .1, BOAT.z);

const T = () => WG.terrain;
function ground(x, z) {
  const t = T();
  if (t && t.ready && t.heightAt) { try { return t.heightAt(x, z); } catch (e) {} }
  return .6;
}
const _v = new THREE.Vector3();

WG.cabin = {
  ready: false, perches: [], shelters: [], windows: [], boat: null,
  boatAnchor: BOAT_ANCHOR, smokeOn: 0, lightPool: null
};

/* ---------- materials ---------- */
let mats = null;
const woodMats = [];
function buildMats() {
  const log = (c) => {
    const m = new THREE.MeshStandardMaterial({ color: WG.col(c), roughness: .82, metalness: 0, envMapIntensity: .35 });
    woodMats.push(m); return m;
  };
  const stone = (c) => new THREE.MeshStandardMaterial({ color: WG.col(c), roughness: .94, metalness: .02 });
  mats = {
    logs: [log('#8a6440'), log('#7a5636'), log('#966e49'), log('#6e5034'), log('#8f6a44')],
    chink: new THREE.MeshStandardMaterial({ color: WG.col('#d6cbb0'), roughness: .96 }),
    board: log('#7d5c3c'), trim: new THREE.MeshStandardMaterial({ color: WG.col('#e4dcc6'), roughness: .7 }),
    roof: new THREE.MeshStandardMaterial({ color: WG.col('#5c544b'), roughness: .93 }),
    door: log('#7a2c22'), shutter: new THREE.MeshStandardMaterial({ color: WG.col('#3c5e48'), roughness: .76 }),
    iron: new THREE.MeshStandardMaterial({ color: WG.col('#232424'), roughness: .46, metalness: .8 }),
    stoneA: stone('#8d8a80'), stoneB: stone('#77746c'), stoneC: stone('#9c9484'),
    moss: new THREE.MeshStandardMaterial({ color: WG.col('#4a6a37'), roughness: .95 }),
    snow: new THREE.MeshStandardMaterial({ color: WG.col('#e9edef'), roughness: .78 }),
    deck: new THREE.MeshStandardMaterial({ color: WG.col('#8e887c'), roughness: .88 }),
    hull: new THREE.MeshStandardMaterial({ color: WG.col('#3d6b5e'), roughness: .55 }),
    hullLow: new THREE.MeshStandardMaterial({ color: WG.col('#8a4230'), roughness: .6 }),
    pale: new THREE.MeshStandardMaterial({ color: WG.col('#cbbd9f'), roughness: .75 }),
    winGlass: new THREE.MeshStandardMaterial({ color: WG.col('#2a231e'), roughness: .25, metalness: .1, emissive: WG.col('#d27e4c'), emissiveIntensity: 0 }),
    lantern: new THREE.MeshStandardMaterial({ color: WG.col('#3a3326'), roughness: .4, metalness: .6, emissive: WG.col('#ffb469'), emissiveIntensity: 0 }),
    rope: new THREE.MeshStandardMaterial({ color: WG.col('#a99a78'), roughness: .95 })
  };
}

function add(geo, mat, x, y, z, rx, ry, rz, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
  m.castShadow = true; m.receiveShadow = true;
  (parent || group).add(m);
  return m;
}
function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function cyl(rt, rb, h, seg) { return new THREE.CylinderGeometry(rt, rb, h, seg || 7); }

/* ---------- cabin build ---------- */
const cabinGroup = new THREE.Group();
const snowGroup = new THREE.Group();
let smoke, smokeVel = [], windowMats = [], windowMeshes = [], lanternLight, porchLight, lightPool;
const W = .7, D = .5, WALL_H = .44, RIDGE = .66;

function buildCabin(h) {
  cabinGroup.position.set(CABIN.x, h, CABIN.z);
  cabinGroup.rotation.y = CABIN.rot;
  group.add(cabinGroup);
  cabinGroup.add(snowGroup);

  /* fieldstone footing */
  for (let i = 0; i < 34; i++) {
    const front = i < 14;
    const side = i >= 14;
    let x, z;
    if (front) { x = (R() - .5) * (.8); z = (R() < .5 ? -1 : 1) * (D / 2 + .02); }
    else { x = (R() < .5 ? -1 : 1) * (W / 2 + .02); z = (R() - .5) * (D + .04); }
    const st = add(new THREE.DodecahedronGeometry(.036 + R() * .02, 0),
      [mats.stoneA, mats.stoneB, mats.stoneC][i % 3], x, .012 + R() * .03, z, R() * 3, R() * 3, R() * 3, cabinGroup);
    st.scale.y = .7;
  }

  /* log courses + chinking */
  const courses = 6, courseH = WALL_H / courses;
  for (let c = 0; c < courses; c++) {
    const y = .06 + courseH * (c + .5);
    const lm = mats.logs[c % mats.logs.length];
    // front and back walls
    for (const zs of [-1, 1]) {
      add(new THREE.CylinderGeometry(courseH * .52, courseH * .52, W + .14, 7),
        lm, 0, y, zs * (D / 2 - .012), 0, 0, Math.PI / 2, cabinGroup);
      add(box(W, courseH * .55, .022), mats.chink, 0, y, zs * (D / 2 - .045), 0, 0, 0, cabinGroup);
    }
    // side walls
    for (const xs of [-1, 1]) {
      add(new THREE.CylinderGeometry(courseH * .5, courseH * .5, D + .14, 7),
        lm, xs * (W / 2 - .012), y, 0, Math.PI / 2, 0, 0, cabinGroup);
      add(box(.022, courseH * .55, D), mats.chink, xs * (W / 2 - .045), y, 0, 0, 0, 0, cabinGroup);
    }
  }

  /* gable boards */
  for (const zs of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(0, 0, zs * (D / 2 - .02)); cabinGroup.add(g);
    for (let i = -4; i <= 4; i++) {
      const x = i * .078;
      const hgt = Math.max(.04, RIDGE - WALL_H - Math.abs(i) * .035);
      add(box(.072, hgt, .022), mats.board, x, WALL_H + hgt / 2, 0, 0, 0, 0, g);
    }
  }

  /* roof: two 40° stepped shingle planes */
  const slope = THREE.MathUtils.degToRad(40);
  const half = D / 2 + .10, rise = Math.tan(slope) * half;
  const roofLen = Math.hypot(half, rise);
  for (const zs of [-1, 1]) {
    const rg = new THREE.Group();
    rg.position.set(0, WALL_H + rise / 2, zs * half / 2);
    rg.rotation.x = zs * slope;
    cabinGroup.add(rg);
    add(box(W + .3, .022, roofLen + .06), mats.roof, 0, 0, 0, 0, 0, 0, rg);
    for (let r = 0; r < 6; r++) {
      const t = (r + .5) / 6;
      const y = -.012 + Math.sin(t * Math.PI) * .006;
      add(box(W + .31, .016, .09), mats.roof, 0, y + .016, -roofLen / 2 + .05 + t * (roofLen - .1), 0, 0, 0, rg);
    }
    // moss on the shaded (left) half
    for (let i = 0; i < 7; i++) {
      const x = -.34 + R() * .32, t = R();
      add(new THREE.SphereGeometry(.03 + R() * .03, 5, 4), mats.moss,
        x, .03, -roofLen / 2 + .06 + t * (roofLen - .12), 0, 0, 0, rg).scale.y = .35;
    }
  }
  // ridge cap
  add(cyl(.035, .035, W + .34, 7), mats.roof, 0, WALL_H + rise + .01, 0, 0, 0, Math.PI / 2, cabinGroup);

  /* chimney (left end, outside) */
  const chx = -W / 2 - .13;
  for (let i = 0; i < 11; i++) {
    const y = .06 + i * .064;
    add(new THREE.DodecahedronGeometry(.062, 0), [mats.stoneA, mats.stoneB, mats.stoneC][i % 3],
      chx + (R() - .5) * .03, y, (R() - .5) * .03, R() * 3, R() * 3, R() * 3, cabinGroup).scale.set(1, .68, 1);
  }
  add(box(.17, .03, .17), mats.iron, chx, .06 + 11 * .064, 0, 0, 0, 0, cabinGroup); // sooty cap
  add(box(.19, .05, .19), mats.iron, chx, .02, 0, 0, 0, 0, cabinGroup);

  /* door + step + hinges */
  const doorX = .17, doorZ = D / 2 + .012;
  add(box(.15, .31, .022), mats.door, doorX, .06 + .155, doorZ, 0, 0, 0, cabinGroup);
  for (let i = 0; i < 4; i++) add(box(.012, .31, .006), mats.board, doorX - .055 + i * .037, .215, doorZ + .014, 0, 0, 0, cabinGroup);
  add(box(.11, .016, .02), mats.iron, doorX, .26, doorZ + .018, 0, 0, 0, cabinGroup);
  add(box(.11, .016, .02), mats.iron, doorX, .14, doorZ + .018, 0, 0, 0, cabinGroup);
  add(new THREE.SphereGeometry(.012, 6, 4), mats.iron, doorX + .055, .2, doorZ + .022, 0, 0, 0, cabinGroup);
  add(box(.22, .028, .15), mats.stoneB, doorX, .014, D / 2 + .09, 0, 0, 0, cabinGroup);

  /* windows */
  function windowAt(x, y, z, rotY, small, shutters, flowerBox) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; cabinGroup.add(g);
    const w = small ? .1 : .14, h = small ? .1 : .13;
    add(box(w + .035, h + .035, .012), mats.trim, 0, 0, .012, 0, 0, 0, g);
    const glassM = mats.winGlass.clone(); windowMats.push(glassM);
    const glass = add(box(w, h, .008), glassM, 0, 0, .018, 0, 0, 0, g);
    windowMeshes.push(glass);
    add(box(w, .008, .014), mats.trim, 0, 0, .022, 0, 0, 0, g);
    add(box(.008, h, .014), mats.trim, 0, 0, .022, 0, 0, 0, g);
    if (shutters) for (const s of [-1, 1]) add(box(w * .45, h + .02, .012), mats.shutter, s * (w * .75 + .015), 0, .008, 0, 0, 0, g);
    if (flowerBox) {
      add(box(w + .06, .035, .045), mats.board, 0, -h / 2 - .035, .03, 0, 0, 0, g);
      const cols = ['#c8462e', '#d98aa8', '#e8e2d4', '#dd7a29'];
      for (let i = 0; i < 7; i++) {
        add(new THREE.SphereGeometry(.009, 5, 4), new THREE.MeshStandardMaterial({ color: WG.col(cols[i % 4]), roughness: .7 }),
          (R() - .5) * (w + .03), -h / 2 - .014 + R() * .01, .03, 0, 0, 0, g);
      }
    }
    return g;
  }
  windowAt(doorX - .23, .235, D / 2 + .012, 0, false, true, true);
  windowAt(W / 2 + .012, .24, 0, Math.PI / 2, false, true, false);
  windowAt(0, .24, -D / 2 - .012, Math.PI, false, false, false);
  windowAt(-W / 2 - .012, .25, .02, -Math.PI / 2, true, false, false);

  /* porch + posts + eave */
  add(box(.56, .022, .26), mats.roof, .02, .40, D / 2 + .13, -.12, 0, 0, cabinGroup);
  for (const px of [-.2, .24]) add(cyl(.016, .02, .36, 6), mats.board, px, .2, D / 2 + .22, 0, 0, 0, cabinGroup);
  add(box(.56, .02, .28), mats.deck, .02, .02, D / 2 + .13, 0, 0, 0, cabinGroup);

  /* firewood stack */
  for (let i = 0; i < 9; i++) {
    add(cyl(.018, .018, .16, 5), mats.board, .28 + (R() - .5) * .05, .05 + (i % 3) * .036, D / 2 + .2 + (i > 5 ? .035 : 0), 0, 0, Math.PI / 2, cabinGroup);
  }

  /* lantern */
  const lantern = new THREE.Group();
  lantern.position.set(-.05, .3, D / 2 + .03);
  cabinGroup.add(lantern);
  add(box(.038, .05, .038), mats.lantern, 0, 0, 0, 0, 0, 0, lantern);
  add(box(.05, .008, .05), mats.iron, 0, .03, 0, 0, 0, 0, lantern);
  lanternLight = new THREE.PointLight(WG.col('#ffb469').getHex(), 0, 2.6, 2);
  lanternLight.position.set(-.05, .34, D / 2 + .08);
  cabinGroup.add(lanternLight);

  /* yard: chopping block, axe, logs */
  const bx = -.55, bz = .1;
  add(cyl(.11, .12, .14, 7), mats.board, bx, .07, bz, 0, R(), 0, cabinGroup);
  add(box(.014, .22, .012), mats.board, bx + .02, .2, bz, .1, 0, .06, cabinGroup);
  add(box(.05, .02, .015), mats.iron, bx + .02, .21, bz, .1, 0, .06, cabinGroup);
  for (let i = 0; i < 4; i++) add(cyl(.025, .03, .16, 5), mats.board, bx + .18 + i * .03, .04, bz - .12, 0, 0, Math.PI / 2, cabinGroup);

  /* rain barrel */
  add(cyl(.1, .11, .22, 10), mats.board, .34, .11, -.36, 0, 0, 0, cabinGroup);
  for (const y of [.06, .16]) add(new THREE.TorusGeometry(.104, .008, 4, 10), mats.iron, .34, y, -.36, Math.PI / 2, 0, 0, cabinGroup);

  /* crooked fence on the chimney side */
  const posts = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 5;
    const px = -.55 - a * .72, pz = .38 - a * .1;
    const p = add(cyl(.022, .028, .34 + R() * .06, 5), mats.deck, px + (R() - .5) * .03, .17, pz, (R() - .5) * .12, 0, (R() - .5) * .16, cabinGroup);
    posts.push(p);
    if (i > 0) for (const y of [.12, .23]) {
      const q = posts[i - 1];
      const mid = new THREE.Vector3((p.position.x + q.position.x) / 2, y, (p.position.z + q.position.z) / 2);
      add(box(.16, .016, .012), mats.deck, mid.x, mid.y, mid.z, 0, Math.atan2(p.position.x - q.position.x, p.position.z - q.position.z) + Math.PI / 2, (R() - .5) * .1, cabinGroup);
    }
  }
  add(box(.16, .025, .16), mats.stoneB, -.2, .014, D / 2 + .32, 0, .2, 0, cabinGroup);

  /* step stone + path blend handled by terrain */

  /* snow blankets */
  const blanket = add(box(W + .24, .03, D + .2), mats.snow, 0, WALL_H + rise - .01, 0, 0, 0, 0, snowGroup);
  blanket.scale.y = .01;
  snowGroup.userData.blanket = blanket;
  for (let i = 0; i < 12; i++) {
    const s = add(new THREE.SphereGeometry(.03 + R() * .03, 5, 4), mats.snow,
      (R() - .5) * (W + .2), WALL_H + rise - .005, (R() - .5) * (D + .2), 0, 0, 0, snowGroup);
    s.scale.y = .45;
  }
  // snow on fence tops, barrel and chopping block
  for (let i = 0; i < 8; i++) {
    const tgt = i < 6
      ? new THREE.Vector3(-.55 - (i / 5) * .72, .37, .38 - (i / 5) * .1)
      : i === 6 ? new THREE.Vector3(.34, .24, -.36) : new THREE.Vector3(-.55, .15, .1);
    const cap = add(new THREE.SphereGeometry(.045, 5, 3), mats.snow, tgt.x, tgt.y, tgt.z, 0, 0, 0, snowGroup);
    cap.scale.set(1.2, .35, 1.2);
  }
  snowGroup.userData.roofSnow = snowGroup.children.filter(c => c !== blanket);
  for (const c of snowGroup.userData.roofSnow) c.visible = false;

  /* smoke */
  const smokeN = [20, 32, 44][Q.level];
  const sp = new Float32Array(smokeN * 3);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sm = new THREE.PointsMaterial({ map: WG.tex.glow, color: WG.col('#c8c2b8'), size: .02, transparent: true, opacity: 0, depthWrite: false });
  smoke = new THREE.Points(sg, sm); smoke.frustumCulled = false; cabinGroup.add(smoke);
  for (let i = 0; i < smokeN; i++) { smokeVel.push({ t: R() * 3, drift: (R() - .5) * .05 }); sp[i * 3 + 1] = -99; }

  /* perches / shelters in world space */
  cabinGroup.updateMatrixWorld(true);
  const ridgeP = new THREE.Vector3(0, WALL_H + rise + .05, -.08).applyMatrix4(cabinGroup.matrixWorld);
  const chimP = new THREE.Vector3(chx, .06 + 11 * .064 + .04, 0).applyMatrix4(cabinGroup.matrixWorld);
  WG.cabin.perches.push(ridgeP, chimP);
  for (const p of posts) WG.cabin.perches.push(new THREE.Vector3(0, .34, 0).applyMatrix4(p.matrixWorld));
  WG.cabin.shelters.push(new THREE.Vector3(-.05, .3, D / 2 + .16).applyMatrix4(cabinGroup.matrixWorld));
  WG.cabin.shelters.push(chimP.clone());

  windowMeshes.forEach(m => { m.userData.cabinWindow = true; });
}

/* ---------- jetty & boat ---------- */
function buildJetty() {
  const baseY = Math.max(.02, ground(JETTY.x, JETTY.z));
  const jg = new THREE.Group();
  jg.position.set(JETTY.x, 0, JETTY.z);
  group.add(jg);
  const yDeck = Math.max(.14, S.waterY + .14);
  // deck
  for (let i = 0; i < 10; i++) add(box(.075, .022, .18), mats.deck, .06 + i * .085, yDeck, 0, 0, (R() - .5) * .04, 0, jg);
  // bearers
  for (const zs of [-1, 1]) add(box(.9, .03, .035), mats.deck, .47, yDeck - .028, zs * .06, 0, 0, 0, jg);
  // piles
  const pileX = [.08, .3, .55, .8];
  const pilings = [];
  for (const px of pileX) for (const zs of [-1, 1]) {
    const bed = Math.min(ground(px, zs * .085), S.waterY - .05);
    const len = yDeck - bed + .1;
    const p = add(cyl(.023, .026, len, 7), mats.deck, px, (yDeck + bed) / 2, zs * .085, 0, 0, 0, jg);
    pilings.push({ p, zs, px });
  }
  // braces
  for (let i = 0; i < 3; i++) for (const zs of [-1, 1]) {
    add(box(.016, .34, .012), mats.deck, pileX[i] + .16, yDeck - .2, zs * .085, 0, 0, .5, jg);
  }
  // mooring posts (last pair) + rope coil
  for (const zs of [-1, 1]) add(cyl(.028, .032, .34, 7), mats.deck, .88, yDeck + .03, zs * .085, 0, 0, 0, jg);
  const coil = add(new THREE.TorusGeometry(.05, .012, 5, 12), mats.rope, .7, yDeck + .03, .02, Math.PI / 2, 0, 0, jg);
  coil.scale.y = .9;
  // algae waterline bands (move with lake)
  const algaeMat = new THREE.MeshStandardMaterial({ color: WG.col('#33502f'), roughness: .9 });
  const bands = [];
  for (const { p, zs, px } of pilings) {
    const b = add(cyl(.028, .028, .06, 7), algaeMat, px, S.waterY, zs * .085, 0, 0, 0, jg);
    bands.push(b);
    WG.cabin.perches.push(new THREE.Vector3(px, yDeck + .12, zs * .085).add(jg.position));
  }
  jg.userData.bands = bands; jg.userData.yDeck = yDeck;
  WG.cabin.jetty = jg;

  /* boat */
  const bg = new THREE.Group();
  bg.position.set(BOAT.x, S.waterY, BOAT.z);
  bg.rotation.y = -.5;
  group.add(bg);
  const hullGeo = new THREE.SphereGeometry(.18, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
  hullGeo.scale(1, .5, .62);
  const hull = new THREE.Mesh(hullGeo, mats.hullLow);
  hull.scale.set(1, .8, 1);
  hull.position.y = -.02;
  bg.add(hull);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(.18, .175, .07, 12, 1, true), mats.hull);
  upper.scale.z = .62; upper.position.y = .015; bg.add(upper);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(.163, .16, .06, 12, 1, true), mats.pale);
  inner.scale.z = .62; inner.position.y = .04; bg.add(inner);
  for (const z of [-.07, 0, .07]) {
    add(box(.2, .012, .03), mats.pale, 0, .055, z, 0, 0, 0, bg);
  }
  for (const s of [-1, 1]) add(box(.015, .012, .3), mats.pale, s * .19, .06, .02, 0, .3, 0, bg);
  // rope to mooring post
  const ropePts = [];
  const mp = new THREE.Vector3(.88, .24, -.085).add(jg.position);
  ropePts.push(new THREE.Vector3(0, .06, .16).add(bg.position), new THREE.Vector3(mp.x - .02, .12, mp.z));
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ropePts), new THREE.LineBasicMaterial({ color: WG.col('#a99a78') }));
  group.add(rope);
  bg.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  const boat = { group: bg, y0: S.waterY, phase: R() * 6, rock: 0, rope, moor: mp };
  WG.cabin.boat = boat;
}

/* ---------- light pool ---------- */
function buildLightPool() {
  lightPool = new THREE.Mesh(new THREE.CircleGeometry(.42, 20), new THREE.MeshBasicMaterial({
    map: WG.tex.glow, color: WG.col('#ffb168'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  lightPool.rotation.x = -Math.PI / 2;
  const p = new THREE.Vector3(.02, .03, D / 2 + .18).applyMatrix4(cabinGroup.matrixWorld);
  lightPool.position.copy(p).setY(ground(p.x, p.z) + .015);
  group.add(lightPool);
  WG.cabin.lightPool = lightPool;
  porchLight = new THREE.PointLight(WG.col('#ff9f5e').getHex(), 0, 1.6, 2);
  porchLight.position.copy(p).setY(lightPool.position.y + .2);
  group.add(porchLight);
}

/* ---------- update ---------- */
let ready = false, lastSmoke = 0;
function updateSmoke(dt, t) {
  if (!smoke) return;
  const arr = smoke.geometry.attributes.position.array;
  const n = arr.length / 3;
  const cold = U.clamp01((10 - S.temp) / 14) + S.storm * .6 + S.snowfall * .4;
  const rate = (1.1 + cold * 2.4) * (1 - S.rain * .35);
  const upSpd = (.16 + cold * .16) * (1 - S.rain * .55);
  for (let i = 0; i < n; i++) {
    smokeVel[i].t += dt * rate * (i / n + .4);
    if (smokeVel[i].t > 1 || arr[i * 3 + 1] < -50) {
      smokeVel[i].t = .001;
      arr[i * 3] = (R() - .5) * .012; arr[i * 3 + 1] = .76; arr[i * 3 + 2] = (R() - .5) * .012;
    }
    if (smokeVel[i].t <= 0) continue;
    const k = smokeVel[i].t;
    arr[i * 3] += (S.windVec.x * .18 * k + smokeVel[i].drift + Math.sin(t * 1.3 + i) * .008) * dt;
    arr[i * 3 + 1] += upSpd * (1 - k * .5) * dt;
    arr[i * 3 + 2] += (S.windVec.z * .18 * k + Math.cos(t * .9 + i) * .006) * dt;
  }
  smoke.geometry.attributes.position.needsUpdate = true;
  smoke.material.opacity = U.clamp01(.045 + S.fires * .12 + cold * .02) * (1 - S.rain * .25);
  smoke.material.size = .016 + cold * .012;
}

function applyState(dt, t) {
  const rain = U.clamp01(S.rain + S.snowfall * .3);
  // wood darkens and glosses in rain
  for (const m of woodMats) {
    m.color.copy(m.userData.base || (m.userData.base = m.color.clone()));
    if (rain > .02) m.color.multiplyScalar(1 - rain * .34);
    m.roughness = U.damp(m.roughness, .82 - rain * .5, 2, dt);
  }
  // window/lantern glow
  const hour = S.time;
  const smallHours = hour > .6 && hour < 4.6 ? .36 : 1;
  const dusk = U.smoothstep(.28, .62, S.fires);
  const fire = U.clamp01(S.fires * (smallHours < 1 ? .36 : 1) + S.storm * .18);
  const flick = .86 + Math.sin(t * 11.3) * .07 + Math.sin(t * 23.7) * .04;
  for (const m of windowMats) {
    m.emissiveIntensity = U.damp(m.emissiveIntensity, fire * 1.35 * flick, 5, dt);
    m.color.setRGB(.1 + fire * .9, .07 + fire * .45, .05 + fire * .25);
  }
  if (mats.lantern) mats.lantern.emissiveIntensity = U.damp(mats.lantern.emissiveIntensity, fire * 1.9, 5, dt);
  if (lanternLight) lanternLight.intensity = fire * 1.6 * flick;
  if (porchLight) porchLight.intensity = fire * .9 * flick;
  if (lightPool) {
    lightPool.material.opacity = U.damp(lightPool.material.opacity, fire * (1 - S.rain * .2) * .55, 4, dt);
    lightPool.scale.setScalar(.8 + fire * .5);
  }
  // snow
  const snow = U.clamp01(S.snow * 1.25);
  if (snowGroup.userData.blanket) {
    snowGroup.userData.blanket.scale.y = Math.max(.01, snow * 1.2);
    snowGroup.userData.blanket.position.y = WALL_H + .13 + snow * .02;
    for (const s of snowGroup.userData.roofSnow) { s.visible = snow > .05; s.scale.set(1, .45 * (0.5 + snow), 1); }
  }
  // boat
  const boat = WG.cabin.boat;
  if (boat) {
    const wind = S.wind;
    const ice = U.clamp01(S.ice);
    boat.rock = Math.max(0, boat.rock - dt * 1.8);
    const free = 1 - ice;
    boat.age = (boat.age || 0) + dt;
    const bob = (Math.sin(t * 1.1 + boat.phase) * .012 + Math.sin(t * 2.3 + boat.phase) * .006) * wind * free;
    boat.group.position.y = S.waterY + bob + boat.rock * .02;
    const swing = Math.sin(t * .5 + boat.phase) * .07 * wind * free;
    boat.group.rotation.y = -.5 + swing + boat.rock * .1;
    boat.group.rotation.z = Math.sin(t * 1.7 + boat.phase) * .05 * wind * free * (1 + boat.rock * 2);
    boat.group.rotation.x = Math.sin(t * 1.3) * .03 * free;
    if (boat.rope) {
      const arr = boat.rope.geometry.attributes.position.array;
      const sag = .03 + Math.sin(t * 1.4 + boat.phase) * .01;
      arr[3] = boat.moor.x - .02; arr[4] = .12 - sag; arr[5] = boat.moor.z;
      boat.rope.geometry.attributes.position.needsUpdate = true;
    }
    // algae band
    const jg = WG.cabin.jetty;
    if (jg && jg.userData.bands) for (const b of jg.userData.bands) b.position.y = S.waterY;
  }
  // smoke intensity export
  WG.cabin.smokeOn = U.clamp01(.2 + (10 - S.temp) / 20 + S.storm * .4 - S.rain * .2);
}

function updateLights() {}

WG.register('cabin', {
  order: 26,
  init() {
    try {
      buildMats();
      const h = ground(CABIN.x, CABIN.z);
      buildCabin(h);
      buildJetty();
      buildLightPool();
      ready = true; WG.cabin.ready = true;
    } catch (e) { WG.warn('cabin:init', e); }
  },
  update(dt, t) {
    if (!ready || !WG.ready) return;
    try {
      applyState(dt, t);
      updateSmoke(dt, t);
    } catch (e) { WG.warn('cabin:update', e); }
  }
});

WG.on('splash', d => {
  try {
    if (!d || !d.pos || !WG.cabin.boat) return;
    const b = WG.cabin.boat.group.position;
    const dist = Math.hypot(d.pos.x - b.x, d.pos.z - b.z);
    if (dist < 1.1) WG.cabin.boat.rock = Math.min(1, (.09 || 0) + (1 - dist / 1.1) * .9);
  } catch (e) {}
});
WG.on('lightning', () => { try { if (WG.cabin.boat) WG.cabin.boat.rock = 1; } catch (e) {} });
})();