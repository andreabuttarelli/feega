import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PageTarget } from '@feega/live-edit/page-rule';
import { Scope } from '@feega/live-edit/scoped-rule';
import { UNKNOWN_CAUSES, classOpen, impactOf, ImpactKind, nameOf, type ImpactAsk } from './impact';
import { fileEdits } from './file-edits';
import { usageIndex } from './usages';

const FIXTURES = join(__dirname, 'impact-fixtures');

function at(app: string, file: string, needle: string): string {
  const lines = readFileSync(join(FIXTURES, app, file), 'utf8').split('\n');
  const line = lines.findIndex((l) => l.includes(needle));
  return `${file}:${line + 1}:${lines[line].indexOf(needle) + 1}`;
}

const classify = (app: string, ask: ImpactAsk) => {
  const root = join(FIXTURES, app);
  return impactOf(root, ask, fileEdits(root).targets, usageIndex(root));
};

describe('impactOf in React', () => {
  it('un elemento in un file che nessuno importa e locale', async () => {
    expect(await classify('react', { at: at('react', 'src/components/Card.tsx', '<div') })).toEqual({ kind: ImpactKind.Local });
  });

  it('un elemento in un componente usato altrove e del componente', async () => {
    const impact = await classify('react', { at: at('react', 'src/components/Button.tsx', '<button') });

    expect(impact).toMatchObject({ kind: ImpactKind.Component, name: 'Button' });
    expect(impact.kind === ImpactKind.Component && impact.files.map((f) => f.file).sort()).toEqual(['src/pages/Checkout.tsx', 'src/pages/Home.tsx', 'src/pages/Pricing.tsx']);
  });

  it('la sezione della pagina di checkout e locale anche se contiene un componente', async () => {
    expect(await classify('react', { at: at('react', 'src/pages/Checkout.tsx', '<section') })).toEqual({ kind: ImpactKind.Local });
  });

  it('una classe passata da cn() e ignota, anche in un componente condiviso', async () => {
    expect(await classify('react', { at: at('react', 'src/components/Tag.tsx', '<span') })).toEqual({ kind: ImpactKind.Unknown, reason: 'the class comes from props or a function' });
  });

  it('una regola che finisce in un CSS globale e ignota', async () => {
    expect(await classify('react', { at: at('react', 'src/components/Hero.tsx', '<section') })).toEqual({ kind: ImpactKind.Unknown, reason: 'the rule lands in a global stylesheet' });
  });

  it('una pagina intera scrive nel CSS globale', async () => {
    expect(await classify('react', { at: at('react', 'src/components/Card.tsx', '<div'), page: PageTarget.Body })).toEqual({ kind: ImpactKind.Unknown, reason: 'the rule lands in a global stylesheet' });
  });

  it('un valore che e una variabile CSS e ignoto', async () => {
    expect(await classify('react', { at: at('react', 'src/components/Card.tsx', '<div'), value: 'var(--brand)' })).toEqual({ kind: ImpactKind.Unknown, reason: 'a CSS variable can reach other elements' });
  });

  it('un elemento che il file non contiene e ignoto', async () => {
    expect(await classify('react', { at: 'src/components/Card.tsx:99:1' })).toEqual({ kind: ImpactKind.Unknown, reason: 'the element is not where the page says' });
  });

  it('lo scope classe non cambia la risposta di un file locale', async () => {
    expect(await classify('react', { at: at('react', 'src/components/Card.tsx', '<div'), scope: Scope.Class })).toEqual({ kind: ImpactKind.Local });
  });
});

describe('impactOf in Svelte', () => {
  it('il componente in $lib e condiviso da due pagine', async () => {
    expect(await classify('svelte', { at: 'src/lib/Button.svelte:1:1' })).toMatchObject({ kind: ImpactKind.Component, name: 'Button' });
  });

  it('un elemento della pagina e locale', async () => {
    expect(await classify('svelte', { at: at('svelte', 'src/routes/+page.svelte', '<h1') })).toEqual({ kind: ImpactKind.Local });
  });
});

describe('impactOf in Vue', () => {
  it('il componente base e condiviso da due viste', async () => {
    const impact = await classify('vue', { at: at('vue', 'src/components/BaseButton.vue', '<button') });

    expect(impact).toMatchObject({ kind: ImpactKind.Component, name: 'BaseButton' });
    expect(impact.kind === ImpactKind.Component && impact.files).toHaveLength(2);
  });

  it('il componente radice e locale', async () => {
    expect(await classify('vue', { at: at('vue', 'src/App.vue', '<main') })).toEqual({ kind: ImpactKind.Local });
  });
});

describe('UNKNOWN_CAUSES', () => {
  it.each([
    ['<span className={cn("a", className)}>', true],
    ['<span className={`a ${b}`}>', true],
    ['<div :class="{ on: active }">', true],
    ['<div class:active={on}>', true],
    ['<div class="a {b}">', true],
    ['<button {...props}>', true],
    ['<span className={"a b"}>', false],
    ['<div className={styles.card}>', false],
    ['<div className={styles.a + " b"}>', true],
    ['<span className="a b">', false],
    ['<div class="a b">', false],
    ['<div>', false]
  ])('classOpen(%s) -> computed %s', (open, computed) => {
    expect(classOpen(open)).toBe(computed);
  });

  it('ogni causa ha una frase diversa', () => {
    expect(new Set(UNKNOWN_CAUSES.map((c) => c.reason)).size).toBe(UNKNOWN_CAUSES.length);
  });
});

describe('nameOf', () => {
  it.each([
    ['src/components/Button.tsx', 'Button'],
    ['src/lib/base-button.svelte', 'BaseButton'],
    ['src/components/Card/index.tsx', 'Card'],
    ['src/routes/+page.svelte', 'Page']
  ])('%s -> %s', (file, name) => {
    expect(nameOf(file)).toBe(name);
  });
});
