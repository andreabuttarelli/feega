export type AddedRow = { on: string; ids: readonly string[] };

export const SNAPCN_ADDED_ON = '2026-11-10';
const SNAPCN_ID_PREFIX = 'builtin:snapcn-';
export const HF_ADDED_ON = '2026-11-11';
const HF_ID_PREFIX = 'builtin:hyperframes-';

export const ADDED: readonly AddedRow[] = [
  { on: '2026-10-15', ids: [
    'builtin:poster-diagonal-pills',
    'builtin:poster-blue-trails',
    'builtin:poster-step-blobs',
    'builtin:poster-metaball-listing',
    'builtin:poster-pixel-burst',
    'builtin:poster-acid-strokes',
    'builtin:poster-glyph-specimen',
    'builtin:poster-stencil-steps',
    'builtin:framed-reveal',
    'builtin:showcase-scatter',
    'builtin:card-cascade'
  ] },
  { on: '2026-10-14', ids: [
    'builtin:poster-curated-board',
    'builtin:poster-repeat-lineup',
    'builtin:poster-festival-grid',
    'builtin:poster-wide-filmstrip',
    'builtin:poster-scattered-type',
    'builtin:poster-sliced-photo',
    'builtin:poster-red-number',
    'builtin:poster-haze-grid',
    'builtin:poster-flow-quote',
    'builtin:poster-stacked-plus',
    'builtin:poster-barcode-table',
    'builtin:poster-pixel-caps',
    'builtin:poster-month-grid',
    'builtin:poster-rotated-cards',
    'builtin:poster-brick-caps',
    'builtin:poster-dark-tags'
  ] },
  { on: '2026-10-13', ids: [
    'builtin:iridescent-blobs',
    'builtin:particle-ribbon',
    'builtin:flow-lines',
    'builtin:poster-type-grid',
    'builtin:poster-checker-steps',
    'builtin:poster-overlay-grid',
    'builtin:poster-circle-event',
    'builtin:poster-block-title',
    'builtin:poster-boxed-type',
    'builtin:poster-square-words',
    'builtin:poster-iso-blocks',
    'builtin:poster-photo-grid',
    'builtin:poster-white-shapes',
    'builtin:poster-vertical-type'
  ] },
  { on: '2026-10-12', ids: [
    'builtin:composition-tilted-grid',
    'builtin:composition-carousel-3d',
    'builtin:composition-media-cloud',
    'builtin:composition-media-ring',
    'builtin:composition-helix',
    'builtin:composition-explorer-grid',
    'builtin:composition-staggered-grid',
    'builtin:composition-vertical-flow',
    'builtin:composition-coverflow',
    'builtin:composition-ring',
    'builtin:composition-bento',
    'builtin:composition-marquee',
    'builtin:composition-stack',
    'builtin:composition-perspective-wall',
    'builtin:composition-film-strip',
    'builtin:composition-split-reveal',
    'builtin:composition-polaroid',
    'builtin:composition-masonry',
    'builtin:composition-slider',
    'builtin:prompt-input',
    'builtin:floating-media',
    'builtin:photo-strip',
    'builtin:feature-scroll',
    'builtin:image-globe',
    'builtin:split-headline',
    'builtin:scroll-story',
    'builtin:comment-grid',
    'builtin:saas-monitor',
    'builtin:phone-split',
    'builtin:circular-carousel',
    'builtin:parallax-grid',
    'builtin:parallax-grid-alternate',
    'builtin:parallax-grid-stagger',
    'builtin:parallax-grid-zoom',
    'builtin:parallax-grid-drift',
    'builtin:rows-spaced-title',
    'builtin:scatter-title',
    'builtin:ring-through-title',
    'builtin:editorial-words-media',
    'builtin:media-cloud-white',
    'builtin:collage-stack-rotate',
    'builtin:bracket-gradient',
    'builtin:stack-words',
    'builtin:steps-list',
    'builtin:introducing-badge',
    'builtin:melting-type-poster',
    'builtin:poster-liquid-glass',
    'builtin:wire-globe-pages',
    'builtin:phone-chat',
    'builtin:path-cards',
    'builtin:word-wheel-ui'
  ] },
  { on: '2026-10-07', ids: [
    'builtin:launch-word-burst',
    'builtin:launch-ui-speed-ramp',
    'builtin:launch-device-fly',
    'builtin:launch-number-match-cut',
    'builtin:launch-ui-tilt-zoom',
    'builtin:launch-beat-montage',
    'builtin:launch-ui-explode',
    'builtin:launch-device-orbit',
    'builtin:launch-logo-build',
    'builtin:scene-hero-title',
    'builtin:scene-eyebrow-title',
    'builtin:scene-feature-line',
    'builtin:scene-feature-line-light',
    'builtin:scene-feature-accent',
    'builtin:scene-big-number',
    'builtin:scene-quote',
    'builtin:scene-split-statement',
    'builtin:scene-product-reveal',
    'builtin:scene-ui-closeup',
    'builtin:scene-ui-window',
    'builtin:scene-device-hero',
    'builtin:scene-device-split',
    'builtin:scene-media-caption',
    'builtin:scene-dissolve',
    'builtin:scene-match-cut',
    'builtin:scene-three-points',
    'builtin:scene-logo-end-card',
    'builtin:ui-morph-reel',
    'builtin:marquee'
  ] },
  { on: '2026-10-05', ids: [
    'builtin:lower-third',
    'builtin:title-card',
    'builtin:product-reveal',
    'builtin:end-card',
    'builtin:social-stat'
  ] },
  { on: '2026-09-22', ids: [
    'builtin:quote'
  ] }
];

const addedById = new Map(ADDED.flatMap((row) => row.ids.map((id) => [id, row.on] as const)));

export function addedOn(id: string): string {
  if (id.startsWith(SNAPCN_ID_PREFIX)) {
    return SNAPCN_ADDED_ON;
  }
  if (id.startsWith(HF_ID_PREFIX)) {
    return HF_ADDED_ON;
  }
  return addedById.get(id) ?? '';
}
