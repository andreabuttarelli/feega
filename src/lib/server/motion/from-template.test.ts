import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { MotionFormat, parseMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { PROMPT_TEMPLATE_ID } from '$lib/motion/template/prompt-input/template';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { atFirstRevision, frameNodeOf, newMotionData } from '$lib/canvas/motion-node';
import { FromTemplate, startFromTemplate, type FromTemplateDeps } from './from-template';

const db = {} as Db;
const canvas = { id: 'c-motion', projectId: 'p1', name: 'Motion', viewport: null };

function deps(overrides: Partial<FromTemplateDeps> = {}): FromTemplateDeps {
  return {
    listCanvases: vi.fn(async () => [canvas]),
    createCanvas: vi.fn(async () => canvas),
    listNodes: vi.fn(async () => []),
    createNode: vi.fn(async () => ({ id: 'n1', canvasId: 'c-motion', projectId: 'p1', type: 'motion', displayName: null, position: { x: 0, y: 0, z: 0 }, size: { width: null, height: null }, data: {}, version: 1 })),
    template: vi.fn(async (_db: Db, _scope: unknown, id: string) => BUILTIN_TEMPLATES.find((e) => e.id === id) ?? null),
    append: vi.fn(async (_db: Db, input: { doc: unknown }) => ({ outcome: RevisionOutcome.Written as const, head: { version: 1, doc: input.doc as MotionDoc, summary: null, actorKind: 'user' } })),
    ...overrides
  };
}

const input = { orgId: 'org', projectId: 'p1', userId: 'u1', templateId: PROMPT_TEMPLATE_ID, format: MotionFormat.Vertical as const };

describe('a video started from a component', () => {
  it('is a new motion node whose first revision already holds the component', async () => {
    const d = deps();
    const started = await startFromTemplate(db, d, input);

    expect(started).toEqual({ outcome: FromTemplate.Started, start: { projectId: 'p1', canvasId: 'c-motion', nodeId: 'n1' }, node: expect.objectContaining({ id: 'n1' }), version: 1 });
    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ displayName: 'Prompt input', data: atFirstRevision(newMotionData(MotionFormat.Vertical)) }));

    const saved = vi.mocked(d.append).mock.calls[0][1];
    expect(saved).toMatchObject({ orgId: 'org', nodeId: 'n1', expectedVersion: 0 });
    const doc = saved.doc as MotionDoc;
    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(Object.values(doc.comps).some((c) => c.template?.id === PROMPT_TEMPLATE_ID)).toBe(true);
    expect(doc.height).toBeGreaterThan(doc.width);
  });

  it('picked from the canvas add bar, it lands where the canvas is looking', async () => {
    const d = deps();
    await startFromTemplate(db, d, { ...input, canvasId: 'c-motion', at: { x: 12, y: 34 } });

    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ x: 12, y: 34 }));
  });

  it('a 4:5 poster asked at 4:5 makes a 4:5 node, sized from the doc it saves', async () => {
    const d = deps();
    await startFromTemplate(db, d, { ...input, templateId: 'builtin:poster-type-grid', format: MotionFormat.Portrait, canvasId: 'c-motion', at: { x: 0, y: 0 } });

    const doc = vi.mocked(d.append).mock.calls[0][1].doc as MotionDoc;
    const shaped = frameNodeOf(doc);
    expect(doc).toMatchObject({ width: 1080, height: 1350 });
    expect(d.createNode).toHaveBeenCalledWith(db, expect.objectContaining({ data: atFirstRevision(shaped.data), width: shaped.w, height: shaped.h }));
  });

  it('a poster starts as its own clip, not wrapped in a precomp, so its parts select and edit on the canvas', async () => {
    const d = deps();
    await startFromTemplate(db, d, { ...input, templateId: 'builtin:poster-type-grid', format: MotionFormat.Portrait, canvasId: 'c-motion', at: { x: 0, y: 0 } });

    const doc = vi.mocked(d.append).mock.calls[0][1].doc as MotionDoc;
    const clips = doc.tracks.flatMap((t) => t.clips);
    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(clips.map((c) => c.component)).toEqual(['Custom']);
    expect(clips[0].props).toMatchObject({ lines: expect.any(String) });
  });

  it('creates nothing for a component that does not exist', async () => {
    const d = deps();
    expect(await startFromTemplate(db, d, { ...input, templateId: 'builtin:nope' })).toEqual({ outcome: FromTemplate.Unknown });
    expect(d.createNode).not.toHaveBeenCalled();
  });
});
