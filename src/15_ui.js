/* ===== 15_ui.js — frosted interface, time & season dials, onboarding, a11y ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const ui = WG.ui = {
  ready: false, needleJump: false,
  setTool() {}, hint() {}, toast() {}, openDrawer() {}, hideUI() {}, onTip() {},
  progressTip() {}, setTime() {}, setSeason() {}, setTemp() {}, setPhrase() {},
  needle() {}, setPlaying() {}, focusRing() {}, hideControlsFocus() {},
  afterInit() {}
};
let uiAcc = 0;
WG.register('ui', {
  order: 38,
  init() {
    try { if (ui.updateNow) ui.updateNow(); } catch (e) { WG.warn('ui:init', e); }
    ui.ready = true;
  },
  update(dt) {
    if (!ui.ready || !ui.updateNow) return;
    uiAcc += dt;
    if (uiAcc < 1 / 15) return;
    uiAcc = 0;
    try { ui.updateNow(); } catch (e) { WG.warn('ui:update', e); }
  },
  dispose() { try { ui.dispose && ui.dispose(); } catch (e) {} }
});
const root = document.getElementById('ui');
if (!root) return;
try {
const $ = (tag, cls, html, attrs) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
const hhmm = h => {
  const v = ((h % 24) + 24) % 24;
  return String(Math.floor(v)).padStart(2, '0') + ':' + String(Math.floor((v % 1) * 60)).padStart(2, '0');
};
const safeLS = (k, v) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const setLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- icons ---------------- */
const ICON = {
  soundOn: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M4 9.3h3.4L12 5.4v13.2L7.4 14.7H4z"/><path d="M15.4 9a4.3 4.3 0 0 1 0 6"/><path d="M18 6.6a7.7 7.7 0 0 1 0 10.8"/></svg>',
  soundOff: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M4 9.3h3.4L12 5.4v13.2L7.4 14.7H4z"/><path d="M15.4 10.1 19.7 14.3M19.7 10.1l-4.3 4.2"/></svg>',
  full: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/></svg>',
  hide: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M2.8 12s3.4-5.3 9.2-5.3S21.2 12 21.2 12s-3.4 5.3-9.2 5.3S2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M4.2 19.8 19.8 4.2"/></svg>',
  eye: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M2.8 12s3.4-5.3 9.2-5.3S21.2 12 21.2 12s-3.4 5.3-9.2 5.3S2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  hand: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M8.6 11.3V6.6a1.4 1.4 0 0 1 2.8 0v3.8M11.4 10.2V5.4a1.4 1.4 0 0 1 2.8 0v4.8M14.2 10.6V7.2a1.3 1.3 0 0 1 2.6 0v4.9c0 3.1-2.2 5.7-5.3 5.7-2.2 0-3.6-.9-4.7-2.9l-2-3.3a1.4 1.4 0 0 1 2.3-1.6l2.6 2.7"/></svg>',
  wind: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M3 8.1h9.4a2.7 2.7 0 1 0-2.6-3.5"/><path d="M3 12.5h12.7a2.7 2.7 0 1 1-2.6 3.5"/><path d="M3 16.9h6.4"/></svg>',
  cloud: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M7 17.6a4 4 0 0 1 .5-8 5.2 5.2 0 0 1 10 1.3 3.4 3.4 0 0 1-.6 6.7"/><path d="M12 10.9v5M9.5 13.4h5"/></svg>',
  fog: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M3.4 8.2c1.9-1.6 3.4 1.6 5.3 0s3.4-1.6 5.3 0 3.4 1.6 5.2 0"/><path d="M3.4 12.6c1.9-1.6 3.4 1.6 5.3 0s3.4-1.6 5.3 0 3.4 1.6 5.2 0"/><path d="M3.4 17c1.9-1.6 3.4 1.6 5.3 0s3.4-1.6 5.3 0 3.4 1.6 5.2 0"/></svg>',
  wipe: '<svg class="wg-ic" viewBox="0 0 24 24"><rect x="4" y="4" width="12.6" height="16" rx="2"/><path d="M6.2 16.9 15.6 6.2"/><path d="M16.8 9.2c1.4 1.6 2.1 2.7 2.1 3.7a2.1 2.1 0 0 1-4.2 0c0-1 .7-2.1 2.1-3.7z"/></svg>',
  play: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M9 6.5 18 12 9 17.5z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg class="wg-ic" viewBox="0 0 24 24"><path d="M9 6.5v11M15 6.5v11" stroke-width="2.4"/></svg>',
  sun: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.1"/><path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4"/></svg>',
  moon: '<svg class="moon" viewBox="0 0 16 16"><path d="M10.7 2.4a5.8 5.8 0 1 0 0 11.2 6.5 6.5 0 0 1 0-11.2z"/></svg>',
  dial: '<svg class="wg-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="4.5" r="1.35" fill="currentColor" stroke="none"/><path d="M12 8.2v3.8l2.4 2"/></svg>',
  next: '<svg viewBox="0 0 12 12"><path d="M4 2.4 8.2 6 4 9.6"/></svg>',
  dismiss: '<svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6"/></svg>',
  tick: '<svg viewBox="0 0 16 16"><path d="M2.5 8.6 6.3 12.2 13.5 4.4"/></svg>',
  step: '<svg viewBox="0 0 16 16"><path d="M8 2.4v11.2M2.4 8h11.2"/></svg>'
};
const SYM = {
  spring: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="1.5"/><path d="M7 5.5c0-2.4-2.6-3-3.1-1.4-.4 1.3 1.3 1.9 3.1 1.4zM8.5 7c2.4 0 3-2.6 1.4-3.1C8.6 3.5 8 5.2 8.5 7zM7 8.5c0 2.4 2.6 3 3.1 1.4.4-1.3-1.3-1.9-3.1-1.4zM5.5 7c-2.4 0-3 2.6-1.4 3.1C5.4 10.5 6 8.8 5.5 7z"/></svg>',
  summer: '<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.5"/><path d="M7 1.4v1.6M7 11v1.6M1.4 7h1.6M11 7h1.6M3.1 3.1l1.1 1.1M9.8 9.8l1.1 1.1M10.9 3.1 9.8 4.2M4.2 9.8l-1.1 1.1"/></svg>',
  autumn: '<svg viewBox="0 0 14 14"><path d="M7 2.2 8.6 4h2.1l-.6 2 1.4 1.5-1.6 1.1.2 2.1-2.1-.5L7 11.8 5.9 10.2l-2.1.5.2-2.1-1.6-1.1L3.8 6l-.6-2h2.1z"/><path d="M7 6.5v5.4"/></svg>',
  winter: '<svg viewBox="0 0 14 14"><path d="M7 1.3v11.4M2.1 4.1l9.8 5.8M11.9 4.1 2.1 9.9"/><path d="M4.9 2.5 7 3.7l2.1-1.2M4.9 11.5 7 10.3l2.1 1.2"/></svg>'
};
const TOOLS = [
  { id: 'hand', key: '1', name: 'Hand', line: 'Grab & fling clouds · hold still to squeeze rain · shake for lightning · drag the sun', icon: ICON.hand },
  { id: 'wind', key: '2', name: 'Wind', line: 'Sweep across the land to blow', icon: ICON.wind },
  { id: 'cloud', key: '3', name: 'Cloud', line: 'Press in the sky to condense a cloud', icon: ICON.cloud },
  { id: 'fog', key: '4', name: 'Fog', line: 'Brush mist into the valley', icon: ICON.fog },
  { id: 'wipe', key: '5', name: 'Wipe', line: 'Wipe condensation off the glass', icon: ICON.wipe }
];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const GLOWS = ['rgba(233,150,178,.5)', 'rgba(143,187,108,.5)', 'rgba(222,139,66,.55)', 'rgba(156,196,224,.5)'];

