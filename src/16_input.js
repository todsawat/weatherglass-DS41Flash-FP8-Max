/* ===== 16_input.js — tools, picking, gestures ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const I = WG.input = { tool: 'hand', ready: false, pointer: { x: 0, y: 0, nx: 0, ny: 0, down: false } };
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane();
const hitP = new THREE.Vector3();

const canvas = document.getElementById('c');
const cursorEl = document.createElement('div');
cursorEl.className = 'wg-cursor'; cursorEl.style.display = 'none';
document.body.appendChild(cursorEl);

function setRay(e) {
  const r = canvas.getBoundingClientRect();
  const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
  I.pointer.x = e.clientX; I.pointer.y = e.clientY; I.pointer.nx = nx; I.pointer.ny = ny;
  ndc.set(nx * 2 - 1, -(ny * 2 - 1));
  ray.setFromCamera(ndc, WG.camera);
  return ray;
}
function firstHit(list, recursive) {
  if (!list || !list.length) return null;
  const hits = ray.intersectObjects(list.filter(Boolean), !!recursive);
  return hits.length ? hits[0] : null;
}
function groundPlaneAt(y) {
  plane.setFromNormalAndCoplanarPoint(WG.tmp.v1.set(0, 1, 0), WG.tmp.v2.set(0, y, 0));
  return ray.ray.intersectPlane(plane, hitP) ? hitP : null;
}
function treeList() {
  if (!WG.flora || !WG.flora.trees) return [];
  return WG.flora.trees.map(t => t.group);
}
function paneMeshes() { return (WG.glass && WG.glass.panes) ? WG.glass.panes.map(p => p.mesh) : []; }
function sunMoon() { return WG.sky ? [WG.sky.sunPick, WG.sky.moonPick] : []; }
function gaugePick() { return WG.case && WG.case.gauge && WG.case.gauge.picker ? [WG.case.gauge.picker] : (WG.case && WG.case.gaugePick ? [WG.case.gaugePick] : []); }

/* ---------- hover ---------- */
let hoverT = 0, hoverKind = null, hoverObj = null;
function updateHover() {
  if (I.pointer.down) return;
  const t = S.sceneTime;
  if (t - hoverT < .07) return;
  hoverT = t;
  let kind = null, obj = null, h;
  if (I.tool === 'hand') {
    h = firstHit(sunMoon());
    if (h) { kind = h.object === (WG.sky && WG.sky.sunPick) ? 'sun' : 'moon'; obj = h.object; }
    if (!kind) { h = firstHit(gaugePick()); if (h) kind = 'gauge'; }
    if (!kind) { h = firstHit(paneMeshes()); if (h) kind = 'glass'; }
    if (!kind && WG.clouds && WG.clouds.pickables) { h = firstHit(WG.clouds.pickables); if (h) { kind = 'cloud'; obj = h.object.userData.cloud; } }
    if (!kind) { h = firstHit(treeList(), true); if (h) { let o = h.object; while (o && !o.userData.tree) o = o.parent; if (o) { kind = 'tree'; obj = o.userData.tree; } } }
    if (!kind) { h = firstHit(WG.water && WG.water.surface ? [WG.water.surface] : []); if (h) { kind = 'water'; obj = h.point; } }
  }
  if (WG.clouds) WG.clouds.setHover(kind === 'cloud' ? obj : null);
  hoverKind = kind; hoverObj = obj;
  canvas.style.cursor = I.tool !== 'hand' ? (I.tool === 'wipe' ? 'none' : 'crosshair')
    : kind === 'cloud' || kind === 'tree' || kind === 'sun' || kind === 'moon' || kind === 'gauge' ? 'grab' : 'default';
  S.hoverSun = kind === 'sun'; S.hoverMoon = kind === 'moon';
  if (kind === 'sun' && !I.sunHinted) { I.sunHinted = true; WG.ui && WG.ui.hint('Drag the sun to change the time of day'); }
  if (kind === 'moon' && !I.moonHinted) { I.moonHinted = true; WG.ui && WG.ui.hint('Drag the moon to turn the night'); }
  if (kind === 'tree' && WG.flora) { WG.flora.hovered = obj; }
}

/* ---------- action state ---------- */
let mode = null, dragCloud = null, dragPlaneY = 0, lastX = 0, lastY = 0, downX = 0, downY = 0, moved = 0;
let dragTree = null, dragPane = null, dragSun = null, gaugeT = 0, lakeHeld = 0, lastLake = null;
let wipeLast = null, cloudTool = null, windLast = null;
const pointers = new Map();
let pinchDist = 0;

