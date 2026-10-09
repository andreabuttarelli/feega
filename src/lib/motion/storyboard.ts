import { z } from 'zod';
import { ACTS, Act } from './script';
import { nodeSize } from '$lib/canvas/node-size';
import { PLACEMENT_GAP } from '$lib/canvas/placement';
import type { DuplicatePlan, DuplicatedEdge, DuplicatedNode } from '$lib/canvas/duplicate-plan';

export enum BeatKind {
  TitleCard = 'title_card',
  UiBeat = 'ui_beat',
  ProductShot = 'product_shot',
  Scene = 'scene',
  Logo = 'logo'
}

export enum MediaKind {
  Image = 'image',
  Video = 'video'
}

const TEXT = 400;
const MAX_BEATS = 40;
const MAX_MEDIA = 4;

export const beatSchema = z.object({
  act: z.enum(ACTS),
  kind: z.enum(BeatKind),
  title: z.string().min(1).max(120),
  intent: z.string().min(3).max(TEXT),
  on_screen: z.string().max(TEXT).default(''),
  emotion: z.string().min(2).max(60),
  intensity: z.number().min(0).max(1),
  duration: z.number().positive().max(60),
  visual: z.string().max(TEXT).default(''),
  music: z.string().max(TEXT).default(''),
  media: z.array(z.string()).max(MAX_MEDIA).default([]),
  branch_of: z.number().int().min(0).optional()
});

export const storyboardSchema = z.object({ beats: z.array(beatSchema).min(1).max(MAX_BEATS) });

export type Beat = z.infer<typeof beatSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;

const DOC = 'doc';
const CARD = nodeSize(DOC);
const MEDIA_SIZE = nodeSize(MediaKind.Image);
const COLUMN = CARD.w + PLACEMENT_GAP;
const CURVE_TOP = CARD.h + PLACEMENT_GAP;
const CURVE_SPAN = CARD.h * 2;
const BRANCH_DROP = CARD.h + PLACEMENT_GAP;
const MEDIA_STEP = MEDIA_SIZE.h + PLACEMENT_GAP;
const MEDIA_TOP = CURVE_TOP + CURVE_SPAN + BRANCH_DROP + CARD.h + PLACEMENT_GAP;
const FLOW = 'derives_from';

const MEDIA_HANDLE: Record<MediaKind, string> = { [MediaKind.Image]: 'images', [MediaKind.Video]: 'videos' };

const ACT_NAME: Record<Act, string> = { [Act.Problem]: 'Problem', [Act.Solution]: 'Solution', [Act.Proof]: 'Proof', [Act.Claim]: 'Claim' };

const KIND_NAME: Record<BeatKind, string> = {
  [BeatKind.TitleCard]: 'title card',
  [BeatKind.UiBeat]: 'UI beat',
  [BeatKind.ProductShot]: 'product shot',
  [BeatKind.Scene]: 'scene',
  [BeatKind.Logo]: 'logo'
};

const SCALE = 10;

export function cardText(beat: Beat): string {
  const field = (label: string, value: string) => (value ? [`**${label}** ${value}`] : []);
  return [
    `## ${beat.title}`,
    `${ACT_NAME[beat.act]} · ${KIND_NAME[beat.kind]} · ${beat.duration} s`,
    `**emotion** ${beat.emotion} (${Math.round(beat.intensity * SCALE)}/${SCALE})`,
    ...field('intent', beat.intent),
    ...field('on screen', beat.on_screen ? `"${beat.on_screen}"` : ''),
    ...field('visual', beat.visual),
    ...field('music', beat.music)
  ].join('\n\n');
}

const isBranch = (beats: Beat[], i: number) => {
  const of = beats[i].branch_of;
  return of !== undefined && of < i && beats[of].branch_of === undefined;
};

const mediaData = (assetId: string) => ({ prompt: '', assetId });