/* ---------------- DOM ---------------- */
const title = $('div', 'wg-title', 'Weatherglass');
const build = $('div', 'wg-build', 'DeepSeek V4.1 Flash 1017 · FP8 weights · Max effort · 4× DGX Spark · run 2 · 7 h 30 min');
root.appendChild(build);
const actions = $('div', 'wg-actions wg-panel');
actions.setAttribute('role', 'group');
actions.setAttribute('aria-label', 'Display and sound');
let soundBtn, fullBtn, hideBtn, eyeBtn;
const actionLabels = {};

function actionBtn(cls, label, html, onClick) {
  const wrap = $('div', 'wg-action-wrap');
  const b = $('button', 'wg-btn wg-action ' + cls, html + '<span class="wg-ring"></span>', { type: 'button', 'aria-label': label });
  const lab = $('span', 'wg-label', label);
  const pulse = () => {
    b.classList.remove('pulse'); void b.offsetWidth;
    if (!reduced) b.classList.add('pulse');
    setTimeout(() => b.classList.remove('pulse'), 560);
  };
  b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); pulse(); onClick(b); });
  wrap.append(b, lab);
  actions.appendChild(wrap);
  actionLabels[label] = lab;
  b._label = lab;
  return b;
}

soundBtn = actionBtn('wg-sound', 'Sound on', ICON.soundOn, () => {
  if (WG.audio) { WG.audio.start(); WG.audio.setMuted(!WG.audio.muted); }
  const m = WG.audio ? WG.audio.muted : !muted;
  setMutedUI(m);
  if (WG.audio && WG.audio.event) WG.audio.event('toggle');
});
fullBtn = actionBtn('wg-full', 'Fullscreen', ICON.full, toggleFull);
hideBtn = actionBtn('wg-hide', 'Hide controls (U)', ICON.hide, () => hideUI(true));

