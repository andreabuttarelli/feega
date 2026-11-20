import { describe, expect, it } from 'vitest';
import { cssModuleRule } from './css-module';
import { ElementState } from './element-state';
import { Scope, scopedRule } from './scoped-rule';

const files = (all: Record<string, string>) => async (path: string) => all[path] ?? null;

const HERO = `import styles from './Hero.module.css';

export function Hero() {
  return (
    <button className={styles.hero}>
      Go
    </button>
  );
}
`;

const CSS = `.hero {
  padding: 8px;
}
`;

const SVELTE = `<button class="cta">Go</button>

<style>
  .cta {
    padding: 8px;
  }
</style>
`;

const HERO_AT = { file: 'src/Hero.jsx', line: 5, col: 5 };
const CTA_AT = { file: 'src/Cta.svelte', line: 1, col: 1 };

async function moduleCss(css: string, declarations: Record<string, string>, state: ElementState) {
  const out = await cssModuleRule(files({ 'src/Hero.jsx': HERO, 'src/Hero.module.css': css }), HERO_AT, declarations, undefined, Scope.Element, undefined, state);
  return out.ok ? out.changes.find((c) => c.path === 'src/Hero.module.css')?.after : out.reason;
}

async function scoped(source: string, declarations: Record<string, string>) {
  const out = await scopedRule(files({ 'src/Cta.svelte': source }), CTA_AT, declarations, undefined, Scope.Element, undefined, ElementState.Hover);
  return out.ok ? out.change.after : out.reason;
}

describe('a state rule in a css module', () => {
  it('adds a :hover rule next to the base rule of the element class', async () => {
    expect(await moduleCss(CSS, { background: 'red' }, ElementState.Hover)).toBe('.hero {\n  padding: 8px;\n}\n\n.hero:hover {\n  background: red;\n}\n');
  });

  it('reuses the existing :hover rule', async () => {
    const css = `${CSS}\n.hero:hover {\n  background: blue;\n  color: white;\n}\n`;

    expect(await moduleCss(css, { background: 'red' }, ElementState.Hover)).toBe(`${CSS}\n.hero:hover {\n  background: red;\n  color: white;\n}\n`);
  });

  it('a reset removes only the state declaration, and the rule once empty', async () => {
    const css = `${CSS}\n.hero:hover {\n  background: blue;\n}\n`;

    expect((await moduleCss(css, { background: '' }, ElementState.Hover))?.trim()).toBe(CSS.trim());
  });

  it('writes the other states with their own pseudo class', async () => {
    expect(await moduleCss(CSS, { outline: '2px solid red' }, ElementState.FocusVisible)).toContain('.hero:focus-visible {');
  });
});

describe('a state rule in a scoped style block', () => {
  it('adds a :hover rule for the element class and leaves the base rule alone', async () => {
    const after = await scoped(SVELTE, { background: 'red' });

    expect(after).toContain('.cta {\n    padding: 8px;\n  }');
    expect(after).toContain('.cta:hover {\n    background: red;\n  }');
  });

  it('keeps inline declarations out of the state rule', async () => {
    const after = await scoped(SVELTE.replace('<button class="cta">', '<button class="cta" style="margin: 4px">'), { background: 'red' });

    expect(after).toContain('style="margin: 4px"');
    expect(after).not.toMatch(/\.cta:hover \{[^}]*margin/);
  });

  it('gives an element without a class its own class for the state rule', async () => {
    const after = await scoped('<button>Go</button>\n', { background: 'red' });

    expect(after).toContain('class="cta-button"');
    expect(after).toContain('.cta-button:hover {');
  });
});
