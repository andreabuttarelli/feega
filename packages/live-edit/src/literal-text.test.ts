import { describe, expect, it } from 'vitest';
import { literalText } from './literal-text';

const FILE = 'src/Hero.svelte';
const SOURCE = `<section class="hero">
  <h1 class="title">
    Ship faster
  </h1>
  <p>{subtitle}</p>
  <a href="/">Get <b>started</b></a>
</section>
`;

const read = async () => SOURCE;

describe('literalText', () => {
  it('rewrites only the literal text, keeping the whitespace around it', async () => {
    const out = await literalText(read, { file: FILE, line: 2, col: 3 }, 'Ship today');

    expect(out.ok).toBe(true);
    const after = out.ok ? out.change.after : '';
    expect(after.split('\n').filter((l, i) => l !== SOURCE.split('\n')[i])).toEqual(['    Ship today']);
  });

  it('refuses an expression and says where it is', async () => {
    const out = await literalText(read, { file: FILE, line: 5, col: 3 }, 'x');

    expect(out).toEqual({ ok: false, reason: 'the text comes from {subtitle}', at: { file: FILE, line: 5, col: 6 } });
  });

  it('refuses text mixed with markup', async () => {
    const out = await literalText(read, { file: FILE, line: 6, col: 3 }, 'x');

    expect(out.ok).toBe(false);
  });
});
