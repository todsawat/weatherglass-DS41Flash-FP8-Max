// Build: concatenate modules into a single self-contained HTML file.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(join(root, 'src'))
  .filter(f => /^\d\d_.*\.js$/.test(f))
  .sort();
const css = readFileSync(join(root, 'src/ui.css'), 'utf8');
for (const f of files) { try { execFileSync(process.execPath, ['--check', join(root, 'src', f)], { stdio: 'pipe' }); } catch (e) { console.log('SYNTAX ERROR in', f, '\n', e.stderr.toString().split('\n').slice(0,4).join('\n')); } }
const three = readFileSync(join(root, 'lib/three.min.js'), 'utf8');
let app = '';
for (const f of files) {
  app += `\n/* ===== ${f} ===== */\n` + readFileSync(join(root, 'src', f), 'utf8');
}
const tpl = readFileSync(join(root, 'template.html'), 'utf8');
const out = tpl
  .replace('/*__UI_CSS__*/', () => css)
  .replace('/*__THREE__*/', () => three)
  .replace('/*__APP__*/', () => app);
const target = join(root, '..', 'weatherglass.html');
writeFileSync(target, out);
mkdirSync(join(root, 'shots'), { recursive: true });
console.log(`built ${target}  ${(out.length / 1024).toFixed(0)} KB  from ${files.length} modules`);
for (const f of files) {
  const s = readFileSync(join(root, 'src', f), 'utf8');
  if (/\bimport\s+[\s\S]{0,80}from\b/.test(s)) console.log('  ! ES import in', f);
}