function startTool(e) {
  setRay(e);
  if (I.tool === 'hand') {
    let h = firstHit(sunMoon());
    if (h) {
      dragSun = { moon: h.object === (WG.sky && WG.sky.moonPick), lastX: e.clientX };
      if (WG.audio) WG.audio.event('grab', { size: .4 });
      if (WG.ui) WG.ui.progressTip('sun');
      return;
    }
    h = firstHit(gaugePick());
    if (h) {
      if (WG.case && WG.case.gauge) { WG.case.gauge.tap(); if (WG.ui) WG.ui.needleJump = true; }
      if (WG.audio) WG.audio.event('tink', { pane: 9 });
      return;
    }
    h = firstHit(paneMeshes());
    if (h) {
      const pane = WG.glass.panes.find(p => p.mesh === h.object);
      dragPane = { pane, uv: h.uv, tap: true };
      if (WG.glassfx) WG.glassfx.tap(pane.id, h.uv);
      emitTap(pane);
      return;
    }
    h = firstHit(WG.clouds.pickables);
    if (h) {
      dragCloud = h.object.userData.cloud;
      WG.clouds.hold(dragCloud);
      dragPlaneY = dragCloud.pos.y;
      if (groundPlaneAt(dragPlaneY)) { dragCloud.drag.copy(hitP); }
      if (WG.audio) WG.audio.event('grab', { size: dragCloud.size });
      if (WG.ui) WG.ui.progressTip('grab');
      WG.emit('grabcloud', dragCloud);
      return;
    }
    h = firstHit(treeList(), true);
    if (h) {
      let o = h.object; while (o && !o.userData.tree) o = o.parent;
      if (o) { dragTree = o.userData.tree; dragTree.pull = new THREE.Vector2(); mode = 'tree'; }
      return;
    }
    h = firstHit(WG.water && WG.water.surface ? [WG.water.surface] : []);
    if (h) {
      mode = 'water'; lakeHeld = 0; lastLake = h.point.clone();
      if (S.ice > .5) {
        if (WG.water.crack) WG.water.crack(h.point.x, h.point.z);
      } else {
        WG.water.splash(h.point.x, h.point.z, .45);
        if (WG.audio) WG.audio.event('splash', { pos: h.point, size: .6 });
      }
      if (WG.animals) WG.animals.scatter(h.point, 2);
      WG.emit('splash', { pos: h.point });
      return;
    }
    mode = 'orbit';
    return;
  }
  if (I.tool === 'wind') { mode = 'wind'; windLast = groundPlaneAt(1.4); return; }
  if (I.tool === 'fog') { mode = 'fog'; fogAt(e); return; }
  if (I.tool === 'wipe') {
    const h = firstHit(paneMeshes());
    if (h) { mode = 'wipe'; dragPane = { pane: WG.glass.panes.find(p => p.mesh === h.object), uv: h.uv }; wipeAt(h.uv); }
    return;
  }
  if (I.tool === 'cloud') {
    const p = groundPlaneAt(6.0);
    if (p) {
      const existing = WG.clouds.nearest(p, 1.4);
      if (existing) { cloudTool = existing; existing.water = Math.min(1, existing.water + .06); }
      else { cloudTool = WG.clouds.spawn(p.clone().setY(5.2 + Math.random() * .8), .5); if (WG.audio) WG.audio.event('pop'); }
      if (WG.ui) WG.ui.progressTip('grab');
      mode = 'cloud';
      cloudGrowT = 0;
    }
  }
}

function emitTap(pane) {
  WG.emit('tap', { pane: pane.id, uv: dragPane && dragPane.uv });
  if (WG.audio) WG.audio.event('tink', { pane: pane.id });
  if (WG.animals) WG.animals.flush();
  if (WG.cameraRig) WG.cameraRig.shake(.12);
  if (WG.ui && !I.paneHinted) { I.paneHinted = true; }
}

function wipeAt(uv) {
  if (!dragPane || !WG.glassfx) return;
  const pane = dragPane.pane;
  WG.glassfx.wipe(pane.id, uv, .11);
  if (wipeLast) {
    const n = Math.ceil(Math.hypot(uv.x - wipeLast.x, uv.y - wipeLast.y) / .04);
    for (let i = 1; i < n; i++) {
      const u = { x: U.lerp(wipeLast.x, uv.x, i / n), y: U.lerp(wipeLast.y, uv.y, i / n) };
      WG.glassfx.wipe(pane.id, u, .1);
    }
  }
  wipeLast = uv;
  if (WG.audio) WG.audio.event('squeak');
  if (WG.ui && !I.wiped) { I.wiped = true; WG.ui.progressTip('wipe'); WG.ui.hint('Wiped glass slowly mists back over'); }
}

