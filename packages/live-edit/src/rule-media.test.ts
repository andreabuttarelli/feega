import { describe, expect, it } from 'vitest';
import { scopedRule } from './scoped-rule';
import { selectorInBody } from './scoped-rule';

const at = { file: 'src/lib/Hero.svelte', line: 1, col: 1 };

const SOURCE = `<p class="lead">x</p>

<style>
  .lead {
    padding: 8px;
  }
</style>
`;

const write = async (source: string, css: Record<string, string>, media: string | null) => {
  const out = await scopedRule(async () => source, at, css, undefined, undefined, undefined, undefined, media);
  return out.ok ? out.change.after : out.reason;
};

describe('a rule at a media query', () => {
  it('adds a media block with the class rule', async () => {
    const after = await write(SOURCE, { 'font-size': '20px' }, '(min-width: 768px)');
    expect(after).toContain('  @media (min-width: 768px) {\n    .lead {\n      font-size: 20px;\n    }\n  }');
    expect(after).toContain('.lead {\n    padding: 8px;\n  }');
  });

  it('updates the rule inside an existing media block', async () => {
    const first = (await write(SOURCE, { 'font-size': '20px' }, '(min-width: 768px)')) as string;
    const after = (await write(first, { 'font-size': '24px', color: 'red' }, '(min-width:768px)')) as string;
    expect(after.match(/@media/g)).toHaveLength(1);
    expect(after).toContain('font-size: 24px;');
    expect(after).toContain('color: red;');
    expect(after).not.toContain('20px');
  });

  it('writes the base rule, not the media one, for all sizes', async () => {
    const first = (await write(SOURCE, { 'font-size': '20px' }, '(min-width: 768px)')) as string;
    const after = (await write(first, { padding: '4px' }, null)) as string;
    expect(after).toContain('.lead {\n    padding: 4px;\n  }');
    expect(after).toContain('font-size: 20px;');
  });

  it('removes the media block when its last declaration goes', async () => {
    const first = (await write(SOURCE, { 'font-size': '20px' }, '(min-width: 768px)')) as string;
    const after = (await write(first, { 'font-size': '' }, '(min-width: 768px)')) as string;
    expect(after).not.toContain('@media');
  });

  it('keeps other media blocks apart', async () => {
    const first = (await write(SOURCE, { 'font-size': '20px' }, '(min-width: 768px)')) as string;
    const after = (await write(first, { 'font-size': '30px' }, '(min-width: 1024px)')) as string;
    expect(after.match(/@media/g)).toHaveLength(2);
    expect(after).toContain('font-size: 20px;');
    expect(after).toContain('font-size: 30px;');
  });
});

describe('a module stylesheet rule at a media query', () => {
  it('nests one level, from column zero', () => {
    const out = selectorInBody('.a {\n  x: 1;\n}\n', '.a', new Map([['y', '2']]), undefined, '', '(min-width: 640px)');
    expect(out).toBe('.a {\n  x: 1;\n}\n\n@media (min-width: 640px) {\n  .a {\n    y: 2;\n  }\n}\n');
  });
});
