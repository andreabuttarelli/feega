import { FrameKind } from '../motion-node';
import { NODE_KIND_LABEL, NameTag } from '../node-label';
import { NODE_EMPTY_HINT } from '../node-empty';
import { isNodeType, type NodeType } from '../node-data';
import { isUploadedNodeRow } from '../uploaded-node';
import type { Poster } from '../poster-lod';
import type { GenTileView } from '../gen-tile-view';
import type { SourceTile } from '../source-thumbs';
import { selectView, type BatchView, type NodeView, type SelectView } from '../node-view';
import { EMBED_REFUSAL_HINT, normalizeEmbedUrl, sourceOf } from '../iframe-node';

export enum Surface {
  Generate = 'generate',
  Media = 'media',
  Frame = 'frame',
  Graphic = 'graphic',
  Text = 'text',
  Source = 'source',
  Preview = 'preview',
  Person = 'person',
  Empty = 'empty',
  Pick = 'pick',
  Embed = 'embed',
  Select = 'select',
  Effects = 'effects',
  List = 'list',
  Doc = 'doc',
  Blank = 'blank'
}

export type FaceTile = { id: string; kind?: string; tag?: NameTag; displayName?: string | null; poster?: Poster };

export type Media = { url: string; video: boolean };

export type CardRow = { lead: string; text: string; thumb: string | null; status: string | null };

export type EmbedFace = { mode: 'url' | 'html'; url: string; code: string; hint: string | null; note: string | null };

export type CardFace = {
  surface: Surface;
  kind: NodeType | null;
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
  tiles: SourceTile[];
  empty: string;
  gen: GenTileView | null;
  actions: string[];
  embed: EmbedFace | null;
  select: SelectView | null;
  batch: BatchView | null;
  rows: CardRow[];
  pills: string[];
  count: string;
};

type Data = Record<string, unknown>;
type AssetUrl = (id: string) => string;
type Draw = (d: Data, asset: AssetUrl, t: FaceTile, view?: NodeView | null) => Partial<CardFace>;

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

const hollow =
  (kind: NodeType): Draw =>
  () => ({ surface: Surface.Empty, title: NODE_KIND_LABEL[kind], subtitle: NODE_EMPTY_HINT[kind] });

const OPEN_EDITOR = 'Open editor';
const COMPONENT = 'Component';
const COMPOSITION_EMPTY = 'Connect images, videos or motions';
const EFFECTS_PENDING = 'Not applied';
const EFFECTS_EMPTY = 'Connect an image or a video';
const PASTE = 'Paste an address';

function embedFace(d: Data): Partial<CardFace> {
  const url = str(d.url);
  const code = str(d.html);
  const mode = sourceOf({ url, html: code });
  const verdict = normalizeEmbedUrl(url);
  const refusal = url.trim() && !verdict.ok ? verdict.why : null;
  const shown = mode === 'url' && !verdict.ok;
  return { surface: Surface.Embed, embed: { mode, url, code, hint: shown ? (refusal ?? PASTE) : null, note: mode === 'url' && verdict.ok ? EMBED_REFUSAL_HINT : null } };
}

const feedTitle = (d: Data): string => (str(d.handle).trim() ? `@${str(d.handle)} · ${str(d.platform) || 'instagram'}` : 'Feed social');

