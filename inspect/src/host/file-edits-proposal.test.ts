import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OpKind, Place, type Op } from '@feega/plugin-api/protocol';
import { fileEdits } from './file-edits';

const PAGE = '<section class="hero">\n  <h1>Hi</h1>\n</section>\n';
const PACKAGE = '{\n  "name": "demo",\n  "devDependencies": {\n    "tailwindcss": "^4.0.0"\n  },\n  "dependencies": {\n    "svelte": "^5.0.0"\n  }\n}\n';

function app() {
  const root = mkdtempSync(join(tmpdir(), 'proposal-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), PACKAGE);
  writeFileSync(join(root, 'src/Page.svelte'), PAGE);
  const read = (path: string) => readFileSync(join(root, path), 'utf8');
  return { root, read, has: (path: string) => existsSync(join(root, path)) };
}

const AT = 'src/Page.svelte:1:1';
const CHILD_AT = 'src/Page.svelte:2:3';
const COMPONENT = { name: 'Scene3D', file: 'src/lib/feega/Scene3D.svelte', source: '<div class="scene"></div>\n', attributes: 'shape="cube"' };

describe('a plugin proposal goes through the edit engine', () => {
  it('writes style as a stylesheet rule even in a Tailwind project', async () => {
    const { root, read } = app();
    const out = await fileEdits(root).proposal({ label: 'Mesh gradient', ops: [{ kind: OpKind.Style, at: AT, css: { 'background-image': 'radial-gradient(circle at 20% 30%, #f00, transparent)' } }] }, '');
    expect(out.ok).toBe(true);
    expect(read('src/Page.svelte')).toContain('background-image: radial-gradient(circle at 20% 30%, #f00, transparent);');
    expect(read('src/Page.svelte')).not.toContain('bg-[');
  });

  it('shows in the history and undoes like a manual edit', async () => {
    const { root, read } = app();
    const edits = fileEdits(root);
    await edits.proposal({ label: 'Mesh gradient', ops: [{ kind: OpKind.Style, at: AT, css: { color: 'red' } }] }, '');
    expect(edits.history()).toMatchObject([{ prop: 'plugin', value: 'Mesh gradient', files: ['src/Page.svelte'] }]);
    expect(edits.canUndo()).toBe(true);
    await edits.undo();
    expect(read('src/Page.svelte')).toBe(PAGE);
    await edits.redo();
    expect(read('src/Page.svelte')).toContain('color: red');
  });

  it('inserts a component: new file, import and usage in one step', async () => {
    const { root, read, has } = app();
    const edits = fileEdits(root);
    const out = await edits.proposal({ label: '3D object', ops: [{ kind: OpKind.Insert, at: AT, place: Place.Child, component: COMPONENT }] }, '');
    expect(out.ok).toBe(true);
    expect(read('src/lib/feega/Scene3D.svelte')).toBe(COMPONENT.source);
    const page = read('src/Page.svelte');
    expect(page).toContain("import Scene3D from './lib/feega/Scene3D.svelte';");
    expect(page).toContain('<Scene3D shape="cube" />');
    expect(edits.history()).toHaveLength(1);
    await edits.undo();
    expect(read('src/Page.svelte')).toBe(PAGE);
    expect(has('src/lib/feega/Scene3D.svelte')).toBe(false);
  });

  it('does not overwrite a component file that already exists', async () => {
    const { root, read } = app();
    mkdirSync(join(root, 'src/lib/feega'), { recursive: true });
    writeFileSync(join(root, 'src/lib/feega/Scene3D.svelte'), 'mine');
    await fileEdits(root).proposal({ label: '3D object', ops: [{ kind: OpKind.Insert, at: AT, place: Place.Child, component: COMPONENT }] }, '');
    expect(read('src/lib/feega/Scene3D.svelte')).toBe('mine');
  });

  it('writes support files next to the component', async () => {
    const { root, read } = app();
    await fileEdits(root).proposal({ label: '3D object', ops: [{ kind: OpKind.Insert, at: AT, place: Place.Child, component: COMPONENT, support: [{ file: 'src/lib/feega/scene3d.ts', source: 'export {};\n' }] }] }, '');
    expect(read('src/lib/feega/scene3d.ts')).toBe('export {};\n');
  });

  it('adds a dependency to package.json and keeps the rest', async () => {
    const { root, read } = app();
    await fileEdits(root).proposal({ label: 'dep', ops: [{ kind: OpKind.Dependency, name: 'three', version: '^0.180.0' }] }, '');
    expect(JSON.parse(read('package.json')).dependencies).toEqual({ svelte: '^5.0.0', three: '^0.180.0' });
  });

  it('copies a binary asset byte for byte and removes it on undo', async () => {
    const { root, read, has } = app();
    const edits = fileEdits(root);
    const bytes = Buffer.from([0, 255, 128, 7, 200]);
    await edits.proposal({ label: 'model', ops: [{ kind: OpKind.Asset, file: 'public/models/a.glb', base64: bytes.toString('base64') }] }, '');
    expect(readFileSync(join(root, 'public/models/a.glb')).equals(bytes)).toBe(true);
    await edits.undo();
    expect(has('public/models/a.glb')).toBe(false);
    expect(read('src/Page.svelte')).toBe(PAGE);
  });

  it('sets attributes on the tag at the given position', async () => {
    const { root, read } = app();
    writeFileSync(join(root, 'src/Page.svelte'), '<main>\n  <Scene3D shape="cube" />\n</main>\n');
    await fileEdits(root).proposal({ label: '3D object', ops: [{ kind: OpKind.Attributes, at: 'src/Page.svelte:2:3', set: { material: 'glass' } }] }, '');
    expect(read('src/Page.svelte')).toContain('<Scene3D shape="cube" material="glass" />');
  });

  it('puts the files under the app directory but the element where the page says', async () => {
    const { root, read } = app();
    mkdirSync(join(root, 'apps/web/src'), { recursive: true });
    writeFileSync(join(root, 'apps/web/package.json'), PACKAGE);
    writeFileSync(join(root, 'apps/web/src/Page.svelte'), PAGE);
    const ops: Op[] = [
      { kind: OpKind.Insert, at: 'apps/web/src/Page.svelte:1:1', place: Place.Child, component: COMPONENT },
      { kind: OpKind.Dependency, name: 'three', version: '^0.180.0' }
    ];
    const out = await fileEdits(root).proposal({ label: '3D object', ops }, 'apps/web');
    expect(out.ok).toBe(true);
    expect(read('apps/web/src/lib/feega/Scene3D.svelte')).toBe(COMPONENT.source);
    expect(read('apps/web/src/Page.svelte')).toContain("import Scene3D from './lib/feega/Scene3D.svelte';");
    expect(JSON.parse(read('apps/web/package.json')).dependencies.three).toBe('^0.180.0');
  });

  it('applies style and insert on the same file without breaking either', async () => {
    const { root, read } = app();
    const ops: Op[] = [
      { kind: OpKind.Insert, at: AT, place: Place.Child, component: COMPONENT },
      { kind: OpKind.Style, at: AT, css: { color: 'red' } }
    ];
    expect((await fileEdits(root).proposal({ label: 'both', ops }, '')).ok).toBe(true);
    const page = read('src/Page.svelte');
    expect(page).toContain('<Scene3D shape="cube" />');
    expect(page).toContain('color: red');
    expect(page).toContain("import Scene3D from");
  });

  it('writes nothing when one operation is refused', async () => {
    const { root, read, has } = app();
    const ops: Op[] = [
      { kind: OpKind.Insert, at: AT, place: Place.Child, component: COMPONENT },
      { kind: OpKind.Style, at: 'src/Missing.svelte:1:1', css: { color: 'red' } }
    ];
    const out = await fileEdits(root).proposal({ label: 'bad', ops }, '');
    expect(out.ok).toBe(false);
    expect(read('src/Page.svelte')).toBe(PAGE);
    expect(has('src/lib/feega/Scene3D.svelte')).toBe(false);
  });

  it('refuses a path that leaves the workspace', async () => {
    const { root } = app();
    const out = await fileEdits(root).proposal({ label: 'evil', ops: [{ kind: OpKind.Asset, file: '../outside.txt', base64: 'AAAA' }] }, '');
    expect(out.ok).toBe(false);
  });

  it('inserts after the element when asked', async () => {
    const { root, read } = app();
    await fileEdits(root).proposal({ label: '3D', ops: [{ kind: OpKind.Insert, at: CHILD_AT, place: Place.After, component: COMPONENT }] }, '');
    const page = read('src/Page.svelte');
    expect(page.indexOf('<Scene3D')).toBeGreaterThan(page.indexOf('</h1>'));
  });

  it('inserts next to the root element of a file, where there is no parent element', async () => {
    const { root, read } = app();
    writeFileSync(join(root, 'src/Page.svelte'), '<section class="hero">\n  <h1>Hi</h1>\n</section>\n\n<style>\n  .hero {\n    color: red;\n  }\n</style>\n');
    const out = await fileEdits(root).proposal({ label: '3D', ops: [{ kind: OpKind.Insert, at: AT, place: Place.After, component: COMPONENT }] }, '');
    expect(out.ok).toBe(true);
    const page = read('src/Page.svelte');
    expect(page).toContain("<script>\n  import Scene3D from './lib/feega/Scene3D.svelte';\n</script>");
    expect(page.indexOf('<Scene3D')).toBeGreaterThan(page.indexOf('</section>'));
    expect(page.indexOf('<Scene3D')).toBeLessThan(page.indexOf('<style>'));
  });

  it('finds a root-level usage by tag when the parent does not hold it', async () => {
    const { root, read } = app();
    writeFileSync(join(root, 'src/Page.svelte'), '<section class="hero"></section>\n<Scene3D shape="cube" />\n');
    const out = await fileEdits(root).proposal({ label: '3D', ops: [{ kind: OpKind.Attributes, at: AT, tag: 'Scene3D', set: { material: 'metal' } }] }, '');
    expect(out.ok).toBe(true);
    expect(read('src/Page.svelte')).toContain('<Scene3D shape="cube" material="metal" />');
  });

  it('finds the usage by tag alone when no element is given', async () => {
    const { root, read } = app();
    writeFileSync(join(root, 'src/Page.svelte'), '<Scene3D shape="cube" />\n');
    const out = await fileEdits(root).proposal({ label: '3D', ops: [{ kind: OpKind.Attributes, tag: 'Scene3D', set: { lights: 'soft' } }] }, '');
    expect(out.ok).toBe(true);
    expect(read('src/Page.svelte')).toContain('lights="soft"');
  });

  it('refuses when the tag is used in more than one place', async () => {
    const { root, read } = app();
    writeFileSync(join(root, 'src/Page.svelte'), '<Scene3D />\n');
    writeFileSync(join(root, 'src/Other.svelte'), '<Scene3D />\n');
    const out = await fileEdits(root).proposal({ label: '3D', ops: [{ kind: OpKind.Attributes, tag: 'Scene3D', set: { lights: 'soft' } }] }, '');
    expect(out.ok).toBe(false);
    expect(read('src/Page.svelte')).toBe('<Scene3D />\n');
  });

  it('does not look inside node_modules for the usage', async () => {
    const { root } = app();
    mkdirSync(join(root, 'node_modules/x'), { recursive: true });
    writeFileSync(join(root, 'node_modules/x/A.svelte'), '<Scene3D />\n');
    const out = await fileEdits(root).proposal({ label: '3D', ops: [{ kind: OpKind.Attributes, tag: 'Scene3D', set: { lights: 'soft' } }] }, '');
    expect(out.ok).toBe(false);
  });
});
