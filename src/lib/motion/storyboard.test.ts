import { describe, expect, it } from 'vitest';
import { MediaKind, beatHref, boardNote, clipSeek, planStoryboard, readStoryboard, storyboardSchema, type Storyboard } from './storyboard';

const beat = (act: string, title: string, intensity: number, extra: Record<string, unknown> = {}) => ({
  act,
  kind: 'ui_beat',
  title,
  intent: `why ${title}`,
  on_screen: `${title} line`,
  emotion: 'tense',
  intensity,
  duration: 3,
  ...extra
});

const board = (beats: unknown[]): Storyboard => storyboardSchema.parse({ beats });

const BOARD = board([
  beat('problem', 'Folders', 0.3),
  beat('solution', 'Prompt', 0.6, { media: ['shot'] }),
  beat('solution', 'Prompt, voice', 0.6, { branch_of: 1 }),
  beat('proof', 'Preview', 0.9),
  beat('claim', 'Logo', 0.5)
]);

const MEDIA = { shot: MediaKind.Image };

const cards = (plan: ReturnType<typeof planStoryboard>) => plan.nodes.filter((n) => String(n.data.content ?? '').startsWith('## '));
const cardOf = (plan: ReturnType<typeof planStoryboard>, title: string) => plan.nodes.findIndex((n) => String(n.data.content ?? '').startsWith(`## ${title}\n`));

describe('planStoryboard', () => {
  it('is deterministic', () => {
    expect(planStoryboard(BOARD, MEDIA)).toEqual(planStoryboard(BOARD, MEDIA));
  });

  it('writes one doc card per beat with every field the agent gave', () => {
    const plan = planStoryboard(BOARD, MEDIA);
    const proof = plan.nodes[cardOf(plan, 'Preview')];

    expect(cards(plan)).toHaveLength(5);
    expect(proof.type).toBe('doc');
    expect(proof.data.content).toContain('why Preview');
    expect(proof.data.content).toContain('Preview line');
    expect(proof.data.content).toContain('tense');
    expect(proof.data.content).toContain('3 s');
  });

  it('heads every act with its own card', () => {
    const heads = planStoryboard(BOARD, MEDIA).nodes.filter((n) => String(n.data.content ?? '').startsWith('# '));

    expect(heads.map((n) => n.data.content)).toEqual(['# Problem', '# Solution', '# Proof', '# Claim'].map((h) => expect.stringContaining(h)));
  });

  it('runs left to right in story order', () => {
    const plan = planStoryboard(BOARD, MEDIA);
    const xs = ['Folders', 'Prompt', 'Preview', 'Logo'].map((t) => plan.nodes[cardOf(plan, t)].x);

    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(4);
  });

  it('draws the emotion curve: a stronger beat sits higher', () => {
    const plan = planStoryboard(BOARD, MEDIA);
    const y = (t: string) => plan.nodes[cardOf(plan, t)].y;

    expect(y('Preview')).toBeLessThan(y('Prompt'));
    expect(y('Prompt')).toBeLessThan(y('Folders'));
  });

  it('chains the main beats and forks an alternative from the beat before it', () => {
    const plan = planStoryboard(BOARD, MEDIA);
    const edge = (a: string, b: string) => plan.edges.some((e) => e.sourceIndex === cardOf(plan, a) && e.targetIndex === cardOf(plan, b));

    expect(edge('Folders', 'Prompt')).toBe(true);
    expect(edge('Prompt', 'Preview')).toBe(true);
    expect(edge('Folders', 'Prompt, voice')).toBe(true);
    expect(edge('Prompt, voice', 'Preview')).toBe(false);
  });

  it('lands every wire on the plain input a card draws: a doc has no typed ports, and a named one would leave the line undrawn', () => {
    expect(planStoryboard(BOARD, MEDIA).edges.every((e) => e.targetHandle === null)).toBe(true);
  });

  it('puts an alternative in the same column as the beat it replaces, below it', () => {
    const plan = planStoryboard(BOARD, MEDIA);
    const main = plan.nodes[cardOf(plan, 'Prompt')];
    const alt = plan.nodes[cardOf(plan, 'Prompt, voice')];

    expect(alt.x).toBe(main.x);
    expect(alt.y).toBeGreaterThan(main.y);
  });

  it('hangs a beat picture under it as a real image node, wired to the card', () => {
    const plan = planStoryboard(BOARD, MEDIA);
    const shot = plan.nodes.findIndex((n) => n.type === 'image');

    expect(plan.nodes[shot].data).toMatchObject({ assetId: 'shot', prompt: '' });
    expect(plan.edges).toContainEqual(expect.objectContaining({ sourceIndex: shot, targetIndex: cardOf(plan, 'Prompt') }));
  });

  it('takes an alternative of a beat that is not before it as a main beat', () => {
    const plan = planStoryboard(board([beat('problem', 'A', 0.2), beat('problem', 'B', 0.2, { branch_of: 4 })]), {});

    expect(plan.edges).toContainEqual(expect.objectContaining({ sourceIndex: cardOf(plan, 'A'), targetIndex: cardOf(plan, 'B') }));
  });
});

