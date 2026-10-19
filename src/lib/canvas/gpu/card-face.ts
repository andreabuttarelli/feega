import { FrameKind } from '../motion-node';
import { NODE_KIND_LABEL, NameTag } from '../node-label';
import { NODE_EMPTY_HINT } from '../node-empty';
import { isNodeType, type NodeType } from '../node-data';
import { isUploadedNodeRow } from '../uploaded-node';
import type { Poster } from '../poster-lod';
import type { GenTileView } from '../gen-tile-view';

export enum Surface {
  Generate = 'generate',
  Media = 'media',
  Frame = 'frame',
  Graphic = 'graphic',
  Text = 'text',
  Source = 'source',
  Empty = 'empty',
  Blank = 'blank'
}

export type FaceTile = { id: string; kind?: string; tag?: NameTag; displayName?: string | null; poster?: Poster };

export type Media = { url: string; video: boolean };

export type CardFace = {
  surface: Surface;
  label: string | null;
  media: Media | null;
  live: string | null;
  prompt: string;
  model: string | null;
  running: boolean;
  error: string | null;
  text: string;
  title: string;
  subtitle: string;
  thumbs: string[];
  gen: GenTileView | null;
  kind: NodeType | null;
  hint: string;
};

type Data = Record<string, unknown>;
type AssetUrl = (id: string) => string;
type Draw = (d: Data, asset: AssetUrl, t: FaceTile) => Partial<CardFace>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const ref = (d: Data): string | null => str(d.refId) || str(d.assetId) || str(d.output_asset_id) || null;

const generate =
  (video: boolean): Draw =>
  (d, asset) => {
    const out = ref(d);
    return {
      surface: Surface.Generate,
      media: out ? { url: asset(out), video } : null,
      prompt: str(d.prompt),
      model: str(d.model) || null,
      running: d.running === true || d.status === 'running',
      error: str(d.error) || null,
      text: str(d.text) || str(d.output)
    };
  };

const textGenerate: Draw = (d, asset, t) => ({ ...generate(false)(d, asset, t), media: null });

const source =
  (title: (d: Data) => string, subtitle: (d: Data) => string = () => ''): Draw =>
  (d) => ({ surface: Surface.Source, title: title(d), subtitle: subtitle(d) });

const empty: Draw = (_d, _asset, t) => ({ surface: Surface.Empty, title: NODE_KIND_LABEL[t.kind as NodeType], hint: NODE_EMPTY_HINT[t.kind as NodeType] });

const motion: Draw = (d, asset, t) => {
  const kind = str(d.kind) || FrameKind.Frame;
  const live = str(d.lastRenderAssetId);
  const rev = typeof d.docHeadRevision === 'number' && d.docHeadRevision ? `Rev ${d.docHeadRevision}` : 'Empty';
  return {
    surface: kind === FrameKind.Frame ? Surface.Frame : Surface.Graphic,
    subtitle: rev,
    media: t.poster ? { url: t.poster.url, video: false } : null,
    live: live ? asset(live) : null
  };
};

const FACES: Record<NodeType, Draw> = {
  text: textGenerate,
  image: generate(false),
  video: generate(true),
  audio: textGenerate,
  model3d: (d, asset, t) => ({ ...generate(false)(d, asset, t), media: str(d.posterRefId) ? { url: asset(str(d.posterRefId)), video: false } : null }),
  motion,
  doc: (d) => ({ surface: Surface.Text, text: str(d.content) }),
  iframe: source((d) => str(d.url) || 'HTML'),
  social_account_feed: source((d) => `@${str(d.handle)}`, (d) => str(d.platform)),
  social_post_mockup: empty,
  products: source((d) => str(d.url), (d) => str(d.type)),
  ads: empty,
  influencer: source(() => ''),
  list: source((d) => `${Array.isArray(d.items) ? d.items.length : 0} items`),
  select: source((d) => `#${typeof d.index === 'number' ? d.index : 1}`),
  effects: (d, asset) => ({ surface: Surface.Source, media: ref(d) ? { url: asset(ref(d)!), video: false } : null }),
  composition: (d, asset) => ({ surface: Surface.Source, media: ref(d) ? { url: asset(ref(d)!), video: true } : null }),
  calendar: empty,
  studio_batch: source(() => '')
};

const BLANK: CardFace = {
  surface: Surface.Blank,
  label: null,
  media: null,
  live: null,
  prompt: '',
  model: null,
  running: false,
  error: null,
  text: '',
  title: '',
  subtitle: '',
  thumbs: [],
  gen: null,
  kind: null,
  hint: ''
};

function labelOf(t: FaceTile, kind: NodeType): string | null {
  if (t.tag === NameTag.Hidden) {
    return null;
  }
  return t.displayName?.trim() || NODE_KIND_LABEL[kind];
}

export function faceOf(t: FaceTile, data: Data, asset: AssetUrl, thumbs: string[] = [], gen: GenTileView | null = null): CardFace {
  if (!t.kind || !isNodeType(t.kind)) {
    return BLANK;
  }
  const kind = t.kind;
  const label = labelOf(t, kind);
  if (isUploadedNodeRow({ type: kind, data })) {
    return { ...BLANK, surface: Surface.Media, label, media: { url: asset(str(data.assetId)), video: kind === 'video' } };
  }
  const face = { ...BLANK, label, thumbs, kind, ...FACES[kind](data, asset, t) };
  return face.surface === Surface.Generate ? { ...face, gen } : face;
}

export const handedToCore = (face: CardFace): CardFace => ({ ...face, media: null, live: null });