const toolbar = $('div', 'wg-toolbar wg-panel');
toolbar.setAttribute('role', 'toolbar');
toolbar.setAttribute('aria-label', 'Tools');
const chip = $('div', 'wg-chip');
toolbar.appendChild(chip);
const toolBtns = {};
for (const t of TOOLS) {
  const b = $('button', 'wg-btn wg-tool', t.icon +
    '<span class="wg-tooltip" aria-hidden="true"><b>' + t.name + '</b><span class="key">' + t.key + '</span><p>' + t.line + '</p></span>',
    { type: 'button', 'aria-label': t.name + ' tool, key ' + t.key, 'data-tool': t.id, 'aria-pressed': 'false' });
  b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    if (isPhone && !seenTool[t.id]) { seenTool[t.id] = true; hint(t.line); }
    selectTool(t.id);
  });
  toolBtns[t.id] = b;
  toolbar.appendChild(b);
}

const timePanel = $('div', 'wg-time wg-panel');
timePanel.setAttribute('role', 'group');
timePanel.setAttribute('aria-label', 'Time of day');
const timeTop = $('div', 'wg-time-top');
const playBtn = $('button', 'wg-btn wg-play', ICON.play, { type: 'button', 'aria-label': 'Play time', 'aria-pressed': 'false' });
const clock = $('span', 'wg-clock', '15:14', { 'aria-hidden': 'true' });
timeTop.append(playBtn, clock);
const curve = $('div', 'wg-time-curve', '', { role: 'slider', tabindex: '0', 'aria-label': 'Time of day', 'aria-valuemin': '0', 'aria-valuemax': '24', 'aria-valuenow': '15.23', 'aria-valuetext': '15:14' });
curve.innerHTML = '<svg viewBox="0 0 164 44" preserveAspectRatio="none" aria-hidden="true"></svg>';
const sunmark = $('div', 'wg-sunmark', '<svg class="sun" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.6"/><path d="M8 1.3v1.9M8 12.8v1.9M1.3 8h1.9M12.8 8h1.9M3.3 3.3l1.3 1.3M11.4 11.4l1.3 1.3M12.7 3.3l-1.3 1.3M4.6 11.4l-1.3 1.3"/></svg><svg class="moon" viewBox="0 0 16 16"><path d="M11 2.6a5.7 5.7 0 1 0 0 10.8 6.5 6.5 0 0 1 0-10.8z"/></svg>');
curve.appendChild(sunmark);
timePanel.append(timeTop, curve);

const climate = $('div', 'wg-climate wg-panel');
climate.setAttribute('role', 'group');
climate.setAttribute('aria-label', 'Weather and season');
const tempEl = $('div', 'wg-temp', '18°');
const phraseEl = $('div', 'wg-phrase', 'sunny');
const leftCol = $('div', 'wg-left');
leftCol.append(tempEl, phraseEl);
const dial = $('div', 'wg-dial', '<div class="wg-dial-ticks" aria-hidden="true"></div><div class="wg-dial-centre"></div>', {
  role: 'slider', tabindex: '0', 'aria-label': 'Season', 'aria-valuemin': '0', 'aria-valuemax': '4',
  'aria-valuenow': '0', 'aria-valuetext': 'Spring'
});
const centre = dial.querySelector('.wg-dial-centre');
const knob = $('div', 'wg-knob', '');
const symEls = {};
for (const s of ['spring', 'summer', 'autumn', 'winter']) {
  const sym = $('div', 'wg-sym ' + s, SYM[s], { role: 'button', tabindex: '0', 'aria-label': SEASONS[['spring','summer','autumn','winter'].indexOf(s)] + ' season' });
  dial.appendChild(sym); symEls[s] = sym;
}
dial.append(knob);
climate.append(leftCol, dial);

const hints = $('div', 'wg-hints', '', { 'aria-live': 'polite', 'aria-atomic': 'false' });

const onboard = $('div', 'wg-onboard wg-panel', '', { role: 'status', 'aria-live': 'polite' });
const obIcon = $('div', 'wg-onboard-icon', ICON.step);
const obText = $('div', 'wg-onboard-text');
const dots = $('div', 'wg-dots');
const nextBtn = $('button', 'wg-onboard-btn wg-next', ICON.next, { type: 'button', 'aria-label': 'Next tip' });
const dismissBtn = $('button', 'wg-onboard-btn', ICON.dismiss, { type: 'button', 'aria-label': 'Dismiss tips' });
onboard.append(obIcon, obText, dots, nextBtn, dismissBtn);

const drawerBtn = $('button', 'wg-drawer-btn wg-btn wg-panel', ICON.dial, { type: 'button', 'aria-label': 'Open weather panel', 'aria-expanded': 'false' });
const drawer = $('div', 'wg-drawer wg-panel', '', { role: 'group', 'aria-label': 'Time and weather' });

const eye = $('button', 'wg-hidden-eye wg-btn', ICON.eye, { type: 'button', 'aria-label': 'Show controls' });

root.append(title, actions, toolbar, timePanel, climate, hints, onboard, drawerBtn, drawer, eye);

