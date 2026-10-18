import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import type { ZodType } from 'zod';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { Direction, Sizing } from '$lib/motion/layout/auto-layout';
import { withAutoLayout } from '$lib/motion/layout/resolve';
import { pivotBox } from '$lib/motion/parent';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => {
    const found = tools[name] as Tool & { execute: Exec; inputSchema: ZodType };
    return found.execute(found.inputSchema.parse(input), { toolCallId: 'c' });
  };
  return { session, run };
}

describe('a hug row of text and icon', () => {
  it('puts the icon right of the text, a gap apart, on one line and centred across', async () => {
    const { session, run } = setup();
    await run('add_clip', { component: 'Text', start: 0, duration: 2, props: { text: 'Get started', x: 400, y: 300, width: 600, height: 80, size: 24 } });
    await run('add_shape', { kind: 'rect', start: 0, duration: 2, props: { x: 900, y: 300, width: 24, height: 24 } });
    const wrapped = await run('add_auto_layout', { clip_ids: ['id1', 'id2'] });
    const row = String(wrapped.container_id);
    await run('set_auto_layout', { clip_id: row, direction: Direction.Horizontal, gap: 12, align: 'center' });
    await run('set_layout_item', { clip_id: row, width: Sizing.Hug, height: Sizing.Hug });
    await run('set_layout_item', { clip_id: 'id1', width: Sizing.Hug, height: Sizing.Hug });

    const doc = withAutoLayout(session.doc);
    const size = { width: doc.width, height: doc.height };
    const text = pivotBox(findClip(doc, 'id1')!.clip.props, size);
    const icon = pivotBox(findClip(doc, 'id2')!.clip.props, size);

    expect(text.height).toBeCloseTo(24 * 1.3, 0);
    expect(icon.left).toBeCloseTo(text.left + text.width + 12, 1);
    expect(icon.top + icon.height / 2).toBeCloseTo(text.top + text.height / 2, 1);
    expect(findClip(doc, 'id1')!.clip.props.sizing).toBe('auto');
  });
});