let cloudGrowT = 0;
function fogAt(e) {
  const y = 1.1;
  const p = groundPlaneAt(y);
  if (p && WG.weather && WG.weather.fogPuff) {
    WG.weather.fogPuff(p.clone(), U.randRange(.6, 1.1));
    if (WG.audio) WG.audio.event('whoosh', { pos: p });
  }
}

function moveTool(e) {
  setRay(e);
  if (dragSun) {
    const dh = (e.clientX - dragSun.lastX) * .011;
    dragSun.lastX = e.clientX;
    if (dragSun.moon) WG.sky.dragMoon(dh); else WG.sky.dragSun(dh);
    return;
  }
  if (dragPane) {
    const h = firstHit([dragPane.pane.mesh]);
    if (h) {
      dragPane.uv = h.uv;
      if (mode === 'wipe') wipeAt(h.uv);
    }
    return;
  }
  if (dragCloud) {
    const p = groundPlaneAt(dragPlaneY);
    if (p) dragCloud.drag.copy(p);
    return;
  }
  if (dragTree) {
    const p = groundPlaneAt(dragTree.base.y + .4);
    if (p) {
      dragTree.pull.set((p.x - dragTree.base.x) * .9, (p.z - dragTree.base.z) * .9);
      dragTree.pull.clampLength(0, .28);
    }
    return;
  }
  if (mode === 'water') {
    const h = firstHit([WG.water.surface]);
    if (h) {
      const d = lastLake ? h.point.distanceTo(lastLake) : 0;
      if (d > .12) {
        if (WG.water.ring) WG.water.ring(h.point.x, h.point.z, .35);
        lastLake = h.point.clone();
      }
    }
    return;
  }
  if (mode === 'wind') {
    const p = groundPlaneAt(1.5);
    if (p && windLast) {
      const dx = p.x - windLast.x, dz = p.z - windLast.z;
      const speed = Math.hypot(dx, dz) / Math.max(.001, S.dtAvg);
      const power = U.clamp01(speed * .1);
      S.windSweep = Math.min(1.4, S.windSweep + power * .35);
      S.windAngle = Math.atan2(dz, dx);
      S.wind = Math.min(1.6, S.wind + power * .12);
      S.lastInput = S.sceneTime;
      windLast = p.clone();
      if (WG.weather && WG.weather.windWisp) WG.weather.windWisp(p, power);
      WG.emit('windsweep', { pos: p, power });
      if (power > .15 && WG.audio) WG.audio.event('windSweep', { pos: p, speed: power });
      if (WG.clouds) for (const c of WG.clouds.list) {
        const d = c.pos.distanceTo(p);
        if (d < 3.4) c.vel.addScaledVector(WG.tmp.v1.set(dx, 0, dz).normalize(), power * .9);
      }
      if (WG.ui) WG.ui.progressTip('wind');
    }
    return;
  }
  if (mode === 'fog') {
    if (Math.random() < .55) fogAt(e);
    return;
  }
  if (mode === 'cloud' && cloudTool) {
    cloudGrowT += S.dtAvg;
    const p = groundPlaneAt(cloudTool.pos.y);
    if (p) { cloudTool.drag.copy(p); cloudTool.pos.x = U.lerp(cloudTool.pos.x, p.x, .25); cloudTool.pos.z = U.lerp(cloudTool.pos.z, p.z, .25); }
    cloudTool.water = Math.min(1, cloudTool.water + S.dtAvg * .35);
    cloudTool.size = Math.min(2.6, cloudTool.size + S.dtAvg * .35);
    return;
  }
  if (mode === 'gaugeHold' || gaugeT > 0) { }
}

function move(e) {
  setRay(e);
  if (!I.pointer.down) { updateHover(); updateCursor(e); return; }
  moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
  if (mode === 'orbit') {
    WG.cameraRig.orbit(e.clientX - lastX, e.clientY - lastY);
  } else if (mode === 'pan') {
    WG.cameraRig.pan(e.clientX - lastX, e.clientY - lastY);
  } else {
    moveTool(e);
  }
  lastX = e.clientX; lastY = e.clientY;
}

function updateCursor(e) {
  if (I.tool === 'wipe') {
    const over = hoverKind === 'glass';
    cursorEl.style.display = 'block';
    cursorEl.style.left = e.clientX + 'px'; cursorEl.style.top = e.clientY + 'px';
    cursorEl.style.opacity = over ? '1' : '.55';
  } else cursorEl.style.display = 'none';
}

