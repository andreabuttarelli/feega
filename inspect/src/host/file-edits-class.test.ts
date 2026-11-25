import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { ElementState } from '@feega/live-edit/element-state';
import { fileEdits } from './file-edits';

const TAILWIND = JSON.stringify({ devDependencies: { tailwindcss: '^3.4.0' } });
const CSS = '.card {\n  padding: 8px;\n}\n';

function app(manifest = '{}'): string {
  const root = mkdtempSync(join(tmpdir(), 'class-edit-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), manifest);
  writeFileSync(join(root, 'src/app.css'), CSS);
  writeFileSync(join(root, 'src/Page.html'), '<p class="card">a</p>\n');
  return root;
}

const read = (root: string) => readFileSync(join(root, 'src/app.css'), 'utf8');

const ask = (css: Record<string, string>, extra = {}) => ({ at: 'src/Page.html:1:1', prop: LiveProp.Padding, css, cls: { name: 'card', file: 'src/app.css' }, ...extra });

describe('edit a global class', () => {
  it('writes the property into the class rule, not into the element', async () => {
    const root = app();
    const out = await fileEdits(root).edit(ask({ padding: '24px' }));

    expect(out.ok).toBe(true);
    expect(read(root)).toBe('.card {\n  padding: 24px;\n}\n');
    expect(readFileSync(join(root, 'src/Page.html'), 'utf8')).toBe('<p class="card">a</p>\n');
  });

  it('works in a tailwind project too', async () => {
    const root = app(TAILWIND);
    await fileEdits(root).edit(ask({ padding: '24px' }));

    expect(read(root)).toContain('padding: 24px');
  });

  it('writes the hover state of the class', async () => {
    const root = app();
    await fileEdits(root).edit(ask({ color: 'red' }, { state: ElementState.Hover }));

    expect(read(root)).toContain('.card:hover {\n  color: red;\n}');
  });

  it('shows the change in the history as a class edit and undoes it', async () => {
    const root = app();
    const edits = fileEdits(root);
    await edits.edit(ask({ padding: '24px' }));

    expect(edits.history()[0]).toMatchObject({ prop: LiveProp.Padding, scope: 'class .card', files: ['src/app.css'] });

    await edits.undo();
    expect(read(root)).toBe(CSS);
  });

  it('previews without writing', async () => {
    const root = app();
    const out = await fileEdits(root).preview(ask({ padding: '24px' }));

    expect(out.ok && out.changes?.[0].after).toBe('.card {\n  padding: 24px;\n}\n');
    expect(read(root)).toBe(CSS);
  });

  it('refuses a stylesheet outside the workspace', async () => {
    const out = await fileEdits(app()).edit({ ...ask({ padding: '1px' }), cls: { name: 'card', file: '../outside.css' } });

    expect(out.ok).toBe(false);
  });
});