/* ---------------- tool flow ---------------- */
let currentTool = null;
const seenTool = {};
function selectTool(id) {
  if (WG.input && WG.input.setTool) WG.input.setTool(id);
  else { S.tool = id; ui.setTool(id); }
}
ui.setTool = function (id) {
  if (!toolBtns[id]) return;
  currentTool = id;
  for (const k in toolBtns) {
    toolBtns[k].classList.toggle('active', k === id);
    toolBtns[k].setAttribute('aria-pressed', k === id ? 'true' : 'false');
  }
  const obStep = TIPS && TIPS[obIdx];
  if (obActive && obStep && obStep.id === 'wind') obText.textContent = id === 'wind' ? (obStep.after || obStep.text) : obStep.text;
  requestAnimationFrame(() => {
    const b = toolBtns[id]; if (!b) return;
    chip.classList.remove('moving'); void chip.offsetWidth;
    if (!reduced) chip.classList.add('moving');
    moveChip(b);
  });
};
setTimeout(() => { if (!currentTool) ui.setTool((WG.input && WG.input.tool) || 'hand'); }, 30);
function moveChip(b) {
  const pad = parseFloat(getComputedStyle(toolbar).paddingLeft) || 7;
  chip.style.transform = 'translate(' + (b.offsetLeft - pad) + 'px,' + (b.offsetTop - pad) + 'px)';
}
addEventListener('resize', () => { if (currentTool) { const b = toolBtns[currentTool]; if (b) moveChip(b); } });

/* ---------------- hints ---------------- */
const activeHints = [];
function hint(text, dur) {
  if (!text) return;
  while (activeHints.length >= 3) removeHint(activeHints[0]);
  const pill = $('div', 'wg-hint', '', { role: 'status' });
  pill.textContent = text;
  let gone = false;
  const kill = () => { if (gone) return; gone = true; removeHint(pill); };
  pill.addEventListener('click', kill);
  pill.addEventListener('pointerdown', e => e.stopPropagation());
  hints.appendChild(pill);
  activeHints.push(pill);
  setTimeout(kill, dur || 5200);
}
function removeHint(pill) {
  const i = activeHints.indexOf(pill); if (i >= 0) activeHints.splice(i, 1);
  if (!pill.parentNode) return;
  pill.classList.add('out');
  setTimeout(() => pill.remove(), 380);
}
ui.hint = hint;
ui.toast = hint;

/* ---------------- drawer ---------------- */
let drawerOpen = false, isPhone = false;
const phoneQ = matchMedia('(max-width:720px),(pointer:coarse) and (max-width:960px)');
function openDrawer(v) {
  drawerOpen = v !== undefined ? !!v : !drawerOpen;
  drawer.classList.toggle('open', drawerOpen);
  drawerBtn.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
  if (drawerOpen) { focusRing(drawer); }
}
ui.openDrawer = () => openDrawer();
function layoutPanels() {
  isPhone = phoneQ.matches;
  if (isPhone) {
    if (timePanel.parentNode !== drawer) drawer.prepend(timePanel);
    if (climate.parentNode !== drawer) drawer.append(climate);
    if (!drawerOpen) drawer.classList.remove('open');
  } else {
    if (timePanel.parentNode !== root) root.insertBefore(timePanel, hints);
    if (climate.parentNode !== root) root.insertBefore(climate, hints);
    drawer.classList.remove('open'); drawerOpen = false;
    drawerBtn.setAttribute('aria-expanded', 'false');
  }
}
layoutPanels();
if (phoneQ.addEventListener) phoneQ.addEventListener('change', layoutPanels);
else phoneQ.addListener(layoutPanels);
drawerBtn.addEventListener('click', e => { e.stopPropagation(); openDrawer(); });
document.addEventListener('pointerdown', e => {
  if (!drawerOpen) return;
  if (drawer.contains(e.target) || drawerBtn.contains(e.target)) return;
  openDrawer(false);
}, true);

