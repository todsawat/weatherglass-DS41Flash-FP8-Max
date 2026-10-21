// Screenshot / smoke-test harness.
// usage: node tools/shot.mjs <scenario> <out.png> [w] [h] [waitMs] [options]
// options: --scenario x --eval "js" --pointer x,y --click x,y --drag x1,y1,x2,y2 --wheel x,y,dy
//          --key k --q 0|1|2 --mobile --wait ms --full
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const pos = [];
const opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (['eval', 'after', 'pointer', 'click', 'drag', 'hold', 'wheel', 'key', 'q', 'scenario', 'wait', 'file'].includes(k)) opt[k] = argv[++i];
    else opt[k] = true;
  } else pos.push(a);
}
const scenario = opt.scenario || pos[0] || 'calm';
const out = resolve(pos[1] || join(root, 'shots', 'shot.png'));
const W = +(pos[2] || 1440), H = +(pos[3] || 900);
const waitMs = +(opt.wait || pos[4] || 7000);
mkdirSync(dirname(out), { recursive: true });

function findChromium() {
  const base = join(process.env.HOME, 'Library/Caches/ms-playwright');
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of dirs) {
    const p = join(base, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
    if (existsSync(p)) return p;
  }
  return undefined;
}
const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    '--ignore-gpu-blocklist', '--enable-webgl', '--disable-dev-shm-usage']
});
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: opt.mobile ? 2 : 1,
  isMobile: !!opt.mobile,
  hasTouch: !!opt.mobile
});
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
page.on('requestfailed', r => errors.push(`[requestfailed] ${r.url()}`));

const qs = new URLSearchParams({ scenario });
if (opt.q !== undefined) qs.set('q', opt.q);
if (opt.mobile) qs.set('touch', '1');
const url = pathToFileURL(join(root, '..', opt.file || 'weatherglass.html')).href + '?' + qs;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__WG_READY__ === true, null, { timeout: 30000 }).catch(() => errors.push('[harness] never became ready'));
await page.waitForTimeout(1200);
if (opt.eval) {
  try { const r = await page.evaluate(opt.eval); if (r !== undefined) console.log('EVAL', JSON.stringify(r)); } catch (e) { errors.push('[eval] ' + e.message); }
  await page.waitForTimeout(700);
}
if (opt.pointer) { const [x, y] = opt.pointer.split(',').map(Number); await page.mouse.move(x, y); await page.waitForTimeout(500); }
if (opt.click) { const [x, y] = opt.click.split(',').map(Number); await page.mouse.click(x, y); await page.waitForTimeout(900); }
if (opt.drag) {
  const [x1, y1, x2, y2] = opt.drag.split(',').map(Number);
  await page.mouse.move(x1, y1); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x1 + (x2 - x1) * i / 12, y1 + (y2 - y1) * i / 12);
  await page.mouse.up(); await page.waitForTimeout(700);
}
if (opt.hold) {
  const [x1, y1, x2, y2] = opt.hold.split(',').map(Number);
  await page.mouse.move(x1, y1); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x1 + (x2 - x1) * i / 6, y1 + (y2 - y1) * i / 6);
}
if (opt.wheel) { const [x, y, d] = opt.wheel.split(',').map(Number); await page.mouse.move(x, y); await page.mouse.wheel(0, d); await page.waitForTimeout(600); }
if (opt.key) { await page.keyboard.press(opt.key); await page.waitForTimeout(500); }
const remaining = Math.max(0, waitMs - 1200);
if (remaining) await page.waitForTimeout(remaining);
if (opt.after) { try { const r = await page.evaluate(opt.after); if (r !== undefined) console.log('AFTER', JSON.stringify(r)); } catch (e) { errors.push('[after] ' + e.message); } }
const stats = await page.evaluate(() => {
  const w = window.WG;
  if (!w) return { missing: true };
  const info = w.renderer?.info;
  return {
    fps: +(w.state?.fps || 0).toFixed(1), q: w.quality?.level, calls: info?.render?.calls,
    tris: info?.render?.triangles, geos: info?.memory?.geometries, tex: info?.memory?.textures,
    clouds: w.clouds?.list?.length, ready: w.readyModules, failed: w.failedModules
  };
});
await page.screenshot({ path: out });
errors.push('STATS ' + JSON.stringify(stats));
writeFileSync(join(root, 'shots', 'console.txt'), errors.join('\n'));
console.log(errors.join('\n'));
console.log('wrote', out);
await browser.close();