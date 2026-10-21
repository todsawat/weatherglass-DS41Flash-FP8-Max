import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const skip = new Set((process.argv[2]||'').split(',').filter(Boolean));
const files = readdirSync(join(root,'src')).filter(f=>/^\d\d_.*\.js$/.test(f)&&!skip.has(f)).sort();
let app=''; for (const f of files) app += `\n/* ${f} */\n`+readFileSync(join(root,'src',f),'utf8');
const out = readFileSync(join(root,'template.html'),'utf8')
  .replace('/*__UI_CSS__*/',()=>readFileSync(join(root,'src/ui.css'),'utf8'))
  .replace('/*__THREE__*/',()=>readFileSync(join(root,'lib/three.min.js'),'utf8'))
  .replace('/*__APP__*/',()=>app);
writeFileSync(join(root,'..','weatherglass-preview.html'), out);
