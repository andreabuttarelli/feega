import type { NodeType } from '$lib/canvas/node-data';
import type { NodeView } from '$lib/canvas/node-view';

export type ParitySample = { name: string; kind: NodeType; data: Record<string, unknown>; view?: NodeView };

const PHOTO = '/login-visual.webp';
const WIDE = '/og.png';

const BY_KIND: Record<NodeType, Record<string, unknown>> = {
  text: { prompt: 'Write a launch tweet for a coffee brand', model: 'Fast text' },
  image: { prompt: 'A red bicycle against a white wall', model: 'Image model' },
  video: { prompt: 'Slow dolly in on a city at night', running: true },
  audio: { prompt: 'Calm piano loop' },
  model3d: { prompt: 'A low poly fox', error: 'Provider timed out' },
  motion: { kind: 'frame' },
  doc: { content: 'Brand voice: warm, direct, never smug. Short sentences. One idea per line.' },
  iframe: { url: 'https://example.com' },
  social_account_feed: { handle: 'studio', platform: 'instagram' },
  social_post_mockup: { general: { caption: 'Monday mood: new drop, same coffee.' } },
  products: { url: 'shop.example.com', type: 'catalog' },
  ads: { page_name: 'Studio', country: 'IT' },
  influencer: {},
  list: { items: [1, 2, 3] },
  select: { index: 2 },
  effects: {},
  composition: {},
  calendar: { anchor: '2026-10', view: 'month' },
  studio_batch: {}
};

const MEDIA: ParitySample[] = [
  { name: 'image upload', kind: 'image', data: { assetId: PHOTO } },
  { name: 'image generated', kind: 'image', data: { output_asset_id: WIDE, model: 'Image model' } },
  { name: 'effects output', kind: 'effects', data: { refId: PHOTO } },
  { name: 'feed thumbs', kind: 'social_account_feed', data: { handle: 'studio', platform: 'instagram' }, view: { source: { tiles: [PHOTO, WIDE, PHOTO].map((thumb) => ({ thumb, caption: null, badge: null, sale: null })), total: 3, name: null } } }
];

export const PARITY_SAMPLES: ParitySample[] = [...(Object.entries(BY_KIND) as [NodeType, Record<string, unknown>][]).map(([kind, data]) => ({ name: kind, kind, data })), ...MEDIA];
