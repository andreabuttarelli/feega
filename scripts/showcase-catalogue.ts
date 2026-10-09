export type DemoSource = { key: string; title: string; description: string; tags: string[]; doc: string; files: Record<string, string>; preview: string; licence?: string; posterAt?: number };

const CC0 = 'CC0-1.0';
const LIBRARY_TRACK = `drive-128 · ${CC0} · feega music library`;
const STING_TRACK = (file: string) => `${file} · ${CC0} · synthesized by feega`;

const cut = (dir: string, name: string, music = `showcase/${dir}/music.mp3`, extra: Record<string, string> = {}) => ({
  doc: `showcase/${dir}/${name}/doc.json`,
  files: { music, ...Object.fromEntries(Object.entries(extra).map(([id, file]) => [id, `showcase/${dir}/${file}`])) }
});

export const SHOWCASE: readonly DemoSource[] = [
  {
    key: 'showcase-liquid-type',
    title: 'Liquid type',
    description: 'Glass drops roll across bold type, split, blend and refract, then settle into a call to action.',
    tags: ['glass', 'typography', 'brand'],
    ...cut('liquid-type', 'wide'),
    preview: 'showcase/liquid-type/liquid-type-16x9.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-liquid-type-portrait',
    title: 'Liquid type, portrait',
    description: 'The liquid type film, cut for a 4:5 feed.',
    tags: ['glass', 'typography', 'brand'],
    ...cut('liquid-type', 'tall'),
    preview: 'showcase/liquid-type/liquid-type-9x16.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-launch-film',
    title: 'Nimbra launch film',
    description: 'A launch for an invented calendar app: a crowded week, the fix on a laptop and a phone, the numbers, the promise.',
    tags: ['launch', 'saas', 'ui'],
    ...cut('launch-film', 'wide', undefined, { logo: 'logo.svg' }),
    preview: 'showcase/launch-film/launch-film-16x9.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-launch-film-square',
    title: 'Nimbra launch film, square',
    description: 'The Nimbra launch, cut for a square feed.',
    tags: ['launch', 'saas', 'ui'],
    ...cut('launch-film', 'square', undefined, { logo: 'logo.svg' }),
    preview: 'showcase/launch-film/launch-film-1x1.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-material',
    title: 'Material',
    description: 'Shape, light and rhythm: a grid morphs, glass bends stripes, bars pulse, and a mark lands on the name.',
    tags: ['shapes', 'glass', 'brand'],
    ...cut('material', 'square'),
    preview: 'showcase/material/material-1x1.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-material-vertical',
    title: 'Material, vertical',
    description: 'The material film, cut for stories and reels.',
    tags: ['shapes', 'glass', 'brand'],
    ...cut('material', 'vertical'),
    preview: 'showcase/material/material-9x16.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-numbers',
    title: 'Graphyn in numbers',
    description: 'A quarterly story told in live charts: bars, a counter, a retention line, a share donut and a dashboard.',
    tags: ['data', 'charts', 'saas'],
    ...cut('numbers', 'wide', undefined, { logo: 'logo.svg' }),
    preview: 'showcase/numbers/numbers-16x9.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-numbers-square',
    title: 'Graphyn in numbers, square',
    description: 'The chart story, cut for a square feed.',
    tags: ['data', 'charts', 'saas'],
    ...cut('numbers', 'square', undefined, { logo: 'logo.svg' }),
    preview: 'showcase/numbers/numbers-1x1.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-logo-sting',
    title: 'Logo sting',
    description: 'A liquid drop melts away to reveal the logo and a tagline, in six seconds.',
    tags: ['logo', 'intro', 'glass'],
    ...cut('logo-sting', 'sting', 'showcase/logo-sting/sting-6.mp3', { logo: 'logo.svg' }),
    preview: 'showcase/logo-sting/sting-16x9.mp4',
    licence: STING_TRACK('sting-6.mp3')
  },
  {
    key: 'showcase-logo-loop',
    title: 'Logo loop',
    description: 'A four-second seamless loop of the logo under a moving glass drop, for a profile or a background.',
    tags: ['logo', 'loop', 'glass'],
    ...cut('logo-sting', 'loop', 'showcase/logo-sting/loop-4.mp3', { logo: 'logo.svg' }),
    preview: 'showcase/logo-sting/sting-loop-1x1.mp4',
    licence: STING_TRACK('loop-4.mp3')
  },
  {
    key: 'showcase-logo-outro',
    title: 'Logo outro',
    description: 'An end card for reels: logo, handle, a follow button and a link.',
    tags: ['logo', 'outro', 'social'],
    ...cut('logo-sting', 'outro', 'showcase/logo-sting/outro-8.mp3', { logo: 'logo.svg' }),
    preview: 'showcase/logo-sting/outro-9x16.mp4',
    licence: STING_TRACK('outro-8.mp3')
  },
  {
    key: 'showcase-ui-focus',
    title: 'One part at a time',
    description: 'A product flow told one element per beat: the field typing, the button pressed, the progress bar, the result.',
    tags: ['ui', 'saas', 'product'],
    ...cut('ui-focus', 'wide'),
    preview: 'showcase/ui-focus/ui-focus-16x9.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-drop',
    title: 'Product drop',
    description: 'A four-beat product drop: the teaser, the product, a rolling price with the date, and the pre-order call.',
    tags: ['product', 'ecommerce', 'launch'],
    ...cut('drop', 'vertical', undefined, { product: 'product.svg' }),
    preview: 'showcase/drop/drop-9x16.mp4',
    licence: LIBRARY_TRACK
  },
  {
    key: 'showcase-drop-portrait',
    title: 'Product drop, portrait',
    description: 'The product drop, cut for a 4:5 feed.',
    tags: ['product', 'ecommerce', 'launch'],
    ...cut('drop', 'portrait', undefined, { product: 'product.svg' }),
    preview: 'showcase/drop/drop-4x5.mp4',
    licence: LIBRARY_TRACK
  }
];
