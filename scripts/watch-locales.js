// Rebuilds src/language/locales/generated/*.json whenever a file under
// src/language/locales/data/ changes. Used by `pnpm run watch` (via
// watch:locales) so F5 debugging always has up-to-date locale strings.
const path = require('path');
const { execFileSync } = require('child_process');

const buildScript = path.join(__dirname, 'build-locales.js');
const srcDir = path.join(__dirname, '..', 'src', 'language', 'locales', 'data');

function build() {
  try {
    execFileSync(process.execPath, [buildScript], { stdio: 'inherit' });
  } catch {
    // build-locales.js already printed the error; keep watching.
  }
}

console.log('[watch] build started');
build();
console.log('[watch] build finished');

let timer = null;
require('fs').watch(srcDir, () => {
  // Debounce: editors often emit multiple change events per save.
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log('[watch] build started');
    build();
    console.log('[watch] build finished');
  }, 100);
});
