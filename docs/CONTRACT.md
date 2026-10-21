# WEATHERGLASS — BUILD CONTRACT (read fully before writing code)

Repo root: `/Users/todsawat/Downloads/Test2/weatherglass`.
Deliverable: `/Users/todsawat/Downloads/Test2/weatherglass.html` (single self-contained HTML, built).
Read `docs/BRIEF.md` for the complete visual/behavioural spec. This contract defines the architecture, APIs and rules. **Follow it exactly; do not redefine shared APIs.**

## 0. Hard rules

1. Write **only** the files assigned to you (task write scope). Never edit `lib/`, `template.html`, `build.mjs`, other modules, or the built HTML.
2. Plain browser JS, no ES modules, no imports, no external URLs. THREE r160 is global (`THREE.*`). Everything else (textures, geometry, audio) is generated in code.
3. One script file per module. Register at the bottom:
   `WG.register('flora', { order: 50, init(){...}, update(dt,t){...}, dispose(){...} });`
   Never call another module's `init` yourself. Guard updates with `if (!x.ready) return;`.
4. **Fail soft.** Wrap your `init` body in try/catch, log via `WG.warn`, and set `ready`. Wrap risky per-frame work too. A missing feature is better than a dead scene.
5. Deterministic: random from `const R = WG.rng('flora');` (fresh stream per instance is fine). Same scene every load. No `Math.random()` except in audio noise buffers where it doesn't matter.
6. Performance: obey `WG.quality` (`grass`, `trees`, `flowers`, `particles`, `stars`, `animals`, `cloudSegments`, `shadowMap`, `reflections`, `tiltShift`, `blur`). Cache geometry/materials; share where sensible; use InstancedMesh for repeats. Target 60fps desktop, 30fps phone. **No per-frame allocations** in hot loops (reuse Vector3/temp objects).
7. Materials: `MeshStandardMaterial`/`MeshPhysicalMaterial` by default so they receive lights/shadows. `envMap = WG.env.tex`, `envMapIntensity` tuned by darkness (`WG.state.daylight`).
8. Quality look is the point: macro-photographed miniature, warm dim studio. Study the reference colours in brief §2 and use them.
9. Add no text in the 3D scene except the plaque and gauge.
10. Commit nothing, no dev servers. Build with `node build.mjs` and screenshot with `node tools/shot.mjs`.
11. Report to Lead with: files, what works, known gaps, screenshots. Keep task board updated.

## 1. Namespace and boot

`WG` is created by `src/00_boot.js` before your file loads. Available:

```js
WG.util = { clamp, lerp, smoothstep, damp, ease, TAU, randRange, pick, sign, approach }
WG.rng(seed) -> () => 0..1           // mulberry32
WG.noise2(x,y), WG.noise3(x,y,z), WG.fbm2(x,y,oct)   // value noise, deterministic
WG.warn(scope, err)
WG.register(name, {order, init, update, dispose})
WG.on(evt, fn) -> off ; WG.emit(evt, payload)
WG.quality = { level:0|1|2, grass, trees, bushes, flowers, particles, stars, animals,
               cloudLobes, cloudSegs, shadowMap, reflections, tiltShift, blur, maxDpr }
WG.state (see §3) ; WG.groups (see below) ; WG.scene ; WG.camera ; WG.renderer ; WG.time (clock)
WG.env = { tex, refresh(priority) }  // PMREM cubemap of the studio; refresh is throttled
WG.post = { setFocus(amount, yCenter), flash(amount), setExposure(v) }
WG.palette (see §4)
WG.groups = { root, studio, case, glass, land, water, flora, props, sky, clouds, weather, glassfx, animals, fx }
WG.cameraRig = { az, el, dist, target, shake(a), focus(vec3, dist?), setIntro(), set(...) }
WG.raycaster ; WG.pointer = { x, y, nx, ny, down, inside }
WG.audio (see §8) ; WG.ui ; WG.hints
WG.scenarios = {}  // scenario name -> apply()
```

`WG.groups` are children of `WG.scene`, already created. Add everything to the correct group. Set `renderOrder` and `frustumCulled` sensibly.

## 2. Coordinates and scale

Interior: x ∈ [−6, 6], z ∈ [−4, 4], floor y = 0, underside of soil block y = −1.8, lid underside y = 7.4 (lid slab 7.4..7.85), wall tops y = 7.4. Water surface baseline y = 0.1. Meadow top ≈ 0.55–0.7. Plinth top y = −1.8, plinth bottom y = −3.0, table top y = −3.0. Camera target (0, 2.15, 0).

The soil block is a solid 12×8 box from y = −1.8 to the terrain surface, cut flush at all four interior walls. Nothing may stick out past |x| = 6 or |z| = 4 except the brass frame, lid overhang, plinth, sun/moon.

