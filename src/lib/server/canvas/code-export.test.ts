import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { exportFiles } from './code-export';
import { zipFolder } from '$lib/canvas/code-zip';
import { ExportMode, Framework } from '$lib/canvas/code-frame';

const versionOf = async (pkg: string) => ({ 'framer-motion': '12.0.0', 'react-router-dom': '7.6.0', gsap: '3.13.0' })[pkg] ?? '1.0.0';

const REACT = {
  'App.tsx': `import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Home from './pages/Home';
export default function App() {
  return (
    <MemoryRouter initialEntries={[feega.route]}>
      <Routes><Route path="/" element={<Home />} /></Routes>
    </MemoryRouter>
  );
}`,
  'pages/Home.tsx': `export default function Home() {
  const gap = feega.var('gap', { type: 'range', min: 0, max: 64, step: 4, default: 24 });
  return <h1 style={{ gap, color: feega.color('accent', '#ff5100') }} data-testid="t">{feega.text('heroTitle', 'Build faster')}</h1>;
}`
};

const SVELTE = {
  'App.svelte': `<script lang="ts">
  import { fly } from 'svelte/transition';
</script>
<h1 in:fly={{ y: 20 }} style:color={feega.color('accent', '#7c3aed')}>{feega.text('title', 'Plan less.')}</h1>`,
  'pages/About.svelte': `<p>{feega.longtext('story', 'We are six.')}</p>`
};

const FEEGA = /\bfeega\b/;

describe('esportare un code frame React', () => {
  it('in linea: ogni chiamata diventa il valore corrente, nessun feega rimane', async () => {
    const out = await exportFiles({ framework: Framework.React, files: REACT, vars: { heroTitle: 'Ship it', gap: 32 } }, ExportMode.Inline, versionOf);

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const home = out.files['src/pages/Home.tsx'];
    expect(home).toContain('"Ship it"');
    expect(home).toContain('32');
    expect(home).toContain('"#ff5100"');
    expect(Object.values(out.files).some((f) => FEEGA.test(f))).toBe(false);
  });

  it('il router in memoria diventa BrowserRouter', async () => {
    const out = await exportFiles({ framework: Framework.React, files: REACT, vars: {} }, ExportMode.Inline, versionOf);
    if (!out.ok) throw new Error(out.error);

    expect(out.files['src/App.tsx']).toContain('<BrowserRouter>');
    expect(out.files['src/App.tsx']).not.toContain('MemoryRouter');
    expect(out.files['src/App.tsx']).not.toContain('initialEntries');
  });

  it('package.json porta i pacchetti importati con la loro versione', async () => {
    const out = await exportFiles({ framework: Framework.React, files: REACT, vars: {} }, ExportMode.Inline, versionOf);
    if (!out.ok) throw new Error(out.error);
    const pkg = JSON.parse(out.files['package.json']);

    expect(pkg.dependencies).toMatchObject({ react: '19.1.0', 'react-dom': '19.1.0', 'framer-motion': '^12.0.0', 'react-router-dom': '^7.6.0', gsap: '^3.13.0' });
    expect(pkg.scripts.build).toBe('vite build');
    expect(out.files['index.html']).toContain('/src/main.tsx');
  });

  it('come configurazione: i valori stanno in src/content.ts e i file lo importano', async () => {
    const out = await exportFiles({ framework: Framework.React, files: REACT, vars: { heroTitle: 'Ship it' } }, ExportMode.Config, versionOf);
    if (!out.ok) throw new Error(out.error);

    expect(out.files['src/content.ts']).toContain('"heroTitle": "Ship it"');
    expect(out.files['src/pages/Home.tsx']).toContain("import { content } from '../content';");
    expect(out.files['src/pages/Home.tsx']).toContain('content["heroTitle"]');
    expect(Object.values(out.files).some((f) => FEEGA.test(f))).toBe(false);
  });

  it('una chiamata con argomenti non letterali non si può esportare, e lo dice', async () => {
    const out = await exportFiles({ framework: Framework.React, files: { 'App.tsx': 'const k = "a"; export default () => feega.text(k, "x");' }, vars: {} }, ExportMode.Inline, versionOf);
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining('App.tsx') });
  });
});

describe('esportare un code frame Svelte', () => {
  it('in linea nel template, nessun feega rimane', async () => {
    const out = await exportFiles({ framework: Framework.Svelte, files: SVELTE, vars: { title: 'Ship more.' } }, ExportMode.Inline, versionOf);
    if (!out.ok) throw new Error(out.error);

    expect(out.files['src/App.svelte']).toContain('{"Ship more."}');
    expect(Object.values(out.files).some((f) => FEEGA.test(f))).toBe(false);
    expect(JSON.parse(out.files['package.json']).devDependencies).toHaveProperty('svelte');
  });

  it('come configurazione: lo script riceve l import, anche dove non c era uno script', async () => {
    const out = await exportFiles({ framework: Framework.Svelte, files: SVELTE, vars: {} }, ExportMode.Config, versionOf);
    if (!out.ok) throw new Error(out.error);

    expect(out.files['src/App.svelte']).toContain("import { content } from './content';");
    expect(out.files['src/pages/About.svelte']).toMatch(/<script lang="ts">\s*import \{ content \} from '..\/content';/);
  });
});

describe('lo zip', () => {
  it('contiene il progetto sotto una cartella col nome del frame', async () => {
    const out = await exportFiles({ framework: Framework.Svelte, files: SVELTE, vars: {} }, ExportMode.Inline, versionOf);
    if (!out.ok) throw new Error(out.error);
    const entries = unzipSync(zipFolder('orbit-site', out.files));

    expect(strFromU8(entries['orbit-site/src/App.svelte'])).toContain('Plan less.');
  });
});
