const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Launch, launchArgs, mcpServers, canvasFileFor, canvasPage, eventReader, importMessage, gitignoreWith, readyProbe, served, spawnOptions, Step, stepOf, loadingPage, errorPage, logTail, RETRY } = require('./canvas-run');

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

test('i passi di npx arrivano come eventi, anche spezzati tra due pezzi di output', () => {
  const seen = [];
  const read = eventReader((e) => seen.push(e));
  read('feega: saving\nfeega:event {"event":"choose-app","ap');
  read('ps":["a","b"]}\nfeega:event {"event":"imported","pages":2}\n');
  assert.deepEqual(seen, [{ event: 'choose-app', apps: ['a', 'b'] }, { event: 'imported', pages: 2 }]);
});

test('una riga di evento rotta non ferma la lettura', () => {
  const seen = [];
  eventReader((e) => seen.push(e))('feega:event {nope\nfeega:event {"event":"imported","pages":1}\n');
  assert.deepEqual(seen, [{ event: 'imported', pages: 1 }]);
});

test('il messaggio finale dice quante pagine e quante servono di un valore, e dove sta la tela', () => {
  assert.equal(importMessage({ pages: 12, needsValue: 3, leftOut: 3 }, '/w/app.feega'), 'Imported 12 pages; 3 need a value. Canvas: /w/app.feega');
  assert.equal(importMessage({ pages: 1, needsValue: 0, leftOut: 0 }, '/w/app.feega'), 'Imported 1 page. Canvas: /w/app.feega');
  assert.equal(importMessage({ pages: 5, needsValue: 0, leftOut: 2 }, '/w/app.feega'), 'Imported 5 pages; 2 left out (see the Feega output). Canvas: /w/app.feega');
});

test('gitignore: aggiunge *.feega una volta sola, senza toccare il resto', () => {
  assert.equal(gitignoreWith('node_modules\n'), 'node_modules\n*.feega\n');
  assert.equal(gitignoreWith('node_modules'), 'node_modules\n*.feega\n');
  assert.equal(gitignoreWith(''), '*.feega\n');
  assert.equal(gitignoreWith('a\n*.feega\n'), null);
});

test('npx parte dalla cartella della tela: da lì il launcher trova il package.json da importare', () => {
  assert.equal(spawnOptions('/code/my-app/my-app.feega', 'darwin', {}).cwd, '/code/my-app');
});

test('i passi del launcher diventano il passo mostrato; un evento estraneo non cambia nulla', () => {
  assert.equal(stepOf({ event: 'step', step: 'download' }), Step.Download);
  assert.equal(stepOf({ event: 'step', step: 'install' }), Step.Install);
  assert.equal(stepOf({ event: 'step', step: 'start' }), Step.Start);
  assert.equal(stepOf({ event: 'imported', pages: 1 }), null);
  assert.equal(stepOf({ event: 'step', step: 'boh' }), null);
});

test('la schermata di avvio ha il marchio, il nome, la barra e il passo, nei due temi', () => {
  const html = loadingPage(Step.Download);
  assert.match(html, /<svg/);
  assert.match(html, />feega</);
  assert.match(html, /Downloading the app/);
  assert.match(html, /vscode-dark/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test("l'errore mostra il motivo e la coda del log, con un Retry, e non esegue l'HTML del log", () => {
  const html = errorPage('Feega stopped (exit 1).', 'feega: <script>x</script>');
  assert.match(html, /Feega stopped \(exit 1\)\./);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(html, new RegExp(`postMessage\\(\\{ type: '${RETRY}' \\}\\)`));
});

test('la coda del log tiene le ultime righe', () => {
  const tail = logTail(40);
  for (let i = 0; i < 100; i++) {
    tail.push(`line ${i}\n`);
  }
  const text = tail.text();
  assert.match(text, /line 99/);
  assert.doesNotMatch(text, /line 10\n/);
  assert.equal(text.trim().split('\n').length, 40);
});
