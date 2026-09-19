import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// The approved color preview changes presentation only, never chart values.
const root = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.join(root, 'Ebola DRC.Report/report.json');
const modelPath = path.join(root, 'Ebola DRC.SemanticModel/model.bim');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const modelHash = hash(modelPath);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const before = structuredClone(report);
const page = report.sections.find(p => p.displayName === 'Health zone analysis');
assert(page, 'Health zone analysis page is required');
const chartNames = ['evd00000000000000016', 'evd00000000000000017', 'evd00000000000000018'];
const color = '#B85C64';
const fill = () => ({solid: {color: {expr: {Literal: {Value: `'${color}'`}}}}});
const changed = [];
for (const visual of page.visualContainers) {
  const config = JSON.parse(visual.config);
  if (!chartNames.includes(config.name)) continue;
  assert(['clusteredBarChart', 'clusteredColumnChart'].includes(config.singleVisual.visualType));
  const points = config.singleVisual.objects.dataPoint;
  assert(points?.length, 'Expected explicit chart series formatting');
  for (const point of points) {
    for (const property of ['defaultColor', 'fill']) {
      if (point.properties[property]) point.properties[property] = fill();
    }
  }
  visual.config = JSON.stringify(config);
  changed.push(config.name);
}
assert.deepEqual(changed.sort(), chartNames.sort(), 'Exactly three charts must be styled');

// Prove nothing except the three dataPoint formatting objects changed.
const normalized = structuredClone(report);
const normalizedPage = normalized.sections.find(p => p.displayName === page.displayName);
const beforePage = before.sections.find(p => p.displayName === page.displayName);
for (const visual of normalizedPage.visualContainers) {
  const config = JSON.parse(visual.config);
  if (!chartNames.includes(config.name)) continue;
  const original = beforePage.visualContainers.find(v => JSON.parse(v.config).name === config.name);
  const originalConfig = JSON.parse(original.config);
  config.singleVisual.objects.dataPoint = originalConfig.singleVisual.objects.dataPoint;
  assert.deepEqual(config, originalConfig);
  visual.config = original.config;
}
assert.deepEqual(normalized, before, 'Unexpected non-color report change');
assert.equal(hash(modelPath), modelHash, 'Model must remain unchanged');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({page: page.displayName, charts: changed.length, color, modelHash, onlyChartColorsChanged: true}, null, 2));
