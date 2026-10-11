import { describe, expect, it, vi } from 'vitest';
import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { Quality } from '$lib/motion/direction';
import { Forbidden } from '$lib/motion/style';
import { DESCRIBE_FRAMES } from './frames';
import { GATE_SHOWN, describeFramesTool, gateBlock, lookFirst, type LookSession } from './look';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

function setup() {
  const session: LookSession = {};
  const edit = vi.fn(async () => ({ ok: true }));
  const raw: Record<string, Tool> = {
    view_frames: tool({ inputSchema: z.object({ times: z.array(z.number()) }), execute: async (input) => ((session.look = { times: input.times, described: false }), { ok: true }) }),
    add_clip: tool({ inputSchema: z.object({}), execute: edit }),
    get_motion_doc: tool({ inputSchema: z.object({}), execute: async () => ({ ok: true }) }),
    [DESCRIBE_FRAMES]: describeFramesTool(session)
  };
  const tools = lookFirst(raw, session);
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, edit, run };
}

const line = (time: number) => ({ time, visible: 'a black title "Ship" centred on cream', wrong: 'nothing' });

describe('looking is split from checking', () => {
  it('after a look, no edit runs until every frame is described in one line', async () => {
    const { run, edit } = setup();
    await run('view_frames', { times: [1, 2] });

    const refused = await run('add_clip', {});

    expect(refused.ok).toBe(false);
    expect(String(refused.error)).toContain(DESCRIBE_FRAMES);
    expect(edit).not.toHaveBeenCalled();
  });

  it('a description that skips a frame is refused and names the missing time', async () => {
    const { run } = setup();
    await run('view_frames', { times: [1, 2] });

    const out = await run(DESCRIBE_FRAMES, { frames: [line(1)] });

    expect(out.ok).toBe(false);
    expect(String(out.error)).toContain('2s');
    expect((await run('add_clip', {})).ok).toBe(false);
  });

  it('once each frame is described, edits run again', async () => {
    const { run, edit, session } = setup();
    await run('view_frames', { times: [1, 2] });

    expect((await run(DESCRIBE_FRAMES, { frames: [line(1), line(2)] })).ok).toBe(true);
    expect((await run('add_clip', {})).ok).toBe(true);
    expect(edit).toHaveBeenCalledOnce();
    expect(session.look?.lines).toHaveLength(2);
  });

  it('reading the doc is not an edit: it stays open while a description is due', async () => {
    const { run } = setup();
    await run('view_frames', { times: [1] });

    expect((await run('get_motion_doc', {})).ok).toBe(true);
  });

  it('a second look replaces the first: it is the new frames that must be described', async () => {
    const { run } = setup();
    await run('view_frames', { times: [1] });
    await run('view_frames', { times: [3] });

    expect((await run(DESCRIBE_FRAMES, { frames: [line(1)] })).ok).toBe(false);
    expect((await run(DESCRIBE_FRAMES, { frames: [line(3)] })).ok).toBe(true);
  });

  it('with no look yet, edits run freely', async () => {
    const { run } = setup();

    expect((await run('add_clip', {})).ok).toBe(true);
  });
});

describe('the gate block', () => {
  it('is empty when the gate finds nothing', () => {
    expect(gateBlock([])).toBe('');
  });

  it('puts blocking problems first and keeps the top few', () => {
    const warnings = Array.from({ length: 6 }, (_, i) => ({ kind: Quality.OffStyle, effect: Object.values(Forbidden)[i], detail: `warning ${i}` }));
    const block = gateBlock([...warnings, { kind: Quality.BlankFrame, at: 2, detail: 'the frame at 2s is a flat colour' }]);
    const lines = block.split('\n').filter((l) => l.startsWith('- '));

    expect(lines).toHaveLength(GATE_SHOWN);
    expect(lines[0]).toContain('blocking');
    expect(lines[0]).toContain('flat colour');
    expect(block).toContain('2 more');
  });

  it('says one check once, however many frames it fired on', () => {
    const block = gateBlock([1, 2, 3].map((t) => ({ kind: Quality.WhiteArea, at: t, detail: `60% of the frame at ${t}s is plain white` })));

    expect(block.match(/plain white/g)).toHaveLength(1);
    expect(block).toContain('3×');
  });
});