/* ---------- pointer wiring ---------- */
canvas.addEventListener('pointerdown', e => {
  WG.state.lastInput = WG.state.sceneTime;
  if (WG.audio) WG.audio.start();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    // pinch begins
    mode = 'pinch';
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    return;
  }
  I.pointer.down = true; downX = lastX = e.clientX; downY = lastY = e.clientY; moved = 0;
  if (e.button === 1) mode = 'pan';
  else if (e.button === 2) mode = 'orbit';
  else startTool(e);
  if (mode === 'orbit' || mode === 'pan') canvas.style.cursor = 'grabbing';
  if (dragCloud || dragTree) canvas.style.cursor = 'grabbing';
  if (WG.ui) WG.ui.hideControlsFocus && WG.ui.hideControlsFocus();
}, { passive: false });

canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  if (mode === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    WG.cameraRig.zoom((pinchDist - d) * .9);
    WG.cameraRig.orbit((a.x + b.x) / 2 - lastX, (a.y + b.y) / 2 - lastY);
    lastX = (a.x + b.x) / 2; lastY = (a.y + b.y) / 2; pinchDist = d;
    return;
  }
  move(e);
}, { passive: false });

function endPointer(e) {
  pointers.delete(e.pointerId);
  const wasMode = mode;
  if (dragCloud) {
    const c = dragCloud;
    WG.clouds.release(c, WG.tmp.v1.set(c.vel.x * .55, 0, c.vel.z * .55));
    if (WG.audio) WG.audio.event('release', { size: c.size, wet: c.water });
    if (moved > 26) WG.emit('cloudfling', c);
    dragCloud = null;
  }
  if (dragTree) { dragTree.pull = dragTree.pull || new THREE.Vector2(); if (moved < 10) { if (WG.flora && WG.flora.burst) WG.flora.burst(dragTree, S.season > .6 && S.season < 2.4 ? 'leaf' : (S.blossom > .3 ? 'petal' : (S.snow > .3 ? 'snow' : 'leaf'))); if (WG.audio) WG.audio.event('whoosh', { tree: 1 }); } dragTree = null; }
  if (dragSun) {
    if (Math.abs(dragSun && moved) < 6 && dragSun.moon) {}
    dragSun = null;
  }
  if (dragPane) { dragPane = null; wipeLast = null; }
  if (cloudTool) { if (WG.audio) WG.audio.event('pop'); cloudTool = null; }
  if (wasMode === 'wind' && windLast) { windLast = null; S.windSweep = Math.min(1.5, S.windSweep + .2); }
  I.pointer.down = false; mode = null;
  canvas.style.cursor = I.tool === 'hand' ? 'default' : (I.tool === 'wipe' ? 'none' : 'crosshair');
  if (pointers.size < 2) pinchDist = 0;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  WG.state.lastInput = WG.state.sceneTime;
  if (I.tool === 'hand') {
    setRay(e);
    const h = firstHit(WG.clouds.pickables);
    if (h) {
      const c = h.object.userData.cloud;
      WG.clouds.squeeze(c, Math.abs(e.deltaY) * .0018);
      if (WG.audio) WG.audio.event('squish', { size: c.size });
      return;
    }
  }
  WG.cameraRig.zoom(e.deltaY);
}, { passive: false });

canvas.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.target && /input|textarea/i.test(e.target.tagName)) return;
  const map = { h: 'hand', w: 'wind', c: 'cloud', f: 'fog', g: 'wipe', '1': 'hand', '2': 'wind', '3': 'cloud', '4': 'fog', '5': 'wipe' };
  if (map[k]) { I.setTool(map[k]); e.preventDefault(); }
});

I.setTool = function (id) {
  if (!['hand', 'wind', 'cloud', 'fog', 'wipe'].includes(id)) return;
  I.tool = id; S.tool = id;
  if (WG.ui) WG.ui.setTool(id);
  if (WG.audio) WG.audio.event('tick');
  canvas.style.cursor = id === 'hand' ? 'default' : (id === 'wipe' ? 'none' : 'crosshair');
  if (id !== 'wipe') cursorEl.style.display = 'none';
  if (WG.clouds) WG.clouds.setHover(null);
  hoverKind = null;
  WG.emit('tool', id);
};

/* test helpers (dev) */
I.testGrab = (i) => {
  const c = WG.clouds.list[i]; if (!c) return null;
  dragCloud = c; dragPlaneY = c.pos.y; c.drag.copy(c.pos);
  WG.clouds.hold(c); mode = 'cloud';
  return c.pos.toArray();
};
I.testMove = (dx, dz) => { if (dragCloud) { dragCloud.drag.x += dx; dragCloud.drag.z += dz; } };
I.testDrop = () => { if (dragCloud) { WG.clouds.release(dragCloud, WG.tmp.v1.set(dragCloud.vel.x * .55, 0, dragCloud.vel.z * .55)); dragCloud = null; } };

I.ready = true;
})();