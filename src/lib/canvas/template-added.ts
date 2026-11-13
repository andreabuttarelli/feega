import { LAYOUTS } from '@feega/motion-core/canvas/composition';

type AddedRow = { on: string; ids: readonly string[] };

export const CANVAS_ADDED: readonly AddedRow[] = [
  { on: '2026-11-13', ids: [
    'fx-word-weave',
    'fx-word-field',
    'fx-glyph-tiles',
    'fx-word-silhouette',
    'fx-ascii-colour',
    'fx-halftone-print',
    'fx-orange-duotone',
    'fx-shape-mosaic',
    'fx-one-bit-dither',
    ...Object.keys(LAYOUTS).map((layout) => `composition-${layout}`)
  ] },
  { on: '2026-10-02', ids: [
    'product-3d',
    'text-3d'
  ] },
  { on: '2026-10-01', ids: [
    'anime-video',
    'claymation-video',
    'paper-cutout',
    'retro-vhs',
    '3d-animation',
    'spotify-canvas',
    'ai-commercial',
    'text-to-video',
    'hd-clip'
  ] },
  { on: '2026-09-30', ids: [
    'product-lifestyle',
    'ugc-video-ad',
    'start-end-video',
    'brief-to-reel',
    'style-transfer',
    'voice-over',
    'podcast-intro',
    'moodboard',
    'caption-pack',
    'thumbnail-cover',
    'product-teaser'
  ] },
  { on: '2026-09-29', ids: [
    'video-upscale'
  ] }
];

const addedById = new Map(CANVAS_ADDED.flatMap((row) => row.ids.map((id) => [id, row.on] as const)));

export const canvasAddedOn = (id: string): string => addedById.get(id) ?? '';