Lake: ellipse centre (2.75, 2.65), radii 2.35 × 1.75, surface 0.1, bed ≈ −0.9. River enters lake at (2, 2), comes from the waterfall pool at (−1.5, −0.9). Cliff lip at x −1.5, z ≈ −1.4, top y 2.2. Mountains: peaks (−3.4,−3.75,h 4.0), (−0.5,−3.6,3.0), (2,−3.35,3.3), (4.5,−3.5,2.5), (−5.4,−3.5,1.5). Cabin (−2.95, 1.35) rot 30°, size 0.7×0.5×0.6. Jetty from (0,2.4) toward +z ≈ 0.85. Big boulders listed in brief §4.3.

## 3. Simulation state (`WG.state`)

Read continuously; write only in the sim module unless stated.

```js
time: 15.233          // hours 0..24, wraps
playing: false
season: 0             // continuous 0 spring, 1 summer, 2 autumn, 3 winter (wraps 4→0)
seasonVel: 0          // set by UI while gliding
temp: 18              // °C at lake level (sim-integrated)
tempAt(y)             // function, altitude lapse 5°/unit
humidity: 0.45        // 0..1
wet: 0.15             // ground wetness 0..1
snow: 0               // snow depth 0..1
frost: 0              // 0..1
fog: 0                // valley fog density 0..1
mist: 0.15            // condensation on glass 0..1
ice: 0                // 0..1 frozen lake
waterY: 0.1           // current lake surface
flow: 1               // river/waterfall rate 1..2
wind: 0.28            // scalar 0..1.5
windAngle: 0.4        // radians, direction wind blows toward
windVec: Vector3      // computed, horizontal, magnitude wind
cloudCover: 0.15      // 0..1 driven by clouds
storm: 0              // 0..1
rain: 0               // current rain intensity 0..1
snowfall: 0
daylight: 1           // 0..1 (sun altitude + cloud dimming), exposed by sky
golden: 0             // 0..1 golden-hour weight
night: 0              // 0..1
sunAlt, sunAz, moonAlt, moonAz
sunPos: Vector3, moonPos: Vector3       // world space, outside case
sunVis: 0..1, moonVis: 0..1             // visibility after clouds/mountains
cloudShadow: 0..1
flash: 0              // lightning flash envelope
leaves: 0..1          // foliage amount from season
blossom: 0..1
grassH: 0..1, grassColor: Color
snowline: y where snow line sits
fires: 0..1           // stoked fire / window glow
cameraExposure
quality, fps
```

`WG.state.tempAt(y)` returns temp − (y−0.1)*5.

Events: `time`, `season`, `lightning({pos, cloud, power})`, `thunder({pos, delay})`, `tap({pane, uv})`, `tool`, `splash({pos})`, `merge`, `squeeze`, `rainstart`, `seasonchange`, `milestone(name)`, `ui:hide`.

## 4. Palette (screen-target colours, linear-ish sRGB hex)

```js
WG.palette = {
  brassLight:'#ae9365', brassShade:'#5b4428', brassPatina:'#5d6552', brassGlow:'#ffd98a',
  glassEdge:'#518f7d', glassTint:'#87b7a1',
  walnut:'#33241b', walnutLight:'#5a4030', table:'#241a13', backdrop:'#28231e', backdropWarm:'#423b33',
  grass:'#8aa16f', grassShade:'#31442b', grassAutumn:'#9c8550', grassWinter:'#b7a985',
  pine:'#263e2b', oak:'#3f5c33', birch:'#6c7f3f', cherry:'#b4949a',
  rock:'#9a9791', rockShade:'#434444', soil:'#3a2a1e', loam:'#5a402c', clay:'#a8683c', gravel:'#7b7973', bedrock:'#6e6960',
  lake:'#397f86', lakeDeep:'#123b43', river:'#3d7f82', foam:'#e9f3ef', cloud:'#dddbd8',
  log:'#6e6054', shingle:'#5c544b', cream:'#e4dcc6', door:'#7a2c22', shutter:'#3c5e48',
  sun:'#ffe6bd', sunlight:'#fff8ef', moon:'#adc5ff', stormCloud:'#52585e', nightSky:'#0c141c',
  starA:'#dfe9ff', starB:'#ffe9c4', smoke:'#c8c2b8', firefly:'#d8ff8a',
  leafColors:['#c8461a','#e07b1f','#e9a92b','#b5301c','#f0c24a']
}
```

Use `new THREE.Color(hex)`; convert sRGB properly via `color.convertSRGBToLinear()` when feeding shaders.

## 5. Module map, order and ownership

`n` = load/init order (prefix of file). Update order = same.

