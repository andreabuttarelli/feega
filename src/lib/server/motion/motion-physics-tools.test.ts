import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { PHYSICS_PRESETS } from '$lib/motion/physics/model';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Square), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('motion agent physics tools', () => {
  it('set_physics gives a clip gravity and bounce, reads back, and turns off', async () => {
    const { session, run } = setup();
    await run('add_shape', { kind: 'circle', start: 0, duration: 3, props: { width: 108, height: 108 } });
    const on = await run('set_physics', { clip_id: 'id1', physics: { gravity: 3000, restitution: 70, velocityX: 400, bounds: 'box', collide: true } });
    const read = (await run('get_motion_doc', {})) as { tracks: { clips: { physics: unknown }[] }[] };

    expect(on.ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.physics).toMatchObject({ gravity: 3000, restitution: 0.7, velocityX: 400, bounds: 'box', collide: true });
    expect(read.tracks.flatMap((t) => t.clips)[0].physics).toMatchObject({ gravity: 3000, restitution: 70 });

    expect((await run('set_physics', { clip_id: 'id1', physics: null })).ok).toBe(true);
    expect(findClip(session.doc, 'id1')!.clip.physics).toBeNull();
  });

  it('every physics preset is one call, and the composed video moves the clip', async () => {
    for (const preset of PHYSICS_PRESETS) {
      const { session, run } = setup();
      await run('add_shape', { kind: 'circle', start: 0, duration: 2, props: { width: 108, height: 108 } });
      const out = await run('apply_physics_preset', { clip_id: 'id1', preset });

      expect({ preset, ok: out.ok }).toEqual({ preset, ok: true });
      expect(composeHtml({ doc: session.doc, tokens: FEEGA_TOKENS, assets: {} })).not.toBe(composeHtml({ doc: { ...session.doc, tracks: session.doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, physics: null })) })) }, tokens: FEEGA_TOKENS, assets: {} }));
    }
  });

  it('a sound clip takes no physics', async () => {
    const { run, session } = setup();
    session.doc = { ...session.doc, assets: [{ id: 'a', kind: 'audio', name: 'a' }] } as typeof session.doc;
    await run('add_clip', { component: 'Audio', start: 0, props: { assetId: 'a' } });

    expect((await run('set_physics', { clip_id: 'id1', physics: {} })).ok).toBe(false);
  });

  it('the prompt names the physics tools', () => {
    const prompt = motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Missing });
    expect(prompt).toContain('set_physics');
    expect(prompt).toContain('apply_physics_preset');
  });
});
