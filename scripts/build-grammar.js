// Compiles syntaxes/a51.tmLanguage.yaml (the hand-edited source of truth)
// into syntaxes/a51.tmLanguage.json (what package.json's grammars[].path
// actually points at). Run via `pnpm run build:grammar`.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const srcPath = path.join(__dirname, '..', 'syntaxes', 'a51.tmLanguage.yaml');
const outPath = path.join(__dirname, '..', 'syntaxes', 'a51.tmLanguage.json');

const doc = yaml.load(fs.readFileSync(srcPath, 'utf8'));
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');

console.log(`Built ${path.relative(process.cwd(), outPath)} from ${path.relative(process.cwd(), srcPath)}`);