| n | file | module | owner |
|---|---|---|---|
|00|00_boot.js|core, quality, state, RNG, noise, groups, palette|lead|
|10|01_engine.js|renderer, camera rig, post, loop, env, error guards|lead|
|12|02_materials.js|shared canvas textures, brass/walnut/rock/sky materials|lead|
|14|03_sky.js|sun, moon, stars, light, atmosphere, time integration|lead|
|16|04_studio.js|backdrop, table, softbox env scene, dust motes|case-studio|
|18|05_case.js|glass panes, brass frame, plinth, plaque, gauge|case-studio|
|20|06_terrain.js|heightfield, mountains, soil strata, rocks, paths, puddles|terrain|
|22|07_water.js|lake, river, waterfall, pool, reflections, cross-section, fish|water|
|24|08_flora.js|trees, bushes, grass, flowers, reeds, lilies, petals/leaves|flora|
|26|09_cabin.js|cabin, jetty, boat, yard, smoke, windows|props|
|28|10_clouds.js|cloud volumes, physics, states, cloud shadows|lead|
|30|11_weather.js|rain, snow, hail, fog, lightning, rainbow, aurora, splashes|weather|
|32|12_glassfx.js|mist, beads, runs, frost, wipe, tap rings|glassfx|
|34|13_animals.js|birds, butterflies, dragonflies, fireflies|wildlife|
|36|14_audio.js|WebAudio engine, ambience, events, panning|audio|
|38|15_ui.js|all HTML UI, onboarding, hints, accessibility|ui|
|40|16_input.js|pointer/tools, picking, drag, sun/season drag|lead|
|42|17_sim.js|climate integration, clouds coupling, season, presets|lead|
|44|18_main.js|scenario parse, init, loop, watchdog, loading fade|lead|

## 6. Terrain API (owned by `terrain`, module name `terrain`)

Required exports:

```js
WG.terrain = {
  ready: false,
  heightAt(x,z),                 // top of solid ground (lake bed under water, mountain height)
  slopeAt(x,z),                  // 0..1
  surfaceAt(x,z),                // 'lake'|'river'|'sand'|'path'|'grass'|'rock'|'soil'
  inLake(x,z), inRiver(x,z),     // bool
  depthAt(x,z),                  // water depth below current waterY (0 dry)
  nearShore(x,z),                // 0..1
  setWeather(wet, snow, frost, waterY),   // per-frame uniforms for strata/puddles/snow
  groundPoint(x,z,out)           // out.set(x, heightAt, z) + small normal offset
}
```

Heightfield resolution ≥ 220×150. Mountain normals must be smooth; soil cut faces at the four walls with strata shader, roots, stones; puddles appear from `wet`. Add boulders, pebbles (100–200 total), footpaths, snow/frost, wet gloss, falling leaves later owned by flora. Terrain receives shadows. Keep the lake basin, river channel and cliff shelf close to the given coordinates.

## 7. Other module APIs

**water**: `update` drives lake/river/waterfall visual by `state.waterY/flow/ice/rain`; `WG.water = { ready, ring(x,z,strength), splash(x,z,strength), rippleSource, freeze() }`; fish in `WG.water.fish` (objects `{pos, dir, speed, mesh}`) so input can scatter them; expose lake surface mesh as `WG.water.surface` for raycast. Planar reflection target at half res only when `quality.reflections`, else sky-colour fresnel.

**flora**: `WG.flora = { ready, trees:[{group, base:Vector3, height, type, bend, phase}], flowers, bushes, setWeather(), burst(tree, kind) }`. Tree trunk meshes tagged `userData.tree`. All broadleaf/pine/cherry/bush counts from quality. Grass as one InstancedMesh (single triangle blade, 2 verts fixed, shader wind). Leaves/petals/snow puffs particle system. Expose blossom/petal emission. Signal `WG.emit('foliage')`.

**cabin**: `WG.cabin = { ready, windows:[...], smokeOn, setSnow, lightPool }`. Cabin local group placed/rotated; windows use emissive material toggled by `state.fires`; lantern point light; smoke particles; jetty/boat (`WG.cabin.boat` with `rock(strength)`). Perch points exported: `WG.cabin.perches`, `WG.cabin.shelters`.

**clouds**: see §9.

**weather**: `WG.weather = { ready, splash(pos, strength), bolt(from,to,power), fogPuff(pos, size), setRain(cloud, rate), rainColumns, hail, clearSky }`. Reads `WG.clouds.list` for rain emitters. Rain/snow column starts at cloud base and descends over ~0.35s; column width = cloud width; particles pooled; rings on water/ground via `water.ring`/terrain splash decals. Fog is a height-field 2.5D volume with flow downhill + burn-off from sun/wind; use `state.fog`. Lightning visuals + scheduling; large sconce flash via `WG.post.flash` and `state.flash`; emits `lightning`/`thunder`. Rainbow/aurora driven by conditions. Every effect honours quality.

