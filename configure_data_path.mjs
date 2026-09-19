import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const folder = path.resolve(process.argv[2] ?? path.join(root, 'data/clean')).replaceAll('\\', '/') + '/';
if (!fs.existsSync(folder)) throw new Error('CSV folder does not exist. Supply the extracted repository data/clean folder.');
const modelPath = path.join(root, 'Ebola DRC.SemanticModel/model.bim');
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
const parameter = model.model.expressions.find(e => e.name === 'DataFolder');
if (!parameter) throw new Error('DataFolder parameter was not found.');
parameter.expression = '"' + folder.replaceAll('"', '""') + '" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]';
fs.writeFileSync(modelPath, JSON.stringify(model, null, 2) + '\n');
console.log('Configured DataFolder for this checkout. Open the PBIP and refresh in Power BI Desktop.');