/* ---------------- time panel ---------------- */
let playing = false;
function setPlaying(v) {
  playing = !!v;
  S.playing = playing;
  playBtn.innerHTML = playing ? ICON.pause : ICON.play;
  playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  playBtn.setAttribute('aria-label', playing ? 'Pause time' : 'Play time');
  timePanel.classList.toggle('playing', playing);
}
ui.setPlaying = setPlaying;
playBtn.addEventListener('click', e => {
  e.stopPropagation();
  setPlaying(!playing);
  if (WG.audio && WG.audio.event) WG.audio.event('tick');
});
function setTime(h, silent) {
  const v = Math.max(0, Math.min(23.999, h));
  if (WG.time) WG.time.setTime(v, false); else S.time = v;
  if (!silent) ui.updateNow && ui.updateNow();
}
ui.setTime = setTime;
let draggingTime = false;
function timeFromEvent(e) {
  const r = curve.getBoundingClientRect();
  return U.clamp01((e.clientX - r.left) / Math.max(1, r.width)) * 24;
}
curve.addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation();
  draggingTime = true; curve.setPointerCapture && curve.setPointerCapture(e.pointerId);
  setTime(timeFromEvent(e));
  if (WG.audio) WG.audio.start();
});
curve.addEventListener('pointermove', e => { if (draggingTime) { e.preventDefault(); setTime(timeFromEvent(e)); } });
curve.addEventListener('pointerup', () => { draggingTime = false; });
curve.addEventListener('pointercancel', () => { draggingTime = false; });
curve.addEventListener('wheel', e => {
  e.preventDefault(); e.stopPropagation();
  if (WG.time) WG.time.addHours(-e.deltaY * 0.004);
}, { passive: false });
curve.addEventListener('keydown', e => {
  let d = 0;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -.25;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = .25;
  else if (e.key === 'PageDown') d = -1;
  else if (e.key === 'PageUp') d = 1;
  else if (e.key === 'Home') { setTime(0); e.preventDefault(); return; }
  else if (e.key === 'End') { setTime(23.95); e.preventDefault(); return; }
  if (d) { if (WG.time) WG.time.addHours(d); e.preventDefault(); e.stopPropagation(); }
});

function curveSvg() {
  const season = Math.round(((S.season % 4) + 4) % 4);
  const maxAlt = [47.5, 63, 45, 32][season];
  const yFor = alt => alt >= 0 ? 26 - (alt / maxAlt) * 21 : Math.min(42, 26 + (-alt / 22) * 13);
  const svg = curve.querySelector('svg');
  let gold = '', blue = '';
  const N = 44;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const h = 6 + (i / N) * 12;
    const alt = maxAlt * Math.sin(Math.PI * (h - 6) / 12);
    pts.push([(h / 24) * 164, yFor(alt)]);
  }
  gold = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  const fill = gold + ' L164 26 L' + ((6 / 24) * 164).toFixed(1) + ' 26 Z';
  for (const [a, b] of [[0, 6], [18, 24]]) {
    const bp = [];
    for (let i = 0; i <= 14; i++) {
      const h = a + (i / 14) * (b - a);
      const alt = h <= 6 || h >= 18 ? -22 * Math.sin(Math.PI * ((h < 6 ? h + 24 : h) - 18) / 12) : 0;
      bp.push(((h / 24) * 164).toFixed(1) + ' ' + yFor(alt).toFixed(1));
    }
    blue += (blue ? ' ' : '') + 'M' + bp.join(' L');
  }
  svg.innerHTML =
    '<path class="wg-curve-gold" d="' + fill + '"/>' +
    '<path class="wg-curve-gold" d="' + gold + '" fill="none"/>' +
    '<path class="wg-curve-blue" d="' + blue + '"/>' +
    '<line class="wg-horizon" x1="0" y1="26" x2="164" y2="26"/>' +
    [6, 12, 18].map(h => '<line class="wg-tick" x1="' + (h / 24 * 164) + '" y1="23" x2="' + (h / 24 * 164) + '" y2="29"/>' +
      '<text class="wg-tick-label" x="' + (h / 24 * 164) + '" y="40" text-anchor="middle">' + String(h).padStart(2, '0') + '</text>').join('');
  curve._maxAlt = maxAlt;
}
curveSvg();
function markerPos() {
  const maxAlt = curve._maxAlt || 47.5;
  const alt = S.sunAlt !== undefined ? S.sunAlt : 30;
  const y = alt >= 0 ? 26 - (alt / maxAlt) * 21 : Math.min(42, 26 + (-alt / 22) * 13);
  sunmark.style.left = U.clamp01(S.time / 24) * 100 + '%';
  sunmark.style.top = (y / 44) * 100 + '%';
  sunmark.classList.toggle('night', alt < 0);
}
let lastClock = '', lastSeasonIdx = -1;

