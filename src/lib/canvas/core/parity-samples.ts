import type { NodeType } from '$lib/canvas/node-data';

export const PARITY_SAMPLES: Record<NodeType, Record<string, unknown>> = {
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
