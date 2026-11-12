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

const EVENT_PREFIX = 'feega:event ';

const eventReader = (onEvent) => {
  let pending = '';
  return (chunk) => {
    const lines = (pending + chunk).split('\n');
    pending = lines.pop();
    for (const line of lines.filter((l) => l.startsWith(EVENT_PREFIX))) {
      try {
        onEvent(JSON.parse(line.slice(EVENT_PREFIX.length)));
      } catch {}
    }
  };
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const importMessage = ({ pages, needsValue, leftOut }, file) => {
  const parts = [`Imported ${plural(pages, 'page')}`];
  if (needsValue) {
    parts.push(`${needsValue} need a value`);
  } else if (leftOut) {
    parts.push(`${leftOut} left out (see the Feega output)`);
  }

  return `${parts.join('; ')}. Canvas: ${file}`;
};

const GITIGNORE_ENTRY = '*.feega';

const gitignoreWith = (content) => {
  const lines = content.split('\n').map((l) => l.trim());
  if (lines.includes(GITIGNORE_ENTRY)) {
    return null;
  }

  const base = content === '' || content.endsWith('\n') ? content : `${content}\n`;
  return `${base}${GITIGNORE_ENTRY}\n`;
};

module.exports = { eventReader, importMessage, gitignoreWith, readyProbe, served, Launch, launchArgs, mcpServers, canvasFileFor, canvasPage, loadingPage, localUrl, freePort };