/* ---------------- season dial ---------------- */
function setSeason(v, silent) {
  const val = ((v % 4) + 4) % 4;
  if (WG.season) WG.season.set(val, true); else S.season = val;
  if (!silent) updateSeasonUI(val, false);
}
ui.setSeason = setSeason;
function seasonFromEvent(e) {
  const r = dial.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += Math.PI * 2;
  return (a / (Math.PI * 2)) * 4;
}
function applySeasonDrag(e) {
  const target = seasonFromEvent(e);
  let d = target - S.season;
  while (d > 2) d -= 4;
  while (d < -2) d += 4;
  if (Math.abs(d) > .006) {
    if (WG.season) WG.season.nudge(d); else S.season = ((S.season + d) % 4 + 4) % 4;
    progressTip('season');
  }
}
let draggingDial = false;
dial.addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation();
  draggingDial = true; dial.setPointerCapture && dial.setPointerCapture(e.pointerId);
  applySeasonDrag(e);
  if (WG.audio) WG.audio.start();
});
dial.addEventListener('pointermove', e => { if (draggingDial) { e.preventDefault(); applySeasonDrag(e); } });
dial.addEventListener('pointerup', () => { draggingDial = false; });
dial.addEventListener('pointercancel', () => { draggingDial = false; });
dial.addEventListener('wheel', e => {
  e.preventDefault(); e.stopPropagation();
  if (WG.season) WG.season.nudge(U.sign(e.deltaY) * .08);
  progressTip('season');
}, { passive: false });
dial.addEventListener('keydown', e => {
  let d = 0;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -.05;
  else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = .05;
  else if (e.key === 'PageDown') d = -.5;
  else if (e.key === 'PageUp') d = .5;
  else if (e.key === 'Home') { setSeason(0); progressTip('season'); e.preventDefault(); return; }
  else if (e.key === 'End') { setSeason(3); progressTip('season'); e.preventDefault(); return; }
  if (d) { if (WG.season) WG.season.nudge(d); progressTip('season'); e.preventDefault(); e.stopPropagation(); }
});
centre.addEventListener('pointerdown', e => e.stopPropagation());
for (const s of ['spring', 'summer', 'autumn', 'winter']) symEls[s].addEventListener('pointerdown', e => e.stopPropagation());
centre.addEventListener('click', e => {
  e.stopPropagation();
  setSeason(Math.floor(S.season + 1) % 4);
  progressTip('season');
  if (WG.audio && WG.audio.event) WG.audio.event('tick');
});
for (const s of ['spring', 'summer', 'autumn', 'winter']) {
  const pick = e => {
    e.stopPropagation();
    setSeason(['spring', 'summer', 'autumn', 'winter'].indexOf(s));
    progressTip('season');
    if (WG.audio && WG.audio.event) WG.audio.event('chime', { n: 2 });
  };
  symEls[s].addEventListener('click', pick);
  symEls[s].addEventListener('pointerdown', e => e.stopPropagation());
  symEls[s].addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); }
  });
}
function updateSeasonUI(season, silent) {
  const s = ((season % 4) + 4) % 4;
  const idx = Math.floor(s + .5) % 4;
  dial.style.setProperty('--glow', GLOWS[idx]);
  dial.querySelector('.wg-dial-centre').textContent = SEASONS[idx];
  knob.style.transform = 'translate(-50%,-50%) rotate(' + (s * 90) + 'deg) translateY(-38px)';
  dial.setAttribute('aria-valuenow', s.toFixed(2));
  dial.setAttribute('aria-valuetext', SEASONS[idx]);
  for (let i = 0; i < 4; i++) symEls[['spring', 'summer', 'autumn', 'winter'][i]].classList.toggle('near', i === idx);
  if (idx !== lastSeasonIdx) {
    lastSeasonIdx = idx;
    curveSvg();
  }
}

/* ---------------- temps & phrases ---------------- */
function setTemp(v) {
  let n = Math.round(v);
  tempEl.textContent = (n < 0 ? '−' + Math.abs(n) : String(n)) + '°';
}
ui.setTemp = setTemp;
function setPhrase(p) { phraseEl.textContent = p || ''; }
ui.setPhrase = setPhrase;
function phraseFor() {
  if (S.storm > .45) return 'stormy';
  if (S.snowfall > .45 && S.temp < 2) return 'heavy snow';
  if (S.snowfall > .08 && S.temp < 2) return 'snowing';
  if (S.snowfall > .02 && S.temp < 2) return 'flurries';
  if (S.rain > .55) return 'pouring';
  if (S.rain > .04) return 'raining';
  if (S.fog > .55) return 'foggy';
  if (S.wind > .95) return 'blustery';
  if (S.night > .55) return 'clear night';
  if (S.golden > .4) return 'golden hour';
  if (S.cloudCover > .62) return 'overcast';
  if (S.cloudCover > .3) return 'cloudy';
  if (S.daylight < .25) return 'dusk';
  if (S.snow > .35) return 'snowbound';
  return 'sunny';
}

/* ---------------- a11y ---------------- */
function focusRing(el) {
  if (!el) return;
  el.classList.add('wg-focus');
  setTimeout(() => el.classList.remove('wg-focus'), 1400);
}
ui.focusRing = focusRing;
ui.hideControlsFocus = function () {
  const a = document.activeElement;
  if (a && root.contains(a) && a !== document.body) {
    a.blur();
    const c = document.getElementById('c'); if (c) c.focus({ preventScroll: true });
  }
};

/* ---------------- hidden mode ---------------- */
let hidden = false;
function hideUI(v) {
  const want = v !== undefined ? !!v : !hidden;
  if (want === hidden) return;
  hidden = want;
  root.classList.toggle('hidden', hidden);
  for (const el of [actions, toolbar, timePanel, climate, hints, onboard, drawerBtn, drawer, title]) {
    try { el.inert = hidden; } catch (e) {}
  }
  if (hidden) { eye.focus({ preventScroll: true }); WG.emit('ui:hide', true); }
  else { hideBtn.focus({ preventScroll: true }); focusRing(toolbar); }
  S.hidden = hidden;
}
ui.hideUI = hideUI;
eye.addEventListener('click', e => { e.stopPropagation(); hideUI(false); });
hideBtn.addEventListener('click', e => { e.stopPropagation(); hideUI(true); });

