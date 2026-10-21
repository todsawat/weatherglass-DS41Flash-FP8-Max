/* ===== 18_main.js — boot order, scenario, loop start ===== */
(function () {
'use strict';
const WG = window.WG, S = WG.state;

/* fallback hint store if UI is unavailable */
WG.hints = [];
if (!WG.ui) WG.hints = { hint(t) {} };

let booted = false;
function boot() {
  if (booted) return; booted = true;
  const scen = WG.scenarios[WG.scenario] ? WG.scenario : 'calm';
  WG.scenario = scen;
  // camera starts a touch wide, settles into the opening product shot
  WG.cameraRig.intro = 1;
  WG.cameraRig.az = WG.cameraRig.azT = THREE.MathUtils.degToRad(19);
  WG.cameraRig.el = WG.cameraRig.elT = THREE.MathUtils.degToRad(23.5);
  WG.cameraRig.dist = WG.cameraRig.distT = 22.5;

  WG.initAll(); WG.inited = true;
  // scenario after all systems exist; calm is the default state
  WG.applyScenario(scen);
  WG.cameraRig.azT = THREE.MathUtils.degToRad(22);
  WG.cameraRig.elT = THREE.MathUtils.degToRad(25);
  if (innerHeight < innerWidth * 1.15) WG.cameraRig.distT = Math.min(WG.cameraRig.distT, 21.6);
  WG.cameraRig.target.set(0, innerHeight > innerWidth * 1.15 ? 2.4 : .85, 0);
  WG.cameraRig.dist = 22.5;

  if (WG.ui && WG.ui.afterInit) WG.run('ui', () => WG.ui.afterInit());
  if (WG.weather && WG.weather.clearSky) setTimeout(() => WG.run('weather', () => WG.weather.clearSky()), 0);

  // UI is keyboard reachable from the canvas
  document.getElementById('c').focus({ preventScroll: true });

  if (WG.audio) addEventListener('pointerdown', () => WG.audio.start(), { once: true });

  // dev hooks
  window.__WG = WG;
  if (WG.debug) {
    let dbg = null;
    const show = () => {
      if (!dbg) {
        dbg = document.createElement('pre');
        dbg.style.cssText = 'position:fixed;left:18px;bottom:118px;z-index:60;color:#ffd98a;background:rgba(0,0,0,.55);padding:8px 10px;border-radius:8px;font:10px/1.4 monospace;pointer-events:none';
        document.body.appendChild(dbg);
      }
      dbg.textContent = `fps ${S.fps.toFixed(0)}  q${WG.quality.level} s${WG.quality.scale.toFixed(2)}  calls ${WG.renderer.info.render.calls}  tris ${WG.renderer.info.render.triangles}\nclouds ${WG.clouds.list.length} fail ${WG.failedModules.join(',')} warns ${(WG.warns || []).length}`;
      requestAnimationFrame(show);
    };
    show();
  }

  WG.start();
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
})();