describe('readStoryboard', () => {
  const node = (id: string, type: string, x: number, y: number, data: Record<string, unknown>) => ({ id, type, position: { x, y }, data });

  it('reads the cards left to right with the user edits, and the media the user dropped with the beat it feeds', () => {
    const read = readStoryboard(
      [
        node('b', 'doc', 900, 0, { content: '## Preview\nthe user rewrote this' }),
        node('a', 'doc', 0, 0, { content: '## Folders' }),
        node('n', 'text', 400, 600, { prompt: 'make it warmer' }),
        node('m', 'image', 900, 500, { prompt: '', assetId: 'asset-1', url: '/x' }),
        node('v', 'video', 0, 500, { prompt: 'a fox', output_asset_id: 'asset-2' })
      ],
      [{ sourceNodeId: 'm', targetNodeId: 'b' }, { sourceNodeId: 'a', targetNodeId: 'b' }]
    );

    expect(read.cards.map((c) => c.node_id)).toEqual(['a', 'n', 'b']);
    expect(read.cards[0].clip_ids).toEqual([]);
    expect(read.cards[2].text).toContain('the user rewrote this');
    expect(read.cards[1].text).toBe('make it warmer');
    expect(read.media).toEqual([
      { node_id: 'v', kind: 'video', asset_id: 'asset-2', prompt: 'a fox', for: [] },
      { node_id: 'm', kind: 'image', asset_id: 'asset-1', prompt: '', for: ['b'] }
    ]);
    expect(read.flow).toEqual([['a', 'b']]);
  });
});

describe('a beat linked to its clips', () => {
  const beat = { editor: '/p/p/c/c/motion/m', clipIds: ['c1', 'c2'] };

  it('plays from its first clip in the editor', () => {
    expect(beatHref({ beat })).toBe('/p/p/c/c/motion/m?clip=c1');
    expect(beatHref({})).toBeNull();
    expect(beatHref({ beat: { editor: '/x', clipIds: [] } })).toBeNull();
  });

  it('is read back with the clips it plays', () => {
    const read = readStoryboard([{ id: 'a', type: 'doc', position: { x: 0, y: 0 }, data: { content: '## A', beat } }], []);

    expect(read.cards).toEqual([{ node_id: 'a', text: '## A', clip_ids: ['c1', 'c2'] }]);
  });

  it('seeks the editor to the start of the clip it names', () => {
    const doc = { tracks: [{ clips: [{ id: 'c1', from: 42 }] }] } as unknown as Parameters<typeof clipSeek>[0];

    expect(clipSeek(doc, '?clip=c1')).toBe(42);
    expect(clipSeek(doc, '?clip=gone')).toBeNull();
    expect(clipSeek(doc, '')).toBeNull();
  });
});

describe('the storyboard handed to every turn', () => {
  it('carries each card with its id, the media and an order to follow it and link the beats', () => {
    const note = boardNote({ cards: [{ node_id: 'c1', text: '## Cookie banner\nStill guessing?', clip_ids: [] }], media: [{ node_id: 'm', kind: 'image', asset_id: 'a1', prompt: '', for: ['c1'] }], flow: [] });

    expect(note).toContain('[c1]');
    expect(note).toContain('Still guessing?');
    expect(note).toContain('a1');
    expect(note).toContain('link_storyboard_beat');
  });

  it('says nothing without cards', () => {
    expect(boardNote(null)).toBeNull();
    expect(boardNote({ cards: [], media: [], flow: [] })).toBeNull();
  });
});
