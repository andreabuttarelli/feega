const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Launch, launchArgs, mcpServers, canvasFileFor, canvasPage, readyProbe, served } = require('./canvas-run');

test('apre il file senza browser e senza flag di import: senza terminale il launcher non chiede, e i launcher vecchi non conoscono --no-import', () => {
  assert.deepEqual(launchArgs('/w/a.feega', 61000, Launch.Open), ['-y', 'feega@latest', '/w/a.feega', '--port', '61000', '--no-open']);
});

test('importare la cartella passa --import', () => {
  assert.deepEqual(launchArgs('/w/app.feega', 61000, Launch.ImportFolder).slice(-1), ['--import']);
});

test('un server MCP per ogni tela aperta, sulla sua porta', () => {
  const running = new Map([['/w/a.feega', 61000], ['/w/b.feega', 61001]]);
  assert.deepEqual(mcpServers(running), [
    { label: 'feega a', command: 'npx', args: ['-y', 'feega@latest', 'mcp', '--port', '61000'] },
    { label: 'feega b', command: 'npx', args: ['-y', 'feega@latest', 'mcp', '--port', '61001'] }
  ]);
});

test('la tela di una cartella prende il nome della cartella', () => {
  assert.equal(canvasFileFor('/code/my-app'), '/code/my-app/my-app.feega');
});

test('la pagina della tela incornicia il server locale', () => {
  const html = canvasPage('http://127.0.0.1:61000');
  assert.match(html, /<iframe src="http:\/\/127\.0\.0\.1:61000"/);
  assert.match(html, /frame-src http:\/\/127\.0\.0\.1:61000/);
});

test('la sonda di avvio non segue il redirect della home: la tela ha header troppo grandi per fetch', () => {
  assert.deepEqual(readyProbe, { redirect: 'manual' });
  assert.equal(served(303), true);
  assert.equal(served(502), false);
});
