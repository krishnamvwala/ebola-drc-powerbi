import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const model = json('Ebola DRC.SemanticModel/model.bim').model;
assert.equal(model.tables.length, 6);
assert.equal(model.relationships.length, 3);
const measures = model.tables.flatMap(t => t.measures ?? []);
assert.equal(measures.length, 16);
for (const relationship of model.relationships) {
  for (const side of ['from', 'to']) {
    const table = model.tables.find(t => t.name === relationship[side + 'Table']);
    assert(table?.columns.some(c => c.name === relationship[side + 'Column']), 'Invalid relationship field');
  }
}
assert(model.expressions.some(e => e.name === 'DataFolder'));
const report = json('Ebola DRC.Report/report.json');
assert.equal(report.sections.length, 4);
const geography = report.sections.find(p => p.displayName === 'Health zone analysis');
assert(geography);
const configs = geography.visualContainers.map(v => JSON.parse(v.config));
const charts = configs.filter(c => /Chart$/.test(c.singleVisual.visualType));
assert.equal(charts.length, 2);
for (const chart of charts) {
  const colors = JSON.stringify(chart.singleVisual.objects.dataPoint);
  assert(colors.includes('#F56D63') && !colors.includes('#AEB0B7'), 'Incorrect Health zone chart color');
}
assert.equal(configs.filter(c => c.singleVisual.visualType === 'shapeMap').length, 1);
assert(!JSON.stringify(report).includes('Detailed source references and quality exceptions:'));
for (const page of report.sections) for (const v of page.visualContainers) {
  assert(v.x >= 0 && v.y >= 0 && v.x + v.width <= page.width && v.y + v.height <= page.height, 'Visual outside page');
}
const topology = json('data/maps/drc_provinces.topojson');
assert.equal(topology.objects.provinces.geometries.length, 26);
for (const name of ['North Kivu', 'Ituri', 'South Kivu']) assert(topology.objects.provinces.geometries.some(g => g.id === name));
let verifiedSourceHashes = 0;
for (const source of json('data/source_manifest.json').sources) {
  const data = fs.readFileSync(path.join(root, 'data', source.local));
  if (source.sha256) {
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), source.sha256, 'Source hash mismatch: ' + source.local);
    verifiedSourceHashes++;
  }
}
const readme = read('README.md');
const localLinks = [...readme.matchAll(/\]\((?!https?:)(?:\.\/)?([^\)]+)\)/g)];
for (const match of localLinks) assert(fs.existsSync(path.join(root, decodeURIComponent(match[1]))), 'Broken README file link');
assert(fs.statSync(path.join(root, 'Ebola DRC.pbip')).size > 0, 'PBIP entry point is missing');
console.log(JSON.stringify({tables: 6, relationships: 3, measures: 16, reportPages: 4, redCharts: 2, provinces: 26, verifiedSourceHashes, readmeFileLinks: localLinks.length, passed: true}, null, 2));

