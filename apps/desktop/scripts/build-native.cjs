const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const NATIVE_DIR = path.join(__dirname, '..', 'native');
const OUTPUT = path.join(NATIVE_DIR, 'feega_native_canvas.node');
const LIBRARY = 'libfeega_native_canvas.dylib';
const UNIVERSAL_FLAG = '--universal';
const ARM = 'aarch64-apple-darwin';
const INTEL = 'x86_64-apple-darwin';

function build(target) {
  const args = ['build', '--release', '--locked', ...(target ? ['--target', target] : [])];
  execFileSync('cargo', args, { cwd: NATIVE_DIR, stdio: 'inherit' });
  const targetDir = process.env.CARGO_TARGET_DIR ?? path.join(NATIVE_DIR, 'target');
  return path.join(targetDir, ...(target ? [target] : []), 'release', LIBRARY);
}

function universal() {
  const parts = [ARM, INTEL].map(build);
  execFileSync('lipo', ['-create', ...parts, '-output', OUTPUT], { stdio: 'inherit' });
}

function main() {
  if (os.platform() !== 'darwin') {
    console.error('the native canvas builds on macOS only');
    process.exit(1);
  }
  if (process.argv.includes(UNIVERSAL_FLAG)) {
    universal();
  } else {
    const built = build(null);
    fs.rmSync(OUTPUT, { force: true });
    fs.copyFileSync(built, OUTPUT);
  }
  console.log(`built ${OUTPUT}`);
}

main();
