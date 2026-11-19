import { describe, expect, it } from 'vitest';
import { Scope, scopedRule } from './scoped-rule';

const FILE = 'src/lib/Hero.svelte';
const at = (line: number) => ({ file: FILE, line, col: 3 });
const readOf = (text: string) => async () => text;

const WITH_STYLE = `<section>
  <p class="lead">Text</p>
  <h1>Title</h1>
  <span style="color: red; margin: 0">x</span>
</section>

<style>
  .lead {
    font-size: 14px;
  }
</style>
`;

const RESPONSIVE = `<p class="lead">x</p>

<style>
  .lead {
    padding: 8px;
  }

  @media (min-width: 1200px) {
    .lead {
      padding: 20px;
    }
  }

  @media (max-width: 600px) {
    .lead {
      padding: 4px;
    }
  }
</style>
`;

const NO_STYLE = `<div>
  <h1>Title</h1>
</div>
`;

async function after(text: string, line: number, css: Record<string, string>, scope = Scope.Element) {
  const out = await scopedRule(readOf(text), at(line), css, undefined, scope);
  if (!out.ok) {
    throw new Error(out.reason);
  }
  return out.change.after;
}

describe('scopedRule', () => {
  it('class scope puts the declaration in the class rule', async () => {
    const text = await after(WITH_STYLE, 2, { color: '#0078d4' }, Scope.Class);

    expect(text).toContain('  .lead {\n    font-size: 14px;\n    color: #0078d4;\n  }');
    expect(text).toContain('<p class="lead">Text</p>');
  });

  it('a declaration already there is replaced, not repeated', async () => {
    const text = await after(WITH_STYLE, 2, { 'font-size': '20px' }, Scope.Class);

    expect(text).toContain('  .lead {\n    font-size: 20px;\n  }');
  });

  it('an element without a class gets a readable one and a new rule', async () => {
    const text = await after(WITH_STYLE, 3, { 'font-weight': '700' });

    expect(text).toContain('<h1 class="hero-h1">Title</h1>');
    expect(text).toContain('  .hero-h1 {\n    font-weight: 700;\n  }\n</style>');
  });

  it('a component without a style block gets one', async () => {
    const text = await after(NO_STYLE, 2, { color: '#0078d4' });

    expect(text).toBe(`<div>
  <h1 class="hero-h1">Title</h1>
</div>

<style>
  .hero-h1 {
    color: #0078d4;
  }
</style>
`);
  });

  it('a generated class never collides with one already in the file', async () => {
    const taken = NO_STYLE.replace('<div>', '<div class="hero-h1">');
    const text = await after(taken, 2, { color: 'red' });

    expect(text).toContain('<h1 class="hero-h1-2">');
  });

  it('inline styles from earlier edits move into the rule', async () => {
    const text = await after(WITH_STYLE, 4, { color: 'blue' });

    expect(text).toContain('<span class="hero-span">x</span>');
    expect(text).toContain('  .hero-span {\n    color: blue;\n    margin: 0;\n  }');
  });

  it('edits the rule that applies at that width, not the base one', async () => {
    const out = await scopedRule(readOf(RESPONSIVE), { file: FILE, line: 1, col: 1 }, { 'padding-left': '24px' }, 1440, Scope.Class);
    const text = out.ok ? out.change.after : '';

    expect(text).toContain('    .lead {\n      padding: 20px;\n      padding-left: 24px;\n    }');
    expect(text).toContain('  .lead {\n    padding: 8px;\n  }');
  });

  it('at a width no media rule matches, the base rule', async () => {
    const out = await scopedRule(readOf(RESPONSIVE), { file: FILE, line: 1, col: 1 }, { color: 'red' }, 900, Scope.Class);

    expect(out.ok && out.change.after).toContain('  .lead {\n    padding: 8px;\n    color: red;\n  }');
  });

  it('element scope gives a shared-class element its own class and rule, the shared rule untouched', async () => {
    const out = await scopedRule(readOf(WITH_STYLE), at(2), { color: 'red' }, undefined, Scope.Element);
    const text = out.ok ? out.change.after : '';

    expect(text).toContain('<p class="lead hero-p">Text</p>');
    expect(text).toContain('  .lead {\n    font-size: 14px;\n  }');
    expect(text).toContain('  .hero-p {\n    color: red;\n  }');
  });

  it('element scope reuses the element class it added before', async () => {
    const once = await scopedRule(readOf(WITH_STYLE), at(2), { color: 'red' }, undefined, Scope.Element);
    const twice = await scopedRule(readOf(once.ok ? once.change.after : ''), at(2), { color: 'blue' }, undefined, Scope.Element);
    const text = twice.ok ? twice.change.after : '';

    expect(text).toContain('<p class="lead hero-p">Text</p>');
    expect(text).toContain('  .hero-p {\n    color: blue;\n  }');
  });

  it('a class expression is refused', async () => {
    const out = await scopedRule(readOf('<p class={cls}>x</p>\n'), { file: FILE, line: 1, col: 1 }, { color: 'red' });

    expect(out.ok).toBe(false);
  });
});
