import { describe, expect, it } from 'vitest';
import { ElementState } from './element-state';
import { classRule } from './class-rule';

const files = (all: Record<string, string>) => async (path: string) => all[path] ?? null;

describe('classRule', () => {
  it('replaces a declaration in the rule of a stylesheet class', async () => {
    const out = await classRule(files({ 'app.css': '.card {\n  padding: 8px;\n  margin: 0;\n}\n' }), { name: 'card', file: 'app.css' }, { padding: '16px' });

    expect(out).toEqual({ ok: true, changes: [{ path: 'app.css', before: '.card {\n  padding: 8px;\n  margin: 0;\n}\n', after: '.card {\n  padding: 16px;\n  margin: 0;\n}\n' }] });
  });

  it('writes the hover state as its own rule', async () => {
    const out = await classRule(files({ 'app.css': '.card { padding: 8px; }\n' }), { name: 'card', file: 'app.css' }, { color: 'red' }, undefined, ElementState.Hover);

    expect(out.ok && out.changes[0].after).toContain('.card:hover {\n  color: red;\n}');
  });

  it('writes inside a media query', async () => {
    const out = await classRule(files({ 'app.css': '.card { padding: 8px; }\n' }), { name: 'card', file: 'app.css' }, { padding: '4px' }, undefined, undefined, '(max-width: 600px)');

    expect(out.ok && out.changes[0].after).toContain('@media (max-width: 600px) {');
  });

  it('writes into the style block of a svelte component', async () => {
    const text = '<p class="card"></p>\n\n<style>\n  .card {\n    padding: 8px;\n  }\n</style>\n';
    const out = await classRule(files({ 'src/Card.svelte': text }), { name: 'card', file: 'src/Card.svelte' }, { padding: '20px' });

    expect(out.ok && out.changes[0].after).toBe('<p class="card"></p>\n\n<style>\n  .card {\n    padding: 20px;\n  }\n</style>\n');
  });

  it('picks the vue style block that holds the class', async () => {
    const text = '<style>\n.other { color: red; }\n</style>\n<style scoped>\n.card { padding: 8px; }\n</style>\n';
    const out = await classRule(files({ 'A.vue': text }), { name: 'card', file: 'A.vue' }, { padding: '1px' });

    expect(out.ok && out.changes[0].after).toContain('.card {\n  padding: 1px;\n}');
    expect(out.ok && out.changes[0].after).toContain('.other { color: red; }');
  });

  it('removes a declaration set to empty', async () => {
    const out = await classRule(files({ 'app.css': '.card {\n  padding: 8px;\n  margin: 0;\n}\n' }), { name: 'card', file: 'app.css' }, { padding: '' });

    expect(out.ok && out.changes[0].after).toBe('.card {\n  margin: 0;\n}\n');
  });

  it('refuses a file it cannot read or a kind without a stylesheet', async () => {
    expect(await classRule(files({}), { name: 'card', file: 'app.css' }, { color: 'red' })).toMatchObject({ ok: false });
    expect(await classRule(files({ 'a.tsx': 'x' }), { name: 'card', file: 'a.tsx' }, { color: 'red' })).toMatchObject({ ok: false });
  });
});
