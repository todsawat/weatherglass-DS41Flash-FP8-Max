/* ===== 14_audio.js — generated ambience, events and panning (WebAudio only) ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;

const A = WG.audio = {
  ready: false, muted: false, master: null, ctx: null,
  start() {}, setMuted() {}, event() {}, setStateSnapshot() {}
};

let ctx = null, master = null, comp = null, snap = null, started = false;
let windGain, windFilter, rainGain, rainFilter, snowGain, waterGain, waterPan, riverGain, riverPan;
let roomGain, birdGain;
let cricketGain, frogGain, cricketLfoGain;
let noiseBuf = null;
let birdTimer = 2.5, tickT = 0, dispatched = 0;
const panTmp = new THREE.Vector3();
const muteKey = 'wg.muted';

try { A.muted = localStorage.getItem(muteKey) === '1'; } catch (e) {}

/* ---------- helpers ---------- */
function makeNoise(seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = w * 0.7 + last * 1.8;
  }
  return buf;
}
function now() { return ctx ? ctx.currentTime : 0; }
function panNode(v) {
  if (!ctx.createStereoPanner) return null;
  const p = ctx.createStereoPanner();
  p.pan.value = U.clamp(v, -1, 1) * .85;
  return p;
}
function panFor(pos) {
  if (!pos || !WG.camera) return 0;
  try {
    panTmp.copy(pos).project(WG.camera);
    if (panTmp.z > 1) return 0;
    return U.clamp(panTmp.x, -1, 1);
  } catch (e) { return 0; }
}
function envGain(dur, peak) {
  const g = ctx.createGain();
  const t = now();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + Math.min(.03, dur * .2));
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  return g;
}
function noiseHit(dur, peak, filterType, freq, q, pan) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = envGain(dur, peak);
  const p = panNode(pan);
  src.connect(f); f.connect(g);
  if (p) { g.connect(p); p.connect(master); } else g.connect(master);
  src.start(now(), Math.random() * .4);
  src.stop(now() + dur + .05);
  src.onended = () => { try { f.disconnect(); g.disconnect(); p && p.disconnect(); } catch (e) {} };
  return { src, f, g };
}
function tone(type, f0, f1, dur, peak, pan, when) {
  const t = when || now();
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0), t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + Math.min(.02, dur * .15));
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  const p = panNode(pan);
  o.connect(g);
  if (p) { g.connect(p); p.connect(master); } else g.connect(master);
  o.start(t); o.stop(t + dur + .05);
  o.onended = () => { try { g.disconnect(); p && p.disconnect(); } catch (e) {} };
  return o;
}
function noiseGraphLoop(filterType, freq, q, gainVal, pan, freq2) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gainVal;
  const p = panNode(pan);
  src.connect(f); f.connect(g);
  if (p) { g.connect(p); p.connect(master); } else g.connect(master);
  src.start(now(), Math.random() * 1.5);
  return { src, f, g, p, freq2 };
}

