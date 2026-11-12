const { createServer } = require('node:net');
const { basename, join } = require('node:path');

const PACKAGE = 'feega@latest';
const LOOPBACK = '127.0.0.1';
const EXTENSION = '.feega';
const HTTP_ERROR_MIN = 400;

const readyProbe = { redirect: 'manual' };

const served = (status) => status < HTTP_ERROR_MIN;

const Launch = { Open: 'open', ImportFolder: 'import-folder' };

const IMPORT_FLAGS = { [Launch.Open]: [], [Launch.ImportFolder]: ['--import'] };

const launchArgs = (file, port, launch) => ['-y', PACKAGE, file, '--port', String(port), '--no-open', ...IMPORT_FLAGS[launch]];

const mcpServers = (running) =>
  [...running].map(([file, port]) => ({ label: `feega ${basename(file, EXTENSION)}`, command: 'npx', args: ['-y', PACKAGE, 'mcp', '--port', String(port)] }));

const canvasFileFor = (folder) => join(folder, `${basename(folder)}${EXTENSION}`);

const localUrl = (port) => `http://${LOOPBACK}:${port}`;

const canvasPage = (url) => `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${url}; style-src 'unsafe-inline'">
<style>html,body,iframe{margin:0;padding:0;border:0;width:100%;height:100vh;overflow:hidden;background:#111}</style>
</head><body><iframe src="${url}" allow="clipboard-read; clipboard-write; fullscreen"></iframe></body></html>`;

const loadingPage = (message) => `<!doctype html><html><body style="font-family:system-ui;color:#999;background:#111;display:grid;place-items:center;height:100vh;margin:0">${message}</body></html>`;

const freePort = () =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, LOOPBACK, () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

module.exports = { readyProbe, served, Launch, launchArgs, mcpServers, canvasFileFor, canvasPage, loadingPage, localUrl, freePort };
