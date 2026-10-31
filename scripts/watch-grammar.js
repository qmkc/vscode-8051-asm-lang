// Rebuilds syntaxes/a51.tmLanguage.json whenever a51.tmLanguage.yaml
// changes. Used by `pnpm run watch` (via watch:grammar) so F5 debugging
// always launches with an up-to-date grammar.
const path = require('path');
const { execFileSync } = require('child_process');

const buildScript = path.join(__dirname, 'build-grammar.js');
const srcPath = path.join(__dirname, '..', 'syntaxes', 'a51.tmLanguage.yaml');

function build() {
  try {
    execFileSync(process.execPath, [buildScript], { stdio: 'inherit' });
  } catch {
    // build-grammar.js already printed the error; keep watching.
  }
}

console.log('[watch] build started');
build();
console.log('[watch] build finished');

let timer = null;
require('fs').watch(srcPath, () => {
  // Debounce: editors often emit multiple change events per save.
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log('[watch] build started');
    build();
    console.log('[watch] build finished');
  }, 100);
});