export function planStoryboard(board: Storyboard, media: Record<string, MediaKind>): DuplicatePlan {
  const beats = board.beats;
  const nodes: DuplicatedNode[] = [];
  const edges: DuplicatedEdge[] = [];
  const place = (type: string, data: Record<string, unknown>, x: number, y: number) => nodes.push({ sourceIndex: nodes.length, type, data, x, y }) - 1;
  const wire = (from: number, to: number, handle: string) => edges.push({ sourceIndex: from, targetIndex: to, sourceHandle: FLOW, targetHandle: handle });

  const column = new Map<number, number>();
  const before = new Map<number, number | null>();
  let col = 0;
  let previous: number | null = null;
  beats.forEach((b, i) => {
    if (isBranch(beats, i)) {
      column.set(i, column.get(b.branch_of!)!);
      before.set(i, before.get(b.branch_of!)!);
      return;
    }
    column.set(i, col++);
    before.set(i, previous);
    previous = i;
  });

  for (const act of ACTS) {
    const first = beats.findIndex((b, i) => b.act === act && !isBranch(beats, i));
    if (first >= 0) {
      place(DOC, { content: `# ${ACT_NAME[act]}`, public: false }, column.get(first)! * COLUMN, 0);
    }
  }

  const card = new Map<number, number>();
  beats.forEach((b, i) => {
    const y = CURVE_TOP + (1 - b.intensity) * CURVE_SPAN + (isBranch(beats, i) ? BRANCH_DROP : 0);
    card.set(i, place(DOC, { content: cardText(b), public: false }, column.get(i)! * COLUMN, y));
  });

  beats.forEach((b, i) => {
    const prior = before.get(i);
    if (prior !== null && prior !== undefined) {
      wire(card.get(prior)!, card.get(i)!, 'text');
    }
    const ids = b.media.filter((id) => media[id]);
    ids.forEach((id, k) => {
      const kind = media[id];
      const at = place(kind, mediaData(id), column.get(i)! * COLUMN, MEDIA_TOP + k * MEDIA_STEP + (isBranch(beats, i) ? BRANCH_DROP : 0));
      wire(at, card.get(i)!, MEDIA_HANDLE[kind]);
    });
  });

  return { nodes, edges };
}

type BoardNode = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> };
type BoardEdge = { sourceNodeId: string; targetNodeId: string };

const TEXT_OF: Record<string, (data: Record<string, unknown>) => string> = {
  doc: (d) => String(d.content ?? ''),
  text: (d) => String(d.prompt ?? '')
};

const MEDIA_TYPES: readonly string[] = [MediaKind.Image, MediaKind.Video];

const assetOf = (data: Record<string, unknown>) => (typeof data.assetId === 'string' ? data.assetId : typeof data.output_asset_id === 'string' ? data.output_asset_id : null);

export type StoryboardRead = {
  cards: { node_id: string; text: string }[];
  media: { node_id: string; kind: string; asset_id: string | null; prompt: string; for: string[] }[];
  flow: [string, string][];
};

export function readStoryboard(nodes: BoardNode[], edges: BoardEdge[]): StoryboardRead {
  const ordered = [...nodes].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
  const kinds = new Map(nodes.map((n) => [n.id, n.type]));
  const isCard = (id: string) => TEXT_OF[kinds.get(id) ?? ''] !== undefined;

  return {
    cards: ordered.filter((n) => TEXT_OF[n.type]).map((n) => ({ node_id: n.id, text: TEXT_OF[n.type](n.data) })),
    media: ordered
      .filter((n) => MEDIA_TYPES.includes(n.type))
      .map((n) => ({ node_id: n.id, kind: n.type, asset_id: assetOf(n.data), prompt: String(n.data.prompt ?? ''), for: edges.filter((e) => e.sourceNodeId === n.id && isCard(e.targetNodeId)).map((e) => e.targetNodeId) })),
    flow: edges.filter((e) => isCard(e.sourceNodeId) && isCard(e.targetNodeId)).map((e) => [e.sourceNodeId, e.targetNodeId])
  };
}