/* ---------- graph ---------- */
function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = A.muted ? 0.0001 : .9;
  comp = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null;
  if (comp) {
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 5;
    comp.attack.value = .004; comp.release.value = .3;
    master.connect(comp); comp.connect(ctx.destination);
  } else master.connect(ctx.destination);
  A.master = master;
  noiseBuf = makeNoise(3.2);

  roomGain = ctx.createGain(); roomGain.gain.value = .018;
  const roomLp = ctx.createBiquadFilter(); roomLp.type = 'lowpass'; roomLp.frequency.value = 150;
  const roomSrc = ctx.createBufferSource(); roomSrc.buffer = noiseBuf; roomSrc.loop = true;
  roomSrc.connect(roomLp); roomLp.connect(roomGain); roomGain.connect(master);
  roomSrc.start(now(), 0);
  const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 53;
  const humG = ctx.createGain(); humG.gain.value = .007;
  hum.connect(humG); humG.connect(master); hum.start(now());
  A._hum = hum;

  const wind = noiseGraphLoop('bandpass', 520, 1.1, .0001, 0);
  windGain = wind.g; windFilter = wind.f;
  windFilter.frequency.setValueAtTime(430, now());

  const rain = noiseGraphLoop('highpass', 1500, .7, .0001, 0);
  rainGain = rain.g; rainFilter = rain.f;

  const snow = noiseGraphLoop('lowpass', 780, .8, .0001, 0);
  snowGain = snow.g;

  const water = noiseGraphLoop('bandpass', 1250, .9, .0001, -.45);
  waterGain = water.g; waterPan = water.p;

  const river = noiseGraphLoop('bandpass', 540, 1.8, .0001, .2);
  riverGain = river.g; riverPan = river.p;

  birdGain = ctx.createGain(); birdGain.gain.value = .18; birdGain.connect(master);

  const cricket = ctx.createOscillator(); cricket.type = 'sine'; cricket.frequency.value = 4300;
  cricketLfoGain = ctx.createGain(); cricketLfoGain.gain.value = .5;
  const cricketLfo = ctx.createOscillator(); cricketLfo.type = 'sine'; cricketLfo.frequency.value = 7.4;
  const cricketCar = ctx.createGain(); cricketCar.gain.value = .5;
  cricketGain = ctx.createGain(); cricketGain.gain.value = .0001;
  cricketLfo.connect(cricketLfoGain); cricketLfoGain.connect(cricketCar.gain);
  cricket.connect(cricketCar); cricketCar.connect(cricketGain); cricketGain.connect(master);
  cricket.start(now()); cricketLfo.start(now());
  const cricketPan = panNode(.35); cricketGain.disconnect(); cricketGain.connect(cricketPan); cricketPan.connect(master);

  const frog = ctx.createOscillator(); frog.type = 'square'; frog.frequency.value = 185;
  const frogLfo = ctx.createOscillator(); frogLfo.type = 'sine'; frogLfo.frequency.value = 2.3;
  const frogLfoG = ctx.createGain(); frogLfoG.gain.value = .4;
  const frogCar = ctx.createGain(); frogCar.gain.value = .5;
  const frogLp = ctx.createBiquadFilter(); frogLp.type = 'lowpass'; frogLp.frequency.value = 700;
  frogGain = ctx.createGain(); frogGain.gain.value = .0001;
  frogLfo.connect(frogLfoG); frogLfoG.connect(frogCar.gain);
  frog.connect(frogCar); frogCar.connect(frogLp); frogLp.connect(frogGain); frogGain.connect(master);
  frog.start(now()); frogLfo.start(now());
  const frogPan = panNode(-.3); frogGain.disconnect(); frogGain.connect(frogPan); frogPan.connect(master);

  A._nodes = { wind, rain, snow, water, river };
}

