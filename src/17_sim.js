/* ===== 17_sim.js — climate, seasons, coupling, scenarios ===== */
(function () {
'use strict';
const WG = window.WG, U = WG.util, S = WG.state;
const seasonTemp = s => {
  const a = ((s % 4) + 4) % 4;
  const i = Math.floor(a), t = a - i;
  const tab = [16, 28, 14, -3, 16];
  return U.lerp(tab[i], tab[i + 1], U.easeInOut(t));
};
let windPhase = Math.random() * 10, fogH = 0, gaugeT = 18, gaugeH = 46, tick = 0;

function update(dt, t) {
  const sunUp = S.sunAlt > 0;
  const cover = U.clamp01(S.cloudCover);
  S.humidity = U.clamp01(S.humidity);
  // ---- temperature
  const base = seasonTemp(S.season);
  const diurnal = -Math.cos((S.time - 15) / 24 * Math.PI * 2) * 5.2 * (1 - cover * .55);
  const lapseCool = 0;
  let target = base + diurnal - S.storm * 2.6 - S.rain * .9 - S.snow * 1.4 + (sunUp ? .6 : -.6);
  if (S.fog > .3) target -= .6;
  S.temp = U.damp(S.temp, target, .09, dt);
  // ---- humidity
  let humT = .36 + S.snow * .1 + U.smoothstep(12, -3, S.temp) * .16;
  humT += S.rain * .16 + S.fog * .25 + S.storm * .18 + S.wet * .16;
  humT += S.wet * .1 + S.ice * .06;
  humT -= S.daylight * .07 + S.wind * .06;
  humT += U.smoothstep(20, 4, S.temp) * .05;
  S.humidity = U.damp(S.humidity, U.clamp01(humT), .25, dt);
  // ---- wetness
  const dryF = (S.sunVis * .9 + S.wind * .5 + Math.max(0, S.temp) / 30) * (1 - S.humidity * .6);
  S.wet = U.clamp01(S.wet + S.rain * dt * .075 * (S.snow > .5 ? .35 : 1) - dryF * dt * .02 - (S.temp < -1 ? dt * .004 : 0));
  // snow accumulate/melt
  if (S.snowfall > .02 && S.temp < 1) S.snow = U.clamp01(S.snow + S.snowfall * dt * .028);
  else {
    const melt = U.clamp01((S.temp - .4) / 12) * .012 + S.sunVis * .01 + S.wet * .004;
    S.snow = U.clamp01(S.snow - melt * dt);
  }
  if (S.snow > .02) S.wet = Math.max(S.wet, S.snow * .35);
  // ---- frost
  const frostT = S.temp < 2 && S.sunAlt < 4 && S.wet > .25;
  S.frost = U.clamp01(S.frost + (frostT ? dt * .02 : -dt * (S.sunAlt > 5 ? .03 : .006)));
  // ---- lake / river
  let lvlT = .1 + S.rain * .2 + Math.max(0, S.snow - .35) * .1 + (S.ice > .5 ? .012 : 0);
  S.waterY = U.damp(S.waterY, lvlT, .25, dt);
  let flowT = 1 + S.rain * .9 + Math.max(0, S.snow - .2) * .4 - S.ice * .5;
  S.flow = U.damp(S.flow, U.clamp(flowT, .55, 2.1), .5, dt);
  const freeze = S.temp < -.8 ? U.clamp01((-S.temp - .8) / 6) : -U.clamp01((S.temp + .3) / 6);
  S.ice = U.clamp01(S.ice + freeze * dt * .035);
  // ---- fog (auto formation)
  const fogBase = U.clamp01((S.humidity - .68) * 2.6) * (1 - S.sunVis * .55) * (1 - S.wind * .5);
  const dawnFog = U.smoothstep(4.2, 6, S.time) * U.smoothstep(9.4, 7.5, S.time) * (S.season < 1 ? .8 : .55);
  const afterRain = U.clamp01(S.rain * .8 + S.wet * .25) * U.smoothstep(12, 2, S.temp) * .5;
  fogH = U.damp(fogH, U.clamp01(fogBase * (.55 + dawnFog + afterRain) + afterRain * .2), .18, dt);
  S.fogExtra = Math.max(0, (S.fogExtra || 0) - (U.clamp01(S.sunVis * .9 + S.wind * .5) * .02 + .002) * dt);
  S.fog = U.clamp01(Math.max(fogH, S.fogExtra));
  // ---- mist
  const mistT = U.clamp01(S.humidity * .3 + S.fog * .6 + S.rain * .32 + S.snowfall * .24 + U.smoothstep(6, -6, S.temp) * .18 - S.sunVis * .34 - S.wind * .05);
  S.mist = U.damp(S.mist, U.clamp01(mistT), .3, dt);
  // ---- wind
  windPhase += dt * (.12 + S.storm * .6);
  const baseWind = [.3, .22, .48, .42][Math.floor(S.season + .5) % 4];
  const gust = (WG.noise2(t * .17, windPhase) - .35) * .55 + S.storm * (.35 + WG.noise2(t * .5, 8) * .6);
  S.wind = U.clamp(U.damp(S.wind, Math.max(.05, baseWind + gust + S.windSweep * .4), .7, dt), 0, 1.6);
  S.windSweep = Math.max(0, S.windSweep - dt * 1.1);
  S.windAngle += (WG.noise2(t * .05, 3.7) - .5) * dt * .25 + Math.sin(t * .11) * dt * .02;
  S.windVec.set(Math.cos(S.windAngle), 0, Math.sin(S.windAngle)).multiplyScalar(S.wind);
  // ---- fires
  const nightF = U.clamp01(S.night * 1.2 + S.dusk * .5);
  const smallHours = S.time > 23 || S.time < 4.5 ? .34 : 1;
  const fireT = U.clamp01(nightF * smallHours + S.storm * .55 + U.smoothstep(8, -2, S.temp) * .5 + (S.rain > .55 ? .25 : 0));
  S.fires = U.damp(S.fires, fireT, .6, dt);
  // ---- season visuals
  const aut = U.smoothstep(1.55, 2.15, S.season) * (1 - U.smoothstep(2.9, 3.3, S.season));
  S.leaves = U.clamp01(1 - U.smoothstep(2.0, 2.85, S.season) - U.smoothstep(3.15, 3.5, S.season) * .4 - U.smoothstep(.25, .05, S.season) * .15);
  if (S.season > 2.82 || S.season < .02) S.leaves = U.clamp01(.05 + U.smoothstep(.02, .18, S.season) * .8);
  S.blossom = U.clamp01(U.smoothstep(.02, .12, S.season) * U.smoothstep(.72, .5, S.season));
  S.grassH = U.lerp(.55, 1, U.smoothstep(.0, .4, S.season)) * (1 - U.smoothstep(2, 2.7, S.season) * .45) * (.9 - U.smoothstep(2.9, 3.4, S.season) * .5);
  const gc = WG.cols.grass.clone().lerp(WG.cols.grassAutumn, aut).lerp(WG.cols.grassWinter, U.smoothstep(2.85, 3.3, S.season));
  S.grassColor = gc;
  S.snowline = 0.1 + U.clamp01(-S.temp / 5) * 4 + S.snow * 2.2;
  // ---- storm flashes via air
  S.flashCool = Math.max(0, S.flashCool - dt);
  // ---- gauge
  const gt = S.temp, gh = S.humidity * 100;
  gaugeT = U.damp(gaugeT, gt, 1.7, dt); gaugeH = U.damp(gaugeH, gh, 1.4, dt);
  S.gaugeTemp = gaugeT + Math.sin(t * 2.3) * .12; S.gaugeHum = gaugeH + Math.sin(t * 1.9 + 1) * .5;
  S.gaugeTemp = U.clamp(S.gaugeTemp, -20, 40); S.gaugeHum = U.clamp(S.gaugeHum, 0, 100);
  // ---- terrain weather uniforms
  if (WG.terrain && WG.terrain.setWeather) try { WG.terrain.setWeather(S.wet, S.snow, S.frost, S.waterY); } catch (e) {}
  // ---- storm auto lightning
  if (S.storm > .6) {
    tick += dt;
    const every = 10 + Math.random() * 6;
    if (tick > every) {
      tick = 0;
      let best = null;
      for (const c of (WG.clouds.list || [])) if (!best || c.storm > (best.storm || 0)) best = c;
      if (best && WG.clouds.strike) WG.clouds.strike(best);
    }
  }
}

/* ---------- scenarios ---------- */
function reset() {
  if (WG.clouds && WG.clouds.clearAll) WG.clouds.clearAll();
  Object.assign(S, {
    temp: 18, humidity: .46, wet: .12, snow: 0, frost: 0, fog: 0, fogExtra: 0, mist: .14, ice: 0,
    waterY: .1, flow: 1, wind: .3, windSweep: 0, cloudCover: .12, storm: .0, rain: 0, snowfall: 0,
    fires: .1, snowline: 9, playing: false
  });
}
WG.scenarios = {};
const sc = WG.scenarios;
sc.calm = () => {
  reset(); S.season = 0; S.time = 15.24; S.temp = 18; S.humidity = .46; S.wet = .12; S.playing = false;
  const b = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    b.set(-2.6 + i * 2.45, 5.65 + (i % 2) * .3, 2.4 - (i % 2) * .6);
    const c = WG.clouds.spawn(b, .55 + i * .07); c.water = .1 + i * .02;
  }
};
sc.rain = () => {
  reset(); S.season = 1.02; S.time = 13.2; S.wet = .82; S.humidity = .92; S.waterY = .27; S.rain = .5; S.cloudCover = .8;
  S.temp = 21; S.fog = .12;
  for (let i = 0; i < 2; i++) {
    const c = WG.clouds.spawn(new THREE.Vector3(-1.2 + i * 3.4, 5.5 - i * .25, 1.6 - i * .9), 1.7 + i * .3);
    c.water = .85; c.state = 'wet'; c.rainRate = .85; c.squeeze = .15;
  }
};
sc.storm = () => {
  reset(); S.season = 1; S.time = 15.83; S.wet = 1; S.humidity = .98; S.waterY = .34; S.storm = 1; S.cloudCover = 1;
  S.rain = 1; S.wind = 1.05; S.fires = 1; S.temp = 22;
  const a = WG.clouds.spawn(new THREE.Vector3(-1.2, 5.1, .4), 1.5);
  a.water = 1; a.storm = 1; a.rainRate = 1.1;
  const b = WG.clouds.spawn(new THREE.Vector3(3.4, 5.4, -1.1), 1.0);
  b.water = .9; b.storm = .6; b.rainRate = .8;
};
sc.snow = () => {
  reset(); S.season = 3; S.time = 10.8; S.temp = -6; S.snow = .9; S.ice = .95; S.wet = .2; S.humidity = .82; S.waterY = .17; S.cloudCover = .55;
  S.snowfall = .8; S.wind = .3;
  for (let i = 0; i < 2; i++) {
    const c = WG.clouds.spawn(new THREE.Vector3(-1.9 + i * 3.9, 5.6, 1.5 - i * 1.5), 1.45);
    c.water = .7; c.state = 'wet'; c.rainRate = .6;
  }
};
sc.mountainsnow = () => {
  reset(); S.season = 2; S.time = 10.05; S.temp = 4; S.snow = .15; S.snowline = 1.4; S.humidity = .7; S.cloudCover = .6;
  for (let i = 0; i < 2; i++) {
    const c = WG.clouds.spawn(new THREE.Vector3(-2.6 + i * 3.1, 6.1, -2.4 + i * .6), 1.6);
    c.water = .75; c.state = 'wet'; c.rainRate = .5;
  }
  S.rain = .25; S.wet = .4;
};
sc.fog = () => {
  reset(); S.season = 2; S.time = 6.95; S.temp = 2; S.humidity = .98; S.fog = .9; S.fogExtra = .9; S.mist = .75; S.wet = .65; S.wind = .08; S.cloudCover = .4;
  S.waterY = .14;
};
sc.autumn = () => {
  reset(); S.season = 2; S.time = 13.92; S.temp = 13; S.wind = .9; S.cloudCover = .4; S.humidity = .58;
};
sc.night = () => {
  reset(); S.season = 1; S.time = 23.03; S.temp = 18; S.humidity = .5; S.wind = .12; S.cloudCover = .1; S.fires = 1;
};
sc.dusk = () => {
  reset(); S.season = 1; S.time = 17.63; S.temp = 23; S.humidity = .42; S.wind = .18;
};
WG.applyScenario = function (name) {
  const f = WG.scenarios[name] || WG.scenarios.calm;
  try { f(); } catch (e) { WG.warn('scenario', e); }
  predictGauge();
};
function predictGauge() { gaugeT = S.temp; gaugeH = S.humidity * 100; }

WG.register('sim', {
  order: 42,
  init() {
    predictGauge();
  },
  update(dt, t) { update(dt, t); }
});
})();