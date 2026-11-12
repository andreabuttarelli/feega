import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const RUNNERS = 'src/lib/server/edit/runners.ts';
const CHAT = 'src/routes/api/v1/projects/[projectId]/agent/+server.ts';
const MOTION_CHAT = 'src/routes/api/v1/projects/[projectId]/motion/[nodeId]/agent/+server.ts';
const MOTION_ASK = 'src/routes/api/v1/motion/[nodeId]/ask/+server.ts';
const REVISIONS = 'src/routes/api/v1/motion/[nodeId]/revisions/+server.ts';
const FROM_TEMPLATE = 'src/routes/api/v1/motion/from-template/+server.ts';
const STORYBOARD = 'src/routes/api/v1/motion/[nodeId]/storyboard/+server.ts';
const TEMPLATES = 'src/routes/api/v1/motion/[nodeId]/templates/+server.ts';

const GATED_ENTRIES = [
  RUNNERS,
  CHAT,
  MOTION_CHAT,
  MOTION_ASK,
  REVISIONS,
  FROM_TEMPLATE,
  STORYBOARD,
  TEMPLATES,
  'src/routes/api/v1/gallery/[id]/remix/+server.ts',
  'src/routes/api/v1/motion/[nodeId]/poster/+server.ts',
  'src/routes/api/v1/motion/elements/+server.ts',
  'src/routes/api/v1/org/rows/+server.ts'
];

const NOT_AN_EDIT: Record<string, string> = {
  'src/routes/api/v1/gallery/publish/+server.ts': 'copies a frame to the public gallery; the canvas does not change',
  'src/routes/api/v1/motion/[nodeId]/render/+server.ts': 'renders a video file; it spends credits and edits no layer'
};

const WRITER_ENTRIES: Record<string, string[]> = {
  'src/lib/server/canvas/canvas-ops.ts': [RUNNERS, CHAT],
  'src/lib/server/motion/tool-run.ts': [RUNNERS, CHAT, MOTION_CHAT, MOTION_ASK],
  'src/lib/server/motion/ask.ts': [MOTION_ASK, REVISIONS],
  'src/lib/server/motion/turn.ts': [MOTION_CHAT, MOTION_ASK],
  'src/lib/server/motion/from-template.ts': [FROM_TEMPLATE, RUNNERS, CHAT],
  'src/lib/server/motion/storyboard-api.ts': [STORYBOARD],
  'src/lib/server/motion/template-api.ts': [TEMPLATES],
  'src/lib/server/project-agent/frame-tools.ts': [CHAT],
  'src/lib/server/project-agent/motion-delegation.ts': [CHAT],
  'src/lib/server/project-agent/turn.ts': [CHAT]
};

const GATE = /agentEditCap\(|agentEditRefusal\(/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === 'node_modules' ? [] : sources(full);
    }
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
  });
}

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const actorBuilders = sources(join(ROOT, 'src'))
  .map((file) => relative(ROOT, file))
  .filter((file) => file !== 'src/lib/server/repos/actor.ts' && read(file).includes('agentActor('));

describe('every agent write path passes the free weekly cap', () => {
  it('found the paths that build an agent actor', () => {
    expect(actorBuilders.length).toBeGreaterThan(10);
  });

  it.each(actorBuilders)('%s is a gated entry, a declared non-edit, or a writer reached only from gated entries', (file) => {
    const known = GATED_ENTRIES.includes(file) || file in NOT_AN_EDIT || file in WRITER_ENTRIES;
    expect(known, `${file} builds an agent actor: gate its entry with agentEditRefusal/agentEditCap and add it here`).toBe(true);
  });

  it.each(GATED_ENTRIES)('%s calls the gate', (file) => {
    expect(GATE.test(read(file))).toBe(true);
  });

  it.each(Object.entries(WRITER_ENTRIES))('%s is reached only through gated entries', (_writer, entries) => {
    for (const entry of entries) {
      expect(GATED_ENTRIES).toContain(entry);
    }
  });
});