const productsTitle = (d: Data): string => (str(d.url).trim() ? str(d.url).replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Products');

const SYNCING = 'syncing…';

const preview =
  (title: (d: Data) => string, unset: string, unsynced: string, configured: (d: Data) => boolean): Draw =>
  (d, _asset, _t, view) => {
    const tiles = view?.source?.tiles ?? [];
    const total = view?.source?.total ?? 0;
    const failed = str(d.sync_status) === 'failed' && str(d.sync_error);
    return {
      surface: Surface.Preview,
      title: title(d),
      count: str(d.sync_status) === 'running' ? SYNCING : total ? `${tiles.length}/${total}` : '',
      error: failed ? str(d.sync_error) : null,
      empty: total ? 'No results with these filters.' : configured(d) ? unsynced : unset,
      tiles
    };
  };

const listFace: Draw = (d, asset) => {
  const items = Array.isArray(d.items) ? (d.items as Data[]) : [];
  const images = d.itemKind !== 'text';
  return {
    surface: Surface.List,
    pills: [images ? 'Images' : 'Text'],
    count: String(items.length),
    rows: items.map((item, i) => ({ lead: String(i + 1), text: str(item.text) || str(item.label) || String(i + 1), thumb: images ? str(item.url) || (str(item.asset_id) ? asset(str(item.asset_id)) : null) || null : null, status: str(item.status) || null }))
  };
};

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
  doc: (d) => ({ surface: Surface.Doc, text: str(d.content), pills: ['Read', 'Write'], count: d.public === true ? 'Revoke' : 'Public link' }),
  iframe: embedFace,
  social_account_feed: preview(feedTitle, 'Select the node to choose the account.', 'No posts yet. Select the node to sync.', (d) => str(d.handle).trim() !== ''),
  social_post_mockup: hollow('social_post_mockup'),
  products: preview(productsTitle, 'Select the node to enter the store address.', 'No products yet. Select the node to sync.', (d) => str(d.url).trim() !== ''),
  ads: hollow('ads'),
  influencer: (_d, _a, _t, view) => ({ surface: Surface.Person, title: view?.source?.name ?? '', tiles: view?.source?.tiles.slice(0, 1) ?? [], count: String(view?.source?.total ?? 0) }),
  list: listFace,
  select: (d, _a, _t, view) => ({ surface: Surface.Select, select: view?.select ?? selectView(typeof d.index === 'number' ? d.index : 1, null, [], {}, false), count: String(typeof d.index === 'number' ? d.index : 1) }),
  effects: (d, _a, _t, view) => ({ surface: Surface.Effects, media: view?.media?.url ? { url: view.media.url, video: view.media.kind === 'video' } : null, subtitle: ref(d) ? '' : EFFECTS_PENDING, empty: EFFECTS_EMPTY, actions: [OPEN_EDITOR] }),
  composition: (d, asset) => ({ surface: Surface.Effects, media: ref(d) ? { url: asset(ref(d)!), video: true } : null, empty: COMPOSITION_EMPTY, actions: [COMPONENT, OPEN_EDITOR] }),
  calendar: hollow('calendar'),
  studio_batch: (_d, _a, _t, view) => ({ surface: Surface.Pick, title: 'Open Photo studio', batch: view?.batch ?? null })
};

const BLANK: CardFace = {
  surface: Surface.Blank,
  kind: null,
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
  tiles: [],
  empty: '',
  gen: null,
  actions: [],
  embed: null,
  select: null,
  batch: null,
  rows: [],
  pills: [],
  count: ''
};

function labelOf(t: FaceTile, kind: NodeType): string | null {
  if (t.tag === NameTag.Hidden) {
    return null;
  }
  return t.displayName?.trim() || NODE_KIND_LABEL[kind];
}

export function faceOf(t: FaceTile, data: Data, asset: AssetUrl, view: NodeView | null = null, gen: GenTileView | null = null): CardFace {
  if (!t.kind || !isNodeType(t.kind)) {
    return BLANK;
  }
  const kind = t.kind;
  const label = labelOf(t, kind);
  if (isUploadedNodeRow({ type: kind, data })) {
    return { ...BLANK, surface: Surface.Media, kind, label, media: { url: asset(str(data.assetId)), video: kind === 'video' } };
  }
  const face = { ...BLANK, kind, label, ...FACES[kind](data, asset, t, view) };
  return face.surface === Surface.Generate ? { ...face, gen } : face;
}

export const handedToCore = (face: CardFace): CardFace => ({ ...face, media: null, live: null });
