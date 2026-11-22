const { runTests } = require('@vscode/test-electron');
const { resolve } = require('node:path');

const app = resolve(process.env.INSPECT_TEST_DIR ?? resolve(__dirname, '../../landing'));
const profile = process.env.INSPECT_TEST_PROFILE;
const isolation = profile ? [`--user-data-dir=${resolve(profile, 'user')}`, `--extensions-dir=${resolve(profile, 'extensions')}`] : [];

runTests({
  vscodeExecutablePath: process.env.VSCODE_PATH,
  extensionDevelopmentPath: resolve(__dirname, '..'),
  extensionTestsPath: resolve(__dirname, process.env.INSPECT_SUITE ?? 'suite.cjs'),
  extensionTestsEnv: { INSPECT_TEST_DIR: app },
  launchArgs: [app, '--disable-extensions', '--new-window', ...isolation]
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
