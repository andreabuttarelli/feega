const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEPRECATION, Launch, launchArgs, launcherOf, legacyMove, mcpServers, canvasPage, eventReader, importMessage, readyProbe, served, spawnOptions, Step, progressOf, advance, failedAt, stepsPage, lineEvent, logTail, RETRY } = require('./canvas-run');

test('apre il file senza browser e senza flag di import: senza terminale il launcher non chiede, e i launcher vecchi non conoscono --no-import', () => {
  assert.deepEqual(launchArgs('/w/a.feega', 61000, Launch.Open), ['-y', 'feega@latest', '/w/a.feega', '--port', '61000', '--no-open']);
});

test('importare la cartella passa --import', () => {
  assert.deepEqual(launchArgs('/w/app.feega', 61000, Launch.ImportFolder).slice(-1), ['--import']);
});

test('un server MCP per ogni tela aperta, sulla sua porta', () => {
  const running = new Map([['/w/a', 61000], ['/w/b.feega', 61001]]);
  assert.deepEqual(mcpServers(running), [
    { label: 'feega a', command: 'npx', args: ['-y', 'feega@latest', 'mcp', '--port', '61000'] },
    { label: 'feega b', command: 'npx', args: ['-y', 'feega@latest', 'mcp', '--port', '61001'] }
  ]);
});

test("l'avviso di deprecazione indica Feega Inspect", () => {
  assert.match(DEPRECATION.message, /deprecated/);
  assert.match(DEPRECATION.message, /Feega Inspect/);
  assert.equal(DEPRECATION.extensionId, 'AndreaButtarelli.feega-inspect');
});

test('il vecchio <cartella>.feega diventa .feega, che il server migra nel formato a cartella', () => {
  assert.deepEqual(legacyMove('/code/my-app', (p) => p === '/code/my-app/my-app.feega'), { from: '/code/my-app/my-app.feega', to: '/code/my-app/.feega' });
});

test('niente da migrare se .feega esiste già o il vecchio file non c\'è', () => {
  assert.equal(legacyMove('/code/my-app', () => true), null);
  assert.equal(legacyMove('/code/my-app', () => false), null);
});

test('senza percorso di sviluppo parte il pacchetto pubblicato', () => {
  assert.deepEqual(launcherOf('', '/w/site', 61000, Launch.Open), { command: 'npx', args: ['-y', 'feega@latest', '/w/site', '--port', '61000', '--no-open'] });
});

test('in modalità sviluppo parte scripts/local.mjs di questo repo, sulla cartella', () => {
  assert.deepEqual(launcherOf('/repo/feega', '/w/site', 61000, Launch.Open), { command: 'node', args: ['/repo/feega/scripts/local.mjs', '/w/site', '--port=61000'] });
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

test('npx parte dalla cartella del progetto: da lì il launcher trova il package.json da importare', () => {
  assert.equal(spawnOptions('/code/my-app', 'darwin', {}).cwd, '/code/my-app');
});

const states = (progress) => progress.steps.map((s) => `${s.id}:${s.state}`);

test("aprire una tela mostra solo i passi dell'app; importare una cartella anche pagine, dipendenze, dev server e import", () => {
  assert.deepEqual(progressOf(Launch.Open).steps.map((s) => s.id), [Step.App, Step.Start]);
  assert.deepEqual(progressOf(Launch.ImportFolder).steps.map((s) => s.id), [Step.App, Step.Start, Step.Find, Step.Dependencies, Step.DevServer, Step.Pages]);
});

test('un passo che parte chiude quelli prima; il conteggio delle pagine e il gestore entrano nella riga', () => {
  let p = progressOf(Launch.ImportFolder);
  for (const e of [
    { event: 'step', step: 'download' },
    { event: 'step', step: 'start' },
    { event: 'step', step: 'find', state: 'done', pages: 15 },
    { event: 'step', step: 'dependencies', state: 'active', manager: 'bun' },
    { event: 'step', step: 'page', index: 3, total: 15 }
  ]) {
    p = advance(p, e);
  }
  assert.deepEqual(states(p), ['app:done', 'start:done', 'find:done', 'dependencies:done', 'dev-server:done', 'pages:active']);
  const html = stepsPage(p);
  assert.match(html, /Find pages \(15\)/);
  assert.match(html, /Install dependencies \(bun\)/);
  assert.match(html, /Import page 3\/15/);
});

test('un passo già chiuso non torna indietro quando arriva tardi la fine di quello prima', () => {
  let p = advance(progressOf(Launch.ImportFolder), { event: 'step', step: 'find', state: 'done', pages: 2 });
  p = advance(p, { event: 'step', step: 'start', state: 'done' });
  assert.deepEqual(states(p).slice(1, 4), ['start:done', 'find:done', 'dependencies:active']);
});

test('le righe del launcher vecchio diventano gli stessi passi, e il suo errore diventa import-failed', () => {
  assert.deepEqual(lineEvent('feega: looking for the pages of traidue.com…'), { event: 'step', step: 'find', state: 'active' });
  assert.deepEqual(lineEvent('feega: importing traidue.com: 15 pages (starts its dev server, can take a minute)…'), { event: 'step', step: 'find', state: 'done', pages: 15 });
  assert.deepEqual(lineEvent('feega: folder import failed: the dev server did not answer'), { event: 'import-failed', message: 'the dev server did not answer' });
  assert.equal(lineEvent('feega: saving to /w/a.feega'), null);
});

test('una riga sola che arriva insieme a un evento non lo raddoppia', () => {
  const seen = [];
  const read = eventReader((e) => seen.push(e));
  read('feega: looking for the pages of x…\nfeega:event {"event":"imported","pages":2}\n');
  assert.deepEqual(seen, [{ event: 'step', step: 'find', state: 'active' }, { event: 'imported', pages: 2 }]);
});

test("un errore fa rosso il passo in corso, con il motivo, la coda del log e un Retry, senza eseguire l'HTML del log", () => {
  let p = advance(progressOf(Launch.ImportFolder), { event: 'step', step: 'find', state: 'done', pages: 15 });
  p = advance(p, { event: 'step', step: 'dev-server', state: 'active' });
  p = failedAt(p, 'the dev server did not answer', 'Error: <script>x</script>');
  assert.deepEqual(states(p).slice(-2), ['dev-server:error', 'pages:pending']);
  const html = stepsPage(p);
  assert.match(html, /the dev server did not answer/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(html, new RegExp(`postMessage\\(\\{ type: '${RETRY}' \\}\\)`));
});

test('la schermata dei passi ha il marchio e il nome, nei due temi, senza risorse esterne', () => {
  const html = stepsPage(progressOf(Launch.Open));
  assert.match(html, /<svg/);
  assert.match(html, />feega</);
  assert.match(html, /vscode-dark/);
  assert.doesNotMatch(html, /https?:\/\//);
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

test('appena aperta, la schermata mostra già il primo passo in corso, prima di qualunque evento', () => {
  const steps = progressOf(Launch.ImportFolder).steps;
  assert.equal(steps[0].state, 'active');
  assert.ok(steps.slice(1).every((s) => s.state === 'pending'));
  assert.match(stepsPage(progressOf(Launch.Open)), /<li class="active"/);
});
