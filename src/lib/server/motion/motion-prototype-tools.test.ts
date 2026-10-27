import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, clipsOf, newMotionDoc } from '@feega/motion-core/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

async function withButton() {
  const made = setup();
  await made.run('add_shape', { kind: 'rect', start: 0 });
  return { ...made, id: clipsOf(made.session.doc)[0].id };
}

describe('prototype interactions through the agent tools', () => {
  it('add_interaction links a layer to a frame and list_interactions reads it back', async () => {
    const { run, id } = await withButton();

    const added = await run('add_interaction', { clip_id: id, trigger: { kind: 'click' }, action: { kind: 'navigate', target: 'frame-b' }, transition: { kind: 'slide', direction: 'left', easing: 'enter', durationMs: 300 } });
    const listed = await run('list_interactions', {});

    expect(added).toMatchObject({ ok: true });
    expect(listed).toMatchObject({ interactions: [{ clip_id: id, action: { kind: 'navigate', target: 'frame-b' }, trigger: { kind: 'click' }, transition: { kind: 'slide' } }] });
  });

  it('remove_interaction drops the link', async () => {
    const { run, id } = await withButton();
    const added = (await run('add_interaction', { clip_id: id, trigger: { kind: 'hover' }, action: { kind: 'back' } })) as { interaction_id: string };

    expect(await run('remove_interaction', { clip_id: id, interaction_id: added.interaction_id })).toMatchObject({ ok: true });
    expect(await run('list_interactions', {})).toMatchObject({ interactions: [] });
  });

  it('a navigate without a target is refused with the reason', async () => {
    const { run, id } = await withButton();

    expect(await run('add_interaction', { clip_id: id, trigger: { kind: 'click' }, action: { kind: 'navigate' } })).toMatchObject({ ok: false });
  });

  it('add_interaction accepts a smart animate transition and list_interactions reads it back', async () => {
    const { run, id } = await withButton();

    const added = await run('add_interaction', { clip_id: id, trigger: { kind: 'click' }, action: { kind: 'navigate', target: 'frame-b' }, transition: { kind: 'smart_animate', easing: 'enter', durationMs: 500 } });
    const listed = await run('list_interactions', {});

    expect(added).toMatchObject({ ok: true });
    expect(listed).toMatchObject({ interactions: [{ transition: { kind: 'smart_animate', easing: 'enter', durationMs: 500 } }] });
  });
});