/* ---------------- sound / fullscreen ---------------- */
let muted = false;
function setMutedUI(m) {
  muted = !!m;
  soundBtn.innerHTML = (muted ? ICON.soundOff : ICON.soundOn) + '<span class="wg-ring"></span>';
  soundBtn.classList.toggle('on', !muted);
  soundBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
  soundBtn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
  if (soundBtn._label) soundBtn._label.textContent = muted ? 'Sound off' : 'Sound on';
}
let full = false;
function toggleFull() {
  try {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
    } else document.exitFullscreen && document.exitFullscreen().catch(() => {});
  } catch (e) {}
}
document.addEventListener('fullscreenchange', () => {
  full = !!document.fullscreenElement;
  fullBtn.classList.toggle('on', full);
  fullBtn.setAttribute('aria-pressed', full ? 'true' : 'false');
});

/* ---------------- onboarding ---------------- */
const TIPS = [
  { id: 'grab', text: 'Grab a cloud and drag it across the sky', icon: ICON.cloud },
  { id: 'squeeze', text: 'Hold still on a cloud to squeeze out rain', icon: ICON.hand },
  { id: 'shake', text: 'Shake a cloud hard to build a storm', icon: ICON.wind },
  { id: 'wind', text: 'Pick the Wind tool and sweep across the meadow', icon: ICON.wind, after: 'Now sweep across the meadow', target: 'wind' },
  { id: 'sun', text: 'Drag the sun to change the time of day', icon: ICON.sun },
  { id: 'season', text: 'Turn the season dial', icon: ICON.dial, target: 'dial' },
  { id: 'hide', text: 'That’s the whole glass — press U to hide the controls', icon: ICON.eye, final: true }
];
const tipsDone = new Set();
try { JSON.parse(safeLS('wg.tips') || '[]').forEach(x => tipsDone.add(x)); } catch (e) {}
let obIdx = -1, obTimer = 0, obActive = false, heldCloud = null, obPending = false;

function persistTips() { setLS('wg.tips', JSON.stringify([...tipsDone])); }
function markDone(id) {
  if (tipsDone.has(id)) return false;
  tipsDone.add(id); persistTips();
  const step = TIPS[obIdx];
  if (step && step.id === id && step.target === 'wind') toolBtns.wind.classList.remove('wg-pulse');
  if (step && step.id === id && step.target === 'dial') dial.classList.remove('wg-pulse');
  return true;
}
function showTip() {
  const t = TIPS[obIdx];
  if (!t) return finishOnboard(true);
  if (tipsDone.has(t.id)) { advanceTip(1); return; }
  obActive = true;
  obPending = false;
  clearTimeout(obTimer);
  root.classList.add('onboarding');
  onboard.classList.add('show');
  onboard.classList.remove('done');
  obIcon.innerHTML = t.icon;
  obText.textContent = t.text;
  dots.innerHTML = TIPS.map((_, i) => '<span class="wg-dot' + (i === obIdx ? ' on' : '') + '"></span>').join('');
  clearTimeout(obTimer);
  if (t.target === 'wind') toolBtns.wind.classList.add('wg-pulse');
  if (t.target === 'dial') dial.classList.add('wg-pulse');
}
function advanceTip(dir) {
  if (obIdx < 0) return;
  const cur = TIPS[obIdx];
  if (cur && cur.target === 'wind') toolBtns.wind.classList.remove('wg-pulse');
  if (cur && cur.target === 'dial') dial.classList.remove('wg-pulse');
  obIdx += dir;
  if (obIdx >= TIPS.length) return finishOnboard(true);
  if (obIdx < 0) obIdx = 0;
  showTip();
}
function finishOnboard(persist) {
  obActive = false;
  obPending = false;
  clearTimeout(obTimer);
  onboard.classList.remove('show');
  root.classList.remove('onboarding');
  toolBtns.wind.classList.remove('wg-pulse');
  dial.classList.remove('wg-pulse');
  if (persist) setLS('wg.onboarded', '1');
}
nextBtn.addEventListener('click', e => { e.stopPropagation(); advanceTip(1); });
dismissBtn.addEventListener('click', e => { e.stopPropagation(); finishOnboard(true); });
function startOnboard() {
  if (safeLS('wg.onboarded') === '1') return;
  let first = TIPS.findIndex(t => !tipsDone.has(t.id));
  if (first < 0) return finishOnboard(true);
  obIdx = first;
  showTip();
}
function scheduleObAdvance() {
  if (obPending) return;
  obPending = true;
  onboard.classList.add('done');
  obIcon.innerHTML = ICON.tick;
  clearTimeout(obTimer);
  const final = TIPS[obIdx] && TIPS[obIdx].id === 'hide';
  obTimer = setTimeout(() => {
    try {
      if (final) finishOnboard(true);
      else { obPending = false; advanceTip(1); }
    } catch (e) { WG.warn('ui:onboard', e); }
  }, final ? 1100 : 700);
  if (WG.audio && WG.audio.event) WG.audio.event('chime', { n: 2 });
}
function progressTip(id) {
  if (!TIPS.some(t => t.id === id)) return;
  const step = TIPS[obIdx];
  const wasCurrent = obActive && step && step.id === id;
  if (!markDone(id)) {
    if (wasCurrent) scheduleObAdvance();
    return;
  }
  if (wasCurrent) scheduleObAdvance();
}
ui.progressTip = progressTip;
ui._ob = () => ({ idx: obIdx, pending: obPending, active: obActive, timer: obTimer, len: TIPS.length });
ui.onTip = function (name) {
  const map = { grabcloud: 'grab', cloudhold: 'squeeze', cloudcharge: 'shake', lightning: 'shake', windsweep: 'wind', sundrag: 'sun', seasonchange: 'season', 'ui:hide': 'hide' };
  progressTip(map[name] || name);
};

