import { describe, expect, it } from 'vitest';
import { setAttributes } from './set-attributes';

const reading = (files: Record<string, string>) => async (path: string) => files[path] ?? null;

describe('setAttributes', () => {
  it('replaces an existing attribute and adds a new one', async () => {
    const files = { 'src/P.svelte': '<main>\n  <Scene shape="cube" />\n</main>\n' };
    const out = await setAttributes(reading(files), { file: 'src/P.svelte', line: 2, col: 3 }, { shape: 'sphere', material: 'glass' });
    expect(out).toEqual({ ok: true, change: { path: 'src/P.svelte', before: files['src/P.svelte'], after: '<main>\n  <Scene shape="sphere" material="glass" />\n</main>\n' } });
  });

  it('turns a brace expression into the plain string given', async () => {
    const files = { 'a.tsx': 'const a = <Scene shape={"cube"} />;\n' };
    const out = await setAttributes(reading(files), { file: 'a.tsx', line: 1, col: 11 }, { shape: 'torus' });
    expect(out.ok && out.change.after).toBe('const a = <Scene shape="torus" />;\n');
  });

  it('refuses when the position is not a tag', async () => {
    const out = await setAttributes(reading({ 'a.svelte': '<p>hi</p>\n' }), { file: 'a.svelte', line: 1, col: 4 }, { a: 'b' });
    expect(out.ok).toBe(false);
  });

  it('refuses a missing file', async () => {
    expect((await setAttributes(reading({}), { file: 'x.svelte', line: 1, col: 1 }, { a: 'b' })).ok).toBe(false);
  });

  it('refuses a value that would break the quotes', async () => {
    const out = await setAttributes(reading({ 'a.svelte': '<Scene />\n' }), { file: 'a.svelte', line: 1, col: 1 }, { a: 'x"y' });
    expect(out.ok).toBe(false);
  });

  it('finds the named tag inside the element at the position', async () => {
    const files = { 'a.svelte': '<main>\n  <h1>Hi</h1>\n  <Scene shape="cube" />\n  <Scene shape="torus" />\n</main>\n' };
    const out = await setAttributes(reading(files), { file: 'a.svelte', line: 1, col: 1 }, { shape: 'sphere' }, 'Scene');
    expect(out.ok && out.change.after).toBe('<main>\n  <h1>Hi</h1>\n  <Scene shape="sphere" />\n  <Scene shape="torus" />\n</main>\n');
  });

  it('does not take a longer tag that starts the same', async () => {
    const files = { 'a.svelte': '<main>\n  <SceneBox a="1" />\n  <Scene a="2" />\n</main>\n' };
    const out = await setAttributes(reading(files), { file: 'a.svelte', line: 1, col: 1 }, { a: '9' }, 'Scene');
    expect(out.ok && out.change.after).toContain('<SceneBox a="1" />');
    expect(out.ok && out.change.after).toContain('<Scene a="9" />');
  });

  it('refuses when the named tag is not inside the element', async () => {
    const out = await setAttributes(reading({ 'a.svelte': '<main><p/></main>\n' }), { file: 'a.svelte', line: 1, col: 1 }, { a: '1' }, 'Scene');
    expect(out.ok).toBe(false);
  });
});
