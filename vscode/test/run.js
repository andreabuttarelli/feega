const { runTests } = require('@vscode/test-electron');
const { resolve } = require('node:path');

runTests({
  vscodeExecutablePath: process.env.VSCODE_PATH,
  extensionDevelopmentPath: resolve(__dirname, '..'),
  extensionTestsPath: resolve(__dirname, 'suite.js'),
  launchArgs: [process.env.FEEGA_TEST_DIR, '--disable-extensions', '--new-window']
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
