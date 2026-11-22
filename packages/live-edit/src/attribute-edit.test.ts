import { describe, expect, it } from 'vitest';
import { attributeWrite, isEditableAttribute } from './attribute-edit';

const reading = (files: Record<string, string>) => async (path: string) => files[path] ?? null;
const AT = { file: 'a.html', line: 1, col: 1 };

describe('isEditableAttribute', () => {
  it('accepts data attributes and the content attributes', () => {
    expect(['data-speed', 'src', 'srcset', 'sizes', 'alt', 'title', 'aria-label', 'placeholder', 'poster'].every(isEditableAttribute)).toBe(true);
  });

  it('leaves the structural attributes to their own controls', () => {
    expect(['class', 'style', 'id', 'href', 'onclick', 'data-feega-at'].some(isEditableAttribute)).toBe(false);
  });
});

describe('attributeWrite', () => {
  it('changes a quoted data attribute', async () => {
    const files = { 'a.html': '<section data-speed="0.9" class="x">\n</section>\n' };
    const out = await attributeWrite(reading(files), AT, 'data-speed', '2');
    expect(out.ok && out.change.after).toBe('<section data-speed="2" class="x">\n</section>\n');
  });

  it('adds an attribute the source does not have yet', async () => {
    const files = { 'a.html': '<section class="x"></section>\n' };
    const out = await attributeWrite(reading(files), AT, 'data-boost', '5');
    expect(out.ok && out.change.after).toContain('data-boost="5"');
  });

  it('changes an img src written as a string in braces', async () => {
    const files = { 'a.tsx': 'const a = <img src={"/a.jpg"} alt="" />;\n' };
    const out = await attributeWrite(reading(files), { file: 'a.tsx', line: 1, col: 11 }, 'src', '/b.jpg');
    expect(out.ok && out.change.after).toBe('const a = <img src="/b.jpg" alt="" />;\n');
  });

  it('refuses a value that comes from an expression', async () => {
    const files = { 'a.tsx': 'const a = <img src={card.src} />;\n' };
    const out = await attributeWrite(reading(files), { file: 'a.tsx', line: 1, col: 11 }, 'src', '/b.jpg');
    expect(out.ok).toBe(false);
  });

  it('refuses a Vue bound attribute instead of adding a duplicate', async () => {
    const files = { 'a.vue': '<template>\n  <img :src="card.src" />\n</template>\n' };
    const out = await attributeWrite(reading(files), { file: 'a.vue', line: 2, col: 3 }, 'src', '/b.jpg');
    expect(out.ok).toBe(false);
  });

  it('refuses a Svelte shorthand attribute', async () => {
    const files = { 'a.svelte': '<img {src} />\n' };
    const out = await attributeWrite(reading(files), { file: 'a.svelte', line: 1, col: 1 }, 'src', '/b.jpg');
    expect(out.ok).toBe(false);
  });

  it('refuses an attribute outside the editable set', async () => {
    const out = await attributeWrite(reading({ 'a.html': '<p onclick="x()">a</p>\n' }), AT, 'onclick', 'y()');
    expect(out.ok).toBe(false);
  });

  it('drops a literal srcset and sizes when src changes', async () => {
    const source = '<img src="/a.jpg" srcset="/a.jpg 1x, /a2.jpg 2x" sizes="100vw" alt="" />\n';
    const out = await attributeWrite(reading({ 'a.html': source }), AT, 'src', '/b.jpg');
    expect(out.ok && out.change.after).toBe('<img src="/b.jpg" alt="" />\n');
  });

  it('refuses a src change when srcset is an expression', async () => {
    const files = { 'a.tsx': 'const a = <img src="/a.jpg" srcset={card.set} />;\n' };
    const out = await attributeWrite(reading(files), { file: 'a.tsx', line: 1, col: 11 }, 'src', '/b.jpg');
    expect(!out.ok && out.reason).toContain('srcset');
  });

  it('keeps srcset when another attribute changes', async () => {
    const source = '<img src="/a.jpg" srcset="/a.jpg 1x" alt="" />\n';
    const out = await attributeWrite(reading({ 'a.html': source }), AT, 'alt', 'x');
    expect(out.ok && out.change.after).toContain('srcset="/a.jpg 1x"');
  });

  it('edits srcset itself without touching src', async () => {
    const source = '<img src="/a.jpg" srcset="/a.jpg 1x" />\n';
    const out = await attributeWrite(reading({ 'a.html': source }), AT, 'srcset', '/b.jpg 1x');
    expect(out.ok && out.change.after).toBe('<img src="/a.jpg" srcset="/b.jpg 1x" />\n');
  });
});
