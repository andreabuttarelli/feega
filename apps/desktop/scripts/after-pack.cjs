const { execFileSync } = require('node:child_process');
const { existsSync, readdirSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');

const SERVER = resolve(__dirname, '..', 'server');
const KEPT_LOCALE = 'en.lproj';

function dropLocales(app) {
  const resources = join(app, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Resources');
  for (const name of readdirSync(resources)) {
    if (name.endsWith('.lproj') && name !== KEPT_LOCALE) {
      rmSync(join(resources, name), { recursive: true });
    }
  }
}

exports.default = async function afterPack({ electronPlatformName, appOutDir, packager }) {
  if (electronPlatformName !== 'darwin') {
    return;
  }
  const app = join(appOutDir, `${packager.appInfo.productFilename}.app`);
  if (existsSync(SERVER)) {
    execFileSync('ditto', [SERVER, join(app, 'Contents', 'Resources', 'server')], { stdio: 'inherit' });
  }
  dropLocales(app);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
