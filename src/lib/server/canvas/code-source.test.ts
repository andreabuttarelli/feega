import { describe, expect, it } from 'vitest';
import { codeVarsError, declaredVars } from './code-source';
import { VarType } from '$lib/canvas/code-vars';

const REACT = {
  'App.tsx': `import Hero from './Hero';
const gap = feega.var('gap', { type: 'range', min: 0, max: 64, step: 4, default: 24, label: 'Gap' });
export default function App() { return <main style={{ gap }}><Hero /></main>; }`,
  'Hero.tsx': `export default function Hero() {
  return <h1 style={{ color: feega.color('accent', '#ff5100') }}>{feega.text('heroTitle', 'Build faster')}</h1>;
}`
};

const SVELTE = {
  'App.svelte': `<script lang="ts">
  const plan = feega.var('plan', { type: 'select', options: ['monthly', 'yearly'], default: 'monthly' });
</script>
<h1 style:color={feega.color('accent', '#7c3aed')}>{feega.longtext('intro', 'Plan less.')}</h1>
<p>{plan}</p>`
};

describe('le variabili dichiarate nel codice', () => {
  it('React: forma completa e scorciatoie, in più file', () => {
    expect(declaredVars(REACT)).toEqual([
      { name: 'gap', type: VarType.Range, min: 0, max: 64, step: 4, default: 24, label: 'Gap' },
      { name: 'accent', type: VarType.Color, default: '#ff5100' },
      { name: 'heroTitle', type: VarType.Text, default: 'Build faster' }
    ]);
  });

  it('Svelte: nello script e nel template', () => {
    expect(declaredVars(SVELTE).map((d) => [d.name, d.type])).toEqual([
      ['plan', VarType.Select],
      ['accent', VarType.Color],
      ['intro', VarType.LongText]
    ]);
  });
});

describe('una scrittura di vars contro le dichiarazioni', () => {
  it('passa quando ogni valore rispetta il suo tipo', () => {
    expect(codeVarsError('iframe', { framework: 'react', files: REACT, vars: { gap: 32, accent: '#000000' } })).toBeNull();
  });

  it('rifiuta un colore non valido e una variabile non dichiarata', () => {
    expect(codeVarsError('iframe', { framework: 'react', files: REACT, vars: { accent: 'blue' } })).toContain('hex');
    expect(codeVarsError('iframe', { framework: 'react', files: REACT, vars: { nope: 1 } })).toContain('nope');
  });

  it('rifiuta un range fuori dai limiti e una opzione fuori elenco', () => {
    expect(codeVarsError('iframe', { framework: 'react', files: REACT, vars: { gap: 100 } })).toContain('between 0 and 64');
    expect(codeVarsError('iframe', { framework: 'svelte', files: SVELTE, vars: { plan: 'weekly' } })).toContain('monthly, yearly');
  });

  it('non guarda gli altri tipi di nodo', () => {
    expect(codeVarsError('text', { vars: { x: 1 } })).toBeNull();
  });
});
