import { describe, expect, it } from 'vitest';
import { CODE_ENTRY, Framework, codeFrameHtml, isCodeFiles, starterFiles } from './code-frame';
import { sourceOf } from './iframe-node';
import { frameOf } from '$lib/canvas-node-data';
import { validateNodeData } from './node-data';

const scriptsIn = (html: string) => html.match(/<\/script/gi)?.length ?? 0;

describe('il documento di un code frame', () => {
  it('un file che contiene </script> non esce dal blocco che lo porta', () => {
    const evil = { 'App.tsx': 'export default () => "</script><script>parent.alert(1)</script>"' };
    const clean = { 'App.tsx': 'export default () => null' };

    expect(scriptsIn(codeFrameHtml(Framework.React, evil))).toBe(scriptsIn(codeFrameHtml(Framework.React, clean)));
  });

  it('React e Svelte fissano il proprio runtime nella import map', () => {
    expect(codeFrameHtml(Framework.React, starterFiles(Framework.React))).toMatch(/"react": "https:\/\/esm\.sh\/react@\d/);
    expect(codeFrameHtml(Framework.Svelte, starterFiles(Framework.Svelte))).toMatch(/"svelte\/": "https:\/\/esm\.sh\/svelte@\d/);
  });

  it('un link #/pagina resta dentro il frame invece di navigare verso la base del genitore', () => {
    expect(codeFrameHtml(Framework.Svelte, starterFiles(Framework.Svelte))).toContain('<base href="about:srcdoc">');
  });

  it('ogni framework parte dal proprio file di ingresso', () => {
    for (const framework of Object.values(Framework)) {
      expect(Object.keys(starterFiles(framework))).toContain(CODE_ENTRY[framework]);
    }
  });
});

describe('un iframe con dei file è un code frame', () => {
  it('i file vincono su indirizzo e HTML', () => {
    expect(sourceOf({ url: '', html: '', files: { 'App.tsx': 'x' } })).toBe('code');
    expect(sourceOf({ url: '', html: '<b>', files: {} })).toBe('html');
  });

  it('frameOf legge framework e file dalla riga', () => {
    const frame = frameOf({ id: 'n1', type: 'iframe', data: { framework: 'svelte', files: { 'App.svelte': '<h1>hi</h1>' } } });

    expect(frame).toMatchObject({ source: 'code', framework: Framework.Svelte, files: { 'App.svelte': '<h1>hi</h1>' } });
  });

  it('isCodeFiles rifiuta valori che non sono testo', () => {
    expect(isCodeFiles({ 'App.tsx': 'x' })).toBe(true);
    expect(isCodeFiles({ 'App.tsx': 1 })).toBe(false);
  });
});

describe('validateNodeData — code frame', () => {
  it('accetta un frame React con più file', () => {
    const out = validateNodeData('iframe', { framework: 'react', files: { 'App.tsx': 'x', 'pages/Home.tsx': 'y' } });
    expect(out.ok).toBe(true);
  });

  it('rifiuta un framework sconosciuto', () => {
    expect(validateNodeData('iframe', { framework: 'vue', files: { 'App.vue': 'x' } }).ok).toBe(false);
  });

  it("rifiuta file senza il file d'ingresso del framework", () => {
    expect(validateNodeData('iframe', { framework: 'svelte', files: { 'Home.svelte': 'x' } }).ok).toBe(false);
  });

  it('accetta html, il campo che la tile legge', () => {
    expect(validateNodeData('iframe', { html: '<b>ciao</b>' }).ok).toBe(true);
  });
});

describe('un code frame aggiunto dalla barra', () => {
  it('nasce come React con il file di partenza', async () => {
    const { newNodeRow } = await import('$lib/canvas-node-data');
    const row = newNodeRow('iframe');

    expect(row).toMatchObject({ framework: Framework.React, files: starterFiles(Framework.React) });
    expect(validateNodeData('iframe', row).ok).toBe(true);
  });
});
