import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileEdits } from './file-edits';

const BUTTON = 'export function Button() {\n  return <button className="p-2">Go</button>;\n}\n';
const HOME = "import { Button } from './Button';\n\nexport default function Home() {\n  return (\n    <section>\n      <Button />\n    </section>\n  );\n}\n";

const ASK = { at: 'src/Button.tsx:2:10', usage: 'src/Home.tsx:5:5', which: { index: 0, count: 1 } };

function project(): string {
  const root = mkdtempSync(join(tmpdir(), 'inspect-detach-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'src/Button.tsx'), BUTTON);
  writeFileSync(join(root, 'src/Home.tsx'), HOME);
  return root;
}

const read = (root: string, name: string) => readFileSync(join(root, 'src', name), 'utf8');

describe('fileEdits.detach', () => {
  it('writes the copy and repoints one usage as a single step', async () => {
    const root = project();
    const edits = fileEdits(root);
    const out = await edits.detach(ASK);

    expect(out.ok).toBe(true);
    expect(read(root, 'ButtonHome.tsx')).toContain('export function ButtonHome()');
    expect(read(root, 'Home.tsx')).toContain('<ButtonHome />');
    expect(read(root, 'Button.tsx')).toBe(BUTTON);
    expect(edits.history()).toHaveLength(1);
  });

  it('undo removes the copy and restores the usage', async () => {
    const root = project();
    const edits = fileEdits(root);
    await edits.detach(ASK);

    await edits.undo();

    expect(existsSync(join(root, 'src/ButtonHome.tsx'))).toBe(false);
    expect(read(root, 'Home.tsx')).toBe(HOME);
  });

  it('redo detaches again', async () => {
    const root = project();
    const edits = fileEdits(root);
    await edits.detach(ASK);
    await edits.undo();

    await edits.redo();

    expect(read(root, 'Home.tsx')).toContain('<ButtonHome />');
  });

  it('refuses a path outside the workspace', async () => {
    const out = await fileEdits(project()).detach({ at: '../x/Button.tsx:1:1', usage: ASK.usage, which: ASK.which });

    expect(out.ok).toBe(false);
  });

  it('says why a usage cannot be rewritten and writes nothing', async () => {
    const root = project();
    writeFileSync(join(root, 'src/Home.tsx'), HOME.replace("'./Button'", "'./index'"));
    const out = await fileEdits(root).detach(ASK);

    expect(out).toMatchObject({ ok: false, reason: expect.stringContaining('re-export') });
    expect(existsSync(join(root, 'src/ButtonHome.tsx'))).toBe(false);
  });
});
