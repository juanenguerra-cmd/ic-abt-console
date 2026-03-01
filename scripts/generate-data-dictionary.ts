import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const modelsPath = path.join(repoRoot, 'src/domain/models.ts');
const dictionaryPath = path.join(repoRoot, 'docs/data-field-reference.md');

const models = fs.readFileSync(modelsPath, 'utf8');
const dictionary = fs.readFileSync(dictionaryPath, 'utf8');

const interfaceRegex = /export interface\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
const fieldRegex = /^\s*(\w+)\??:\s*([^;]+);/gm;

const extracted: Record<string, string[]> = {};
let m: RegExpExecArray | null;
while ((m = interfaceRegex.exec(models)) !== null) {
  const [, name, body] = m;
  const fields: string[] = [];
  let f: RegExpExecArray | null;
  while ((f = fieldRegex.exec(body)) !== null) {
    fields.push(f[1]);
  }
  extracted[name] = fields;
}

const dictLines = dictionary.split('\n').filter((line) => line.startsWith('- `'));
const dictEntries = dictLines.map((line) => line.slice(3, line.indexOf(' |')).trim());
const duplicates = dictEntries.filter((entry, idx) => dictEntries.indexOf(entry) !== idx);

console.log('Interfaces parsed:', Object.keys(extracted).length);
for (const [name, fields] of Object.entries(extracted)) {
  if (fields.length > 0) {
    console.log(`${name}: ${fields.length} fields`);
  }
}

if (duplicates.length > 0) {
  console.error('\nDuplicate field labels found in data dictionary bullets:');
  console.error([...new Set(duplicates)].join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nNo duplicate bullet field labels detected in docs/data-field-reference.md');
}
