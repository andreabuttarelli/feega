import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ApplyAsk } from '../messages';
import { fileEdits } from './file-edits';

const HOME = "import Card from './Card';\n\nexport default () => (\n  <main>\n    <Card title=\"Old\" />\n  </main>\n);\n";

function app(): string {
  const root = mkdtempSync(join(tmpdir(), 'props-'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'src/Home.tsx'), HOME);
  writeFileSync(join(root, 'src/Card.tsx'), 'export default function Card() { return <div />; }\n');
  return root;
}

const ask: ApplyAsk = { component: 'src/Card.tsx', usage: 'src/Home.tsx:4:3', set: { title: 'New' }, remove: [] };

describe('apply props to the usage', () => {
  it('writes into the source, shows in the changes and can be undone', async () => {
    const root = app();
    const edits = fileEdits(root);

    const out = await edits.applyProps(ask);

    expect(out.ok).toBe(true);
    expect(readFileSync(join(root, 'src/Home.tsx'), 'utf8')).toContain('title="New"');
    expect(edits.history()).toHaveLength(1);
    expect(edits.history()[0]).toMatchObject({ prop: 'props', files: ['src/Home.tsx'] });
    await edits.undo();
    expect(readFileSync(join(root, 'src/Home.tsx'), 'utf8')).toBe(HOME);
  });

  it('plans without writing and reports what needs asking', async () => {
    const root = app();
    writeFileSync(join(root, 'src/Home.tsx'), HOME.replace('title="Old"', 'title={post.title}'));

    const plan = await fileEdits(root).propsPlan(ask);

    expect(plan.ok && plan.cautions).toEqual([expect.stringContaining('title')]);
    expect(readFileSync(join(root, 'src/Home.tsx'), 'utf8')).toContain('post.title');
  });

  it('names the props it could not write', async () => {
    const out = await fileEdits(app()).applyProps({ ...ask, set: { title: 'New', onClick: { $fn: true } } });

    expect(out.ok && out.note).toContain('onClick');
  });

  it('refuses a usage outside the workspace', async () => {
    const out = await fileEdits(app()).applyProps({ ...ask, usage: '../Home.tsx:4:3' });

    expect(out.ok).toBe(false);
  });
});
