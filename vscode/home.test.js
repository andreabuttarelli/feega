const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Home, homeAction, openOnShow } = require('./home');

function fakeView(visible) {
  const listeners = [];
  const view = {
    visible,
    onDidChangeVisibility: (fn) => {
      listeners.push(fn);
      return { dispose: () => {} };
    },
    show: () => {
      view.visible = true;
      listeners.forEach((fn) => fn({ visible: true }));
    },
    hide: () => {
      view.visible = false;
      listeners.forEach((fn) => fn({ visible: false }));
    }
  };
  return view;
}

const settle = () => new Promise((r) => setImmediate(r));

test('nessuna tela nella cartella: l\'icona ne crea una, una sola: la apre, di più: chiede quale', () => {
  assert.equal(homeAction([]), Home.New);
  assert.equal(homeAction(['/w/a.feega']), Home.Open);
  assert.equal(homeAction(['/w/a.feega', '/w/b.feega']), Home.Pick);
});

const launcher = (calls) => async () => () => calls.push('open');

test('ogni volta che la vista diventa visibile la barra laterale si chiude, perché il clic dopo la riapra, e poi la tela si apre: chiusa dopo, la barra toglierebbe il fuoco alla scelta della tela', async () => {
  const view = fakeView(false);
  const calls = [];
  openOnShow(view, launcher(calls), async () => calls.push('hide'));

  view.show();
  await settle();
  view.hide();
  view.show();
  await settle();
  assert.deepEqual(calls, ['hide', 'open', 'hide', 'open']);
});

test('la vista già visibile quando l\'estensione si attiva apre la tela subito', async () => {
  const calls = [];
  openOnShow(fakeView(true), launcher(calls), async () => calls.push('hide'));
  await settle();
  assert.deepEqual(calls, ['hide', 'open']);
});

test('se non si apre nessuna tela la barra resta aperta, con il bottone per riprovare', async () => {
  const view = fakeView(false);
  const calls = [];
  openOnShow(view, async () => null, async () => calls.push('hide'));
  view.show();
  await settle();
  assert.deepEqual(calls, []);
});
