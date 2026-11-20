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
    const after = out.ok ? out.changes[0].after : '';
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

  it('writes the new text into the constant a child reads', async () => {
    const page = `const TITLE = 'Plan launches';\n\nexport const Hero = () => (\n  <h1>{TITLE}</h1>\n);\n`;
    const out = await literalText(async () => page, { file: 'src/Hero.tsx', line: 4, col: 3 }, 'Plan better launches');

    expect(out).toEqual({ ok: true, changes: [{ path: 'src/Hero.tsx', before: page, after: page.replace('Plan launches', 'Plan better launches') }] });
  });

  it('writes the new text into a constant imported from another file', async () => {
    const page = `import { TITLE } from './copy';\nexport const Hero = () => <h1>{TITLE}</h1>;\n`;
    const copy = `export const TITLE = "Plan launches";\n`;
    const all: Record<string, string> = { 'src/Hero.tsx': page, 'src/copy.ts': copy };
    const out = await literalText(async (p) => all[p] ?? null, { file: 'src/Hero.tsx', line: 2, col: 27 }, 'Ship');

    expect(out).toEqual({ ok: true, changes: [{ path: 'src/copy.ts', before: copy, after: `export const TITLE = "Ship";\n` }] });
  });

  it('refuses text that comes from a prop', async () => {
    const page = `export const Hero = ({ title }) => <h1>{title}</h1>;\n`;
    const out = await literalText(async () => page, { file: 'src/Hero.tsx', line: 1, col: 37 }, 'x');

    expect(out.ok).toBe(false);
  });

  it('refuses text read from a member of an object', async () => {
    const page = `const PLANS = [{ name: 'a' }];\nexport const Hero = () => <h1>{PLANS[0].name}</h1>;\n`;
    const out = await literalText(async () => page, { file: 'src/Hero.tsx', line: 2, col: 30 }, 'x');

    expect(out.ok).toBe(false);
  });

  it('writes a changed segment between inline elements and leaves the rest', async () => {
    const page = `<h1>Build <span class="hot">fast</span> today</h1>\n`;
    const was = 'Build fast today';
    const read = async () => page;
    const inSpan = await literalText(read, { file: FILE, line: 1, col: 1 }, 'Build faster today', was);
    const outside = await literalText(read, { file: FILE, line: 1, col: 1 }, 'Make fast today', was);

    expect(inSpan.ok && inSpan.changes[0].after).toBe(`<h1>Build <span class="hot">faster</span> today</h1>\n`);
    expect(outside.ok && outside.changes[0].after).toBe(`<h1>Make <span class="hot">fast</span> today</h1>\n`);
  });

  it('refuses a change that spans several segments', async () => {
    const page = `<h1>Build <span>fast</span> today</h1>\n`;
    const out = await literalText(async () => page, { file: FILE, line: 1, col: 1 }, 'Make slow today', 'Build fast today');

    expect(out.ok).toBe(false);
  });

  it('writes a line break for a newline typed with shift enter', async () => {
    const page = `<p>One two</p>\n`;
    const out = await literalText(async () => page, { file: FILE, line: 1, col: 1 }, 'One\ntwo');

    expect(out.ok && out.changes[0].after).toBe(`<p>One<br />two</p>\n`);
  });
});