**glassfx**: attaches four overlay planes inside `WG.case.glassPanes` (`WG.glass.panes[i].mesh`, ids 0..3, normal, width/height). Draws mist/frost/beads/runs in shader with uniforms from `state.mist/temp/humidity/rain/fog`; `WG.glassfx = { ready, wipe(paneIndex, uv, radius), tap(paneIndex, uv), clear(paneIndex, uv), smudges }`. Tap emits ring shader + `WG.emit('tap')`.

**animals**: `WG.animals = { ready, flush(), scatter(pos, radius) }`. Birds/butterflies/dragonflies/fireflies per brief §7 and quality; use `WG.clouds` and `WG.flora` for perches. All motion procedural.

**audio**: `WG.audio = { ready, start(), setMuted(bool), muted, event(name, {pos, params}), setStateSnapshot(state), master }`. Build ambience graph on first gesture. Event names: `grab(size)`, `release`, `squish`, `merge`, `pop`, `crackle`, `thunder(delay,dist)`, `crack`, `splash`, `drip`, `tink(pane)`, `squeak`, `windSweep(speed)`, `whoosh`, `tick`, `chime(n)`, `toggle`. Pan via screen x (`WG.camera` projection). Crickets/frogs/owl/birds follow state.

**ui**: `WG.ui = { ready, setTool(name), hint(text), toast(text), openDrawer, hideUI(bool), onTip(name), progressTip(id), setTime(h), setSeason(s), setTemp(v), setPhrase(s), needle(temp,hum), setPlaying(bool), focusRing(el) }`. All UI in DOM; CSS in `src/ui.css` (concatenated). Implements brief §15 meticulously, desktop + mobile + a11y. Calls `WG.input.setTool`, `WG.time.addHours`, `WG.season.glideTo`, etc.

## 8. Sky / time / season API (owned by lead)

`WG.time = { value, addHours(dh), setTime(h, glide), playing }` (also `state.time`).
`WG.season = { value, set(s, glide), nudge(d) }` (also `state.season`).
`WG.sky = { sun, moon, sunPick, moonPick, light, hemi, update }`.
`WG.sky.dragSun(dHours)` and `dragMoon(dHours)`.
`WG.env.refresh()` after big light changes (throttled).

## 9. Clouds API (owned by lead; for everyone)

```js
WG.clouds = {
  ready, list,
  spawn(pos, size), nearest(point, maxDist), atPointer(), pickables:[...],
  squeeze(cloud, amount, dt), strike(cloud), merge(a,b), release(cloud, vel),
  shadowBlobs
}
```
Cloud object: `{ id, group, pos, vel, radius, water, sizeTarget, state, squeezed, tremble, charge, rainRate, storm, age, heldAt }`. Weather reads `rainRate`, `state`, `pos`, `radius`; animals/boats respond to `storm`.

Clouds use `WG.groups.clouds` and cast shadows (quality.shadowMap).

## 10. UI ↔ tool names

Tool ids: `hand`, `wind`, `cloud`, `fog`, `wipe`. `WG.input.setTool(id)` updates `WG.input.tool`, cursor, calls `WG.ui.setTool(id)`, emits `tool`, audio tick. Tools other than hand use crosshair; wipe uses custom ring cursor.

## 11. Scenarios

`WG.scenarios.rain = () => {...}` etc. in sim. Each sets time/season/climate/clouds/wet/ice/fog and must be fully applied before first frame. Available: calm, rain, storm, snow, mountainsnow, fog, autumn, night, dusk.

## 12. Build, run, verify

```
cd weatherglass
node build.mjs                       # -> ../weatherglass.html
node tools/shot.mjs calm shots/calm.png 1440 900 9000
node tools/shot.mjs calm shots/storm.png 1440 900 9000 --scenario storm
```
`shot.mjs` waits for `window.__WG_READY__`, supports `--scenario`, `--eval "js"`, `--pointer x,y`, `--click x,y`, `--drag x1,y1,x2,y2`, `--wait ms`, `--mobile`. Console errors are printed and saved to `shots/console.txt`; **your screenshots must have zero exceptions**.

Rules of thumb: keep draw calls under ~450; triangle budget < 1.6M high, < 500k low; textures < 1MB each; no per-frame `new THREE.*` in loops.

## 13. Definition of done for your module

- Runs with no console errors in all three quality levels (`?q=0|1|2`).
- Visual match to the brief at both 1440×900 and 390×844.
- Connected to the shared state (no canned toggles), reacts to season/time/weather.
- `eligible` at 30+ fps on a 1440×900 headless shot (report measured fps if visible).
- Task marked complete on the board with screenshot paths and notes.