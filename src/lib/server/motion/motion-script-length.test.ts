import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { Act, scriptSchema } from '$lib/motion/script';
import { createMotionTools, type MotionSession } from './motion-tools';

const SITE = 'https://supasito.com/';
const PROMISE = 'Every site you run. Up to date. In one place.';

const script = scriptSchema.parse({
  research: {
    audience: 'People who run a few websites',
    problem: 'Changes scatter across folders',
    struggle: 'A client sends a new price and three sites need it',
    flow: ['Pick the site', 'Say what should change'],
    benefits: [{ claim: 'See every change first', source: { url: SITE, quote: 'See it before it goes live' } }],
    tone: 'calm',
    promise: { text: PROMISE, source: { url: SITE, quote: PROMISE } }
  },
  acts: [
    { act: Act.Problem, start: 0, end: 3, scene: 'Folders', on_screen: ['The price changed.'] },
    { act: Act.Solution, start: 3, end: 6, scene: 'Sidebar', on_screen: ['Say what should change.'] },
    { act: Act.Proof, start: 6, end: 10, scene: 'Preview', on_screen: ['See it first.'] },
    { act: Act.Claim, start: 10, end: 15, scene: 'Logo', on_screen: [PROMISE] }
  ]
});

function setup() {
  const session: MotionSession = { doc: { ...newMotionDoc(MotionFormat.Landscape), script }, baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run = (name: string, input: unknown) => (tools[name] as Tool & { execute: (i: unknown, o: { toolCallId: string }) => Promise<Record<string, unknown>> }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

describe('a scripted video keeps the length of its script', () => {
  it('feega v7: set_canvas refuses to stretch a 15 s script to 52.5 s', async () => {
    const { run, session } = setup();

    const out = await run('set_canvas', { duration: 52.5 });

    expect(out).toMatchObject({ ok: false, error: expect.stringContaining('the script 15 s') });
    expect(session.edits).toEqual([]);
  });

  it('a length within a fifth of the script is fine', async () => {
    const { run } = setup();

    expect(await run('set_canvas', { duration: 17 })).toMatchObject({ ok: true });
  });
});
