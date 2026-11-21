import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const BUNDLE = here('../node_modules/electron/dist/Electron.app');
const PLIST = `${BUNDLE}/Contents/Info.plist`;
const BUNDLE_ICON = `${BUNDLE}/Contents/Resources/electron.icns`;
const APP_ICON = here('../build/icons/icon.icns');
const NAME = 'Feega';
const PLIST_BUDDY = '/usr/libexec/PlistBuddy';
const KEYS = ['CFBundleName', 'CFBundleDisplayName'];

const read = (key) => {
  try {
    return execFileSync(PLIST_BUDDY, ['-c', `Print :${key}`, PLIST], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

if (process.platform === 'darwin' && existsSync(PLIST)) {
  const stale = KEYS.filter((key) => read(key) !== NAME);
  const iconStale = !readFileSync(APP_ICON).equals(readFileSync(BUNDLE_ICON));
  for (const key of stale) {
    execFileSync(PLIST_BUDDY, ['-c', `Set :${key} ${NAME}`, PLIST]);
  }
  if (iconStale) {
    copyFileSync(APP_ICON, BUNDLE_ICON);
  }
  if (stale.length || iconStale) {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', BUNDLE], { stdio: 'ignore' });
  }
}
