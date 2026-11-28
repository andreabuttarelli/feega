import { describe, expect, it } from 'vitest';
import { TEXT_TAGS, isTextTag, retag } from './retag';

const reading = (files: Record<string, string>) => async (path: string) => files[path] ?? null;

const run = async (file: string, text: string, line: number, col: number, to: string) => {
  const out = await retag(reading({ [file]: text }), { file, line, col }, to);
  return out.ok ? out.change.after : out;
};

describe('retag', () => {
  it('renames both tags in a Svelte file and keeps attributes and children', async () => {
    const text = '<main>\n  <p class="lead" id="x">Hello <b>you</b></p>\n</main>\n';
    expect(await run('a.svelte', text, 2, 3, 'h2')).toBe('<main>\n  <h2 class="lead" id="x">Hello <b>you</b></h2>\n</main>\n');
  });

  it('renames in JSX and TSX', async () => {
    const text = 'export const A = () => (\n  <div>\n    <h1 className="t">{title}</h1>\n  </div>\n);\n';
    expect(await run('A.tsx', text, 3, 5, 'h3')).toBe('export const A = () => (\n  <div>\n    <h3 className="t">{title}</h3>\n  </div>\n);\n');
  });

  it('renames in a Vue template', async () => {
    const text = '<template>\n  <span :class="c">{{ n }}</span>\n</template>\n';
    expect(await run('A.vue', text, 2, 3, 'p')).toBe('<template>\n  <p :class="c">{{ n }}</p>\n</template>\n');
  });

  it('renames in Astro and plain HTML', async () => {
    expect(await run('a.astro', '---\n---\n<label for="a">A</label>\n', 3, 1, 'span')).toBe('---\n---\n<span for="a">A</span>\n');
    expect(await run('a.html', '<blockquote>Q</blockquote>\n', 1, 1, 'p')).toBe('<p>Q</p>\n');
  });

  it('renames the matching close of nested same-name tags', async () => {
    const text = '<div><span>a <span>b</span> c</span><span>d</span></div>\n';
    expect(await run('a.html', text, 1, 6, 'em')).toBe('<div><em>a <span>b</span> c</em><span>d</span></div>\n');
    expect(await run('a.html', text, 1, 14, 'em')).toBe('<div><span>a <em>b</em> c</span><span>d</span></div>\n');
  });

  it('keeps a multiline opening tag as it is', async () => {
    const text = '<p\n  class="a"\n  data-x={a > b}\n>\n  Hi\n</p>\n';
    expect(await run('a.svelte', text, 1, 1, 'h4')).toBe('<h4\n  class="a"\n  data-x={a > b}\n>\n  Hi\n</h4>\n');
  });

  it('refuses a component, a self-closing tag and a tag outside the set', async () => {
    expect((await run('a.svelte', '<Heading>Hi</Heading>\n', 1, 1, 'h2')).ok).toBe(false);
    expect((await run('a.svelte', '<img src="a" />\n', 1, 1, 'p')).ok).toBe(false);
    expect((await run('a.svelte', '<div>Hi</div>\n', 1, 1, 'p')).ok).toBe(false);
  });

  it('refuses a target tag outside the set', async () => {
    expect((await run('a.svelte', '<p>Hi</p>\n', 1, 1, 'div')).ok).toBe(false);
  });

  it('refuses a missing file and a position that is not a tag', async () => {
    expect((await retag(reading({}), { file: 'x.svelte', line: 1, col: 1 }, 'h1')).ok).toBe(false);
    expect((await run('a.svelte', '<p>Hi</p>\n', 1, 4, 'h1')).ok).toBe(false);
  });

  it('does nothing when the tag is already the one asked', async () => {
    expect((await run('a.svelte', '<p>Hi</p>\n', 1, 1, 'p')).ok).toBe(false);
  });

  it('lists every tag the picker offers', () => {
    expect([...TEXT_TAGS]).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label', 'blockquote', 'strong', 'em', 'small']);
    expect(isTextTag('h2')).toBe(true);
    expect(isTextTag('Heading')).toBe(false);
  });
});
