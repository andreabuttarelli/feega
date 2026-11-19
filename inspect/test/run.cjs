const { runTests } = require('@vscode/test-electron');
const { resolve } = require('node:path');

const app = resolve(process.env.INSPECT_TEST_DIR ?? resolve(__dirname, '../../landing'));

runTests({
  vscodeExecutablePath: process.env.VSCODE_PATH,
  extensionDevelopmentPath: resolve(__dirname, '..'),
  extensionTestsPath: resolve(__dirname, 'suite.cjs'),
  extensionTestsEnv: { INSPECT_TEST_DIR: app },
  launchArgs: [app, '--disable-extensions', '--new-window']
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
