import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i+1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
for (const name of ['hdx_national.csv', 'hdx_health_zones.csv']) {
  const f = path.join(root, 'data/raw', name);
  if (!fs.existsSync(f)) continue;
  const a = parseCSV(fs.readFileSync(f, 'utf8')); const h=a[0];
  console.log(JSON.stringify({file:name,rows:a.length-2,headers:h,first:a.slice(2,5),last:a.slice(-2)},null,2));
}
