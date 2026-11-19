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

    expect(out).toEqual({ ok: false, reason: 'This text comes from `{subtitle}`.', at: { file: FILE, line: 5, col: 6 } });
  });

  it('points at the definition of the data an each block reads', async () => {
    const page = `<script>
  import { AGENT_LOGOS } from './home';
</script>

<ul>
  {#each AGENT_LOGOS as logo (logo.file)}<li>{logo.name}</li>{/each}
</ul>
`;
    const home = `export const TITLE = 'x';\n\nexport const AGENT_LOGOS = [\n  { file: 'a.svg' }\n];\n`;
    const all: Record<string, string> = { 'src/Page.svelte': page, 'src/home.ts': home };
    const out = await literalText(async (p) => all[p] ?? null, { file: 'src/Page.svelte', line: 5, col: 1 }, 'x');

    expect(out).toEqual({ ok: false, reason: 'This text comes from data: `AGENT_LOGOS` (home.ts:3).', at: { file: 'src/home.ts', line: 3, col: 14 } });
  });

  it('points at data declared in the same file', async () => {
    const page = `<script>\n  const items = ['a'];\n</script>\n\n<ul>{#each items as i}<li>{i}</li>{/each}</ul>\n`;
    const out = await literalText(async () => page, { file: 'src/Page.svelte', line: 5, col: 1 }, 'x');

    expect(out).toEqual({ ok: false, reason: 'This text comes from data: `items` (Page.svelte:2).', at: { file: 'src/Page.svelte', line: 2, col: 9 } });
  });

  it('refuses text mixed with markup', async () => {
    const out = await literalText(read, { file: FILE, line: 6, col: 3 }, 'x');

    expect(out.ok).toBe(false);
  });
});
