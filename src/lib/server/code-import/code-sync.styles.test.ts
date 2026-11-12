import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { parseMotionDoc } from '@feega/motion-core/motion/doc';

const STYLE = 'traidue Text/article prose h2';
const PAGE_WIDTH = 3040;
const CSS = `article .prose h2 {
\tfont-size: 1.5rem;
\tfont-weight: 600;
\tline-height: 1.4;
\tletter-spacing: -0.025em;
}
`;

const folder = await mkdtemp(join(tmpdir(), 'feega-style-sync-'));
await mkdir(join(folder, 'src'));
await writeFile(join(folder, 'package.json'), '{}');
await writeFile(join(folder, 'src/app.css'), CSS);

const field = (name: string, raw: string, line: number, field: string, scale = 1) => ({ name, origins: { Light: `src/app.css:${line}:1` }, raw: { Light: raw }, scale, style: STYLE, field, rule: 'article .prose h2' });

const tokens = {
  [`${STYLE}#size`]: field('font-size', '1.5rem', 2, 'size', 1 / PAGE_WIDTH),
  [`${STYLE}#weight`]: field('font-weight', '600', 3, 'weight')
};

const edited = parseMotionDoc({
  version: 5,
  fps: 30,
  width: PAGE_WIDTH,
  height: 16384,
  durationInFrames: 150,
  background: 'transparent',
  tracks: [],
  comps: {},
  assets: [],
  styles: { [STYLE]: { kind: 'text', size: 28 / PAGE_WIDTH, weight: 700, tracking: -0.025, leading: 1.4 } }
});

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/repos/canvas', () => ({
  findNode: async () => ({ projectId: 'p1', data: { code: { kind: 'folder', repo: folder, branch: null, sha: 'abc1234', routes: ['/'], tokens } } })
}));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({ read: async () => ({ doc: edited.ok ? edited.doc : null, version: 2 }) }) }));

const { codeChanges, SyncOutcome } = await import('./code-sync');

afterAll(() => rm(folder, { recursive: true, force: true }));

describe('the changes of a frame imported from a folder', () => {
  it('an edited text style shows up as a patch of the CSS rule it came from', async () => {
    const out = await codeChanges({ orgId: 'o1', userId: 'u1', projectId: 'p1', db: {} } as never, 'node-1');

    expect(out.outcome).toBe(SyncOutcome.Ok);
    expect('patch' in out && out.patch).toContain('+\tfont-size: 1.75rem;');
    expect('patch' in out && out.patch).toContain('+\tfont-weight: 700;');
  });
});
