// Compiles src/language/locales/data/*.yaml (the hand-edited sources of
// truth for all locale/translation strings) into
// src/language/locales/generated/*.json, which locales/index.ts imports.
// Run via `pnpm run build:locales`.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const srcDir = path.join(__dirname, '..', 'src', 'language', 'locales', 'data');
const outDir = path.join(
  __dirname,
  '..',
  'src',
  'language',
  'locales',
  'generated',
);

fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith('.yaml')) {
    continue;
  }
  const code = path.basename(file, '.yaml');
  const srcPath = path.join(srcDir, file);
  const outPath = path.join(outDir, `${code}.json`);
  const doc = yaml.load(fs.readFileSync(srcPath, 'utf8'));
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
  console.log(
    `Built ${path.relative(process.cwd(), outPath)} from ${path.relative(process.cwd(), srcPath)}`,
  );
}
