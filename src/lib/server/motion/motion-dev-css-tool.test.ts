import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

const CARD = { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.25, height: 0.1, fill: 'brand.accent' } };

describe('read_layer_css', () => {
  it('returns the CSS, the Tailwind classes, the box and the variable names of a layer', async () => {
    const { run, session } = setup();
    const added = addClip(session.doc, CARD, 'card');
    session.doc = added.ok ? added.doc : session.doc;

    const out = await run('read_layer_css', { clip_id: 'card' });

    expect(out).toMatchObject({ ok: true, box: { left: 720, top: 486, width: 480, height: 108 } });
    expect(out.css).toContain('background: var(--brand-accent);');
    expect(out.tailwind).toContain('w-[480px]');
    expect(out.tokens).toContainEqual({ role: 'colour', name: 'brand.accent', value: null });
  });

  it('refuses a layer that is not in the video', async () => {
    const { run } = setup();

    expect(await run('read_layer_css', { clip_id: 'ghost' })).toMatchObject({ ok: false });
  });
});
