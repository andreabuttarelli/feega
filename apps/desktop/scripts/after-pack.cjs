const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const SERVER = resolve(__dirname, '..', 'server');

exports.default = async function afterPack({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName !== 'darwin') {
    return;
  }
  const app = join(appOutDir, `${packager.appInfo.productFilename}.app`);
  if (existsSync(SERVER)) {
    execFileSync('ditto', [SERVER, join(app, 'Contents', 'Resources', 'server')], { stdio: 'inherit' });
  }
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