/* ---------------- event wiring ---------------- */
const offs = [];
const on = (evt, fn) => offs.push(WG.on(evt, fn));
on('grabcloud', c => { heldCloud = c; progressTip('grab'); });
on('cloudhold', c => { heldCloud = c; progressTip('grab'); });
on('cloudrelease', () => { heldCloud = null; });
on('cloudfling', () => progressTip('grab'));
on('cloudcharge', () => progressTip('shake'));
on('cloudmerge', () => { if (WG.audio && WG.audio.event) WG.audio.event('merge', {}); });
on('lightning', () => progressTip('shake'));
on('windsweep', () => progressTip('wind'));
on('sundrag', () => progressTip('sun'));
on('seasonchange', () => { progressTip('season'); if (WG.audio && WG.audio.event) WG.audio.event('tick'); });
on('time', () => { /* clock updates on tick */ });
on('ui:hide', () => progressTip('hide'));

/* ---------------- keyboard ---------------- */
addEventListener('keydown', e => {
  const t = e.target;
  if (t && /input|textarea/i.test(t.tagName)) return;
  if (e.key === 'u' || e.key === 'U') {
    if (!e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); hideUI(); }
  }
  if (e.key === 'Escape') {
    if (drawerOpen) { openDrawer(false); e.preventDefault(); }
    else if (hidden) { hideUI(false); e.preventDefault(); }
  }
}, true);

/* ---------------- update ---------------- */
let acc = 0;
function refresh() {
  const t = S.time || 0;
  const clockTxt = hhmm(t);
  if (clockTxt !== lastClock) { clock.textContent = clockTxt; lastClock = clockTxt; }
  curve.setAttribute('aria-valuenow', t.toFixed(2));
  curve.setAttribute('aria-valuetext', clockTxt);
  markerPos();
  if (playing !== !!S.playing) setPlaying(!!S.playing);
  const season = S.season || 0;
  updateSeasonUI(season, true);
  if (S.grassColor) {
    const c = S.grassColor;
    centre.style.color = '#f4efe6';
  }
  setTemp(S.temp || 0);
  setPhrase(phraseFor());
  ui.needle(S.temp || 0, (S.humidity || 0) * 100);
  if (heldCloud && S.rain > .035) progressTip('squeeze');
  if (obActive && !obPending && TIPS[obIdx] && tipsDone.has(TIPS[obIdx].id) && TIPS[obIdx].id !== 'hide') scheduleObAdvance();
  if (obActive && !obPending && TIPS[obIdx] && TIPS[obIdx].id === 'hide' && tipsDone.has('hide')) scheduleObAdvance();
}
ui.updateNow = refresh;
ui.needle = function (t, h) {
  if (WG.case && WG.case.gauge && WG.case.gauge.needles) {
    try { WG.case.gauge.needles(t, h); } catch (e) {}
  }
  ui.needleJump = false;
};
ui.afterInit = function () {
  try {
    setPlaying(!!S.playing);
    refresh();
    curveSvg();
    setMutedUI(!!(WG.audio && WG.audio.muted));
    if (!reduced) setTimeout(startOnboard, 3800);
    setTimeout(() => hint(isPhone ? 'One finger to play, two to orbit and zoom' : 'Press 1–5 to change tools · U hides the controls', 6000), 9000);
  } catch (e) { WG.warn('ui:afterInit', e); }
};

/* ---------------- build actions ---------------- */
setMutedUI(!!(WG.audio && WG.audio.muted));

/* ---------------- dispose ---------------- */
function dispose() {
  for (const off of offs) { try { off(); } catch (e) {} }
  root.innerHTML = '';
}
ui.dispose = dispose;
ui.ready = true;
} catch (e) { WG.warn('ui', e); }
})();