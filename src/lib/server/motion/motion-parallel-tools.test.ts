import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc, parseMotionDoc } from '$lib/motion/doc';
import { createMotionTools, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;
type Run = (name: string, input: unknown) => Promise<Record<string, unknown>>;

const ASTEROIDS = 5;

function setup() {
  let n = 0;
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const tools = createMotionTools({ session, assets: [], newId: () => `id${++n}`, voiceover: vi.fn(), frames: vi.fn(), check: vi.fn() });
  const run: Run = (name, input) => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' });
  return { session, run };
}

async function asteroids(run: Run) {
  const clips: string[] = [];
  for (let i = 0; i < ASTEROIDS; i++) {
    const out = await run('add_clip', { component: 'Title', start: 0, duration: 2, props: { text: `rock ${i}` } });
    clips.push(out.clip_id as string);
  }
  await run('add_clip', { component: 'Caption', start: 0, duration: 2, props: { text: 'sun' } });

  const comps: { comp: string; clip: string }[] = [];
  for (const clip of clips) {
    const out = await run('precompose', { clip_ids: [clip] });
    comps.push({ comp: out.comp as string, clip });
  }
  return comps;
}

const mainComponents = (s: MotionSession) => s.doc.tracks.flatMap((t) => t.clips.map((c) => c.component)).sort();
const compTexts = (s: MotionSession) => Object.values(s.doc.comps).map((c) => c.tracks.flatMap((t) => t.clips.map((k) => k.props.text)));
const edits = (comps: { comp: string; clip: string }[]) => comps.map(({ comp, clip }) => ({ comp, calls: [{ tool: 'set_props', input: { clip_id: clip, props: { text: `edited ${clip}` } } }] }));

describe('motion tools called in parallel', () => {
  it('precomposing each asteroid on its own leaves the rest of the scene on the main timeline', async () => {
    const { session, run } = setup();

    await asteroids(run);

    expect(mainComponents(session)).toEqual(['Caption', ...Array(ASTEROIDS).fill('Precomp')]);
    expect(compTexts(session)).toEqual([...Array(ASTEROIDS).keys()].map((i) => [`rock ${i}`]));
  });

  it('edit_comp calls emitted in one step give the same doc as run one after another', async () => {
    const one = setup();
    const many = setup();

    for (const edit of edits(await asteroids(one.run))) {
      await one.run('edit_comp', edit);
    }
    const parallel = await Promise.all(edits(await asteroids(many.run)).map((edit) => many.run('edit_comp', edit)));

    expect(parallel.every((o) => o.ok)).toBe(true);
    expect(many.session.doc).toEqual(one.session.doc);
    expect(mainComponents(many.session)).toEqual(['Caption', ...Array(ASTEROIDS).fill('Precomp')]);
    expect(parseMotionDoc(many.session.doc).ok).toBe(true);
  });

  it('a tool emitted after edit_comp in the same step works on the main timeline', async () => {
    const { session, run } = setup();
    const [first] = await asteroids(run);
    const precomp = session.doc.tracks.flatMap((t) => t.clips).find((c) => c.props.comp === first.comp)!.id;

    const [, moved] = await Promise.all([run('edit_comp', { comp: first.comp, calls: [{ tool: 'get_motion_doc', input: {} }] }), run('move_clip', { clip_id: precomp, start: 1 })]);

    expect(moved.ok).toBe(true);
  });
});