/* ---------- public start / mute ---------- */
A.start = function () {
  if (started) { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  started = true;
  try {
    build();
    ctx.resume().catch(() => {});
    A.ready = true;
  } catch (e) { WG.warn('audio:start', e); started = false; }
};
A.setMuted = function (m) {
  A.muted = !!m;
  try { localStorage.setItem(muteKey, m ? '1' : '0'); } catch (e) {}
  if (master) {
    const t = now();
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(m ? .0001 : .9, t, .05);
  }
  if (m) WG.emit('audio:mute', true);
};

/* ---------- events ---------- */
function fire(name, data) {
  if (!ctx) return;
  const d = data && typeof data === 'object' ? data : {};
  const pan = panFor(d.pos);
  const speed = typeof data === 'number' ? data : (d.speed || d.power || 1);
  try {
    switch (name) {
      case 'grab':
        noiseHit(.16, .06, 'bandpass', 420, .9, pan);
        tone('sine', 220, 150, .14, .035, pan);
        break;
      case 'release':
        noiseHit(.3, .045, 'bandpass', 900, .7, pan);
        tone('sine', 180, 90, .22, .025, pan);
        break;
      case 'squish':
        noiseHit(.14, .05, 'lowpass', 480, 1.2, pan);
        tone('sine', 150, 90, .18, .02, pan);
        break;
      case 'merge':
        tone('sine', 90, 48, .4, .12, pan);
        setTimeout(() => { if (ctx) tone('sine', 70, 40, .5, .09, pan); }, 110);
        break;
      case 'pop':
        tone('sine', 640, 900, .09, .05, pan);
        break;
      case 'crackle':
        for (let i = 0; i < 4; i++) setTimeout(() => { if (ctx) noiseHit(.03, .05, 'highpass', 2600, .8, pan); }, i * 38);
        break;
      case 'crack':
        noiseHit(.13, .22, 'highpass', 900, .7, pan);
        tone('square', 1400, 380, .1, .06, pan);
        break;
      case 'thunder': {
        const delay = typeof data === 'number' ? data : (d.delay || 0);
        setTimeout(() => {
          if (!ctx) return;
          const h = noiseHit(2.4, .2, 'lowpass', 210, .6, pan);
          try { h.f.frequency.exponentialRampToValueAtTime(70, now() + 2.2); } catch (e) {}
          tone('sine', 62, 34, 2.2, .1, pan);
        }, Math.max(0, delay * 1000));
        break;
      }
      case 'splash':
        tone('sine', 780, 190, .22, .07, pan);
        noiseHit(.34, .07, 'highpass', 1800, .8, pan);
        break;
      case 'drip':
        tone('sine', 1300, 700, .1, .03, pan);
        break;
      case 'tink': {
        const pane = d.pane !== undefined ? d.pane : 0;
        const base = pane === 9 ? 320 : [880, 1180, 990, 1320, 760][pane % 5] || 900;
        tone('sine', base, base * .995, .7, .04, pan);
        tone('sine', base * 1.5, base * 1.49, .55, .018, pan);
        break;
      }
      case 'squeak':
        tone('sine', 1700, 2300, .13, .025, pan);
        break;
      case 'windSweep':
        noiseHit(.3 + U.clamp01(speed) * .35, .05 + U.clamp01(speed) * .09, 'bandpass', 700 + speed * 500, .6, pan);
        break;
      case 'whoosh':
        noiseHit(.34, .07, 'bandpass', 650, .5, pan);
        break;
      case 'tick':
        noiseHit(.025, .03, 'highpass', 3200, .8, pan);
        break;
      case 'toggle':
        tone('sine', 520, 720, .07, .03, pan);
        break;
      case 'chime': {
        const n = typeof data === 'number' ? data : (d.n || 3);
        const roots = [523.25, 587.33, 659.25, 783.99];
        for (let i = 0; i < Math.min(4, n); i++) {
          setTimeout(() => {
            if (!ctx) return;
            const f = roots[i] * (d.low ? .5 : 1);
            tone('sine', f, f, .9, .045, 0);
            tone('sine', f * 2.01, f * 2.01, .7, .016, 0);
          }, i * 120);
        }
        break;
      }
    }
  } catch (e) { WG.warn('audio:event', e); }
}
A.event = function (name, a, b) {
  if (!ctx) { if (a || b) { /* pre-start: ignore */ } return; }
  if (typeof a === 'number' || typeof a === 'string') {
    fire(name, { delay: +a || 0, dist: +b || 0 });
  } else fire(name, a);
};
A.setStateSnapshot = function (s) { snap = s || null; };

/* ---------- ambience driver ---------- */
function tick() {
  if (!ctx) return;
  const st = snap || S;
  const t = now();
  const wind = U.clamp01(st.wind || 0);
  const rain = U.clamp01(st.rain || 0);
  const snow = U.clamp01(st.snowfall || 0);
  const storm = U.clamp01(st.storm || 0);
  const night = U.clamp01(st.night || 0);
  const day = U.clamp01(st.daylight || 0);
  const temp = st.temp || 0;
  const frozen = st.ice > .5 || temp < -1;

  const setG = (g, v) => { if (g) g.gain.setTargetAtTime(v, t, .25); };
  setG(windGain, .012 + wind * .17 * (1 + storm * .5));
  if (windFilter) windFilter.frequency.setTargetAtTime(360 + wind * 950 + storm * 500, t, .3);
  setG(rainGain, rain * .16 * (1 - U.clamp01(st.ice || 0) * .5));
  if (rainFilter) rainFilter.frequency.setTargetAtTime(1100 + rain * 1500, t, .3);
  setG(snowGain, snow * .018 * (1 - rain));
  setG(waterGain, frozen ? .0005 : (.016 + ((st.flow || 1) - 1) * .045) * U.clamp01(1 - (st.ice || 0) * .9));
  setG(riverGain, frozen ? .0003 : .008 + ((st.flow || 1) - 1) * .03);
  if (waterPan) waterPan.pan.setTargetAtTime(U.clamp(panFor(WG.tmp.v1.set(-1.4, 1.2, -1.2)) * .8, -.8, .8), t, .4);
  if (riverPan) riverPan.pan.setTargetAtTime(U.clamp(panFor(WG.tmp.v1.set(1.2, .4, 1.6)) * .7, -.8, .8), t, .4);

  // bird activity: day, mild, calm and not heavy rain
  const bird = U.clamp01(day * 1.2) * (1 - rain * .9) * (1 - storm) * U.smoothstep(2, 10, temp) * (1 - night);
  if (birdGain) birdGain.gain.setTargetAtTime(.05 + bird * .16, t, .5);
  birdTimer -= .18;
  if (birdTimer <= 0) {
    birdTimer = .9 + Math.random() * (3.4 - bird * 2.1);
    if (bird > .25 && ctx) {
      const chirps = 1 + Math.floor(Math.random() * 3);
      const pan = Math.random() * 1.6 - .8;
      const base = 1900 + Math.random() * 2100;
      for (let i = 0; i < chirps; i++) {
        setTimeout(() => {
          if (!ctx || !birdGain) return;
          const o = ctx.createOscillator(); o.type = 'sine';
          const tt = now();
          o.frequency.setValueAtTime(base * (.9 + Math.random() * .25), tt);
          o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * .5), tt + .055);
          o.frequency.exponentialRampToValueAtTime(base * .8, tt + .12);
          const g = ctx.createGain(); g.gain.setValueAtTime(.0001, tt);
          g.gain.exponentialRampToValueAtTime(.05, tt + .02);
          g.gain.exponentialRampToValueAtTime(.0001, tt + .14);
          const p = panNode(pan);
          o.connect(g); if (p) { g.connect(p); p.connect(birdGain); } else g.connect(birdGain);
          o.start(tt); o.stop(tt + .16);
        }, i * (90 + Math.random() * 80));
      }
    }
  }
  const warm = U.smoothstep(10, 22, temp);
  const summerNight = night * U.smoothstep(1, 2, st.season || 0) * (1 - U.smoothstep(2.3, 2.8, st.season || 0));
  setG(cricketGain, (summerNight * warm * .018) + (night * warm * .004) * (1 - storm));
  const springNight = night * (1 - U.smoothstep(.6, 1.2, st.season || 0));
  setG(frogGain, springNight * .007 * (1 - storm));
  setG(roomGain, .014 + night * .01);

  // occasional water drip at high humidity
  dispatched -= .18;
  if (dispatched <= 0) {
    dispatched = 2 + Math.random() * 5;
    if ((st.humidity || 0) > .8 && rain < .2) fire('drip', { pos: WG.tmp.v1.set(-4, 1.5, 2) });
  }
}
A._tick = tick;

addEventListener('pointerdown', () => A.start(), { once: false, passive: true });
addEventListener('keydown', () => A.start());
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

WG.register('audio', {
  order: 36,
  init() {
    try {
      setInterval(() => { if (A.ready) WG.run('audio:tick', tick); }, 180);
      A.ready = true;
    } catch (e) { WG.warn('audio', e); A.ready = true; }
  },
  update(dt) {
    if (!A.ready || !ctx) return;
    if (!snap) snap = S;
    // pan follows scene camera occasionally
    if (ctx.state === 'suspended' && !A.muted) { /* resumed by gesture */ }
  }
});
})();