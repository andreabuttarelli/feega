import { AssetKind, TrackKind } from './components';
import { Ease, TransitionKind } from './design';
import { MotionFormat, type MotionDoc } from './doc';
import { MaskKind } from './mask';
import { FADE_OUT, RISE, assemble, edge, type Beat, type TrackSpec } from './template-kit';
import { TRAILER_V2_SECONDS, feegaTrailerV2 } from './trailer-v2';

export enum AdTemplate {
  ProductHero = 'product-hero',
  UgcVoiceover = 'ugc-voiceover',
  KineticPromo = 'kinetic-promo',
  Launch3D = 'launch-3d',
  Offer = 'before-after-offer',
  TrailerV2 = 'feega-trailer-v2',
  TrailerV2Vertical = 'feega-trailer-v2-vertical'
}

export type TemplateAssets = {
  imageId: string | null;
  secondImageId: string | null;
  videoId: string | null;
  modelId: string | null;
  musicId: string | null;
  voiceId: string | null;
};

export type PickableAsset = { id: string; kind: AssetKind; seconds?: number | null };

const known = (a: PickableAsset) => a.seconds ?? null;

function byLength(audios: PickableAsset[], order: 1 | -1): PickableAsset | null {
  const timed = audios.filter((a) => known(a) !== null).sort((x, y) => order * ((known(x) as number) - (known(y) as number)));
  return timed[0] ?? audios[0] ?? null;
}

export function templateAssets(assets: PickableAsset[]): TemplateAssets {
  const of = (kind: AssetKind) => assets.filter((a) => a.kind === kind);
  const audios = of(AssetKind.Audio);
  const music = byLength(audios, -1);
  const voice = byLength(audios.filter((a) => a !== music), 1);
  return {
    imageId: of(AssetKind.Image)[0]?.id ?? null,
    secondImageId: of(AssetKind.Image)[1]?.id ?? null,
    videoId: of(AssetKind.Video)[0]?.id ?? null,
    modelId: of(AssetKind.Model3d)[0]?.id ?? null,
    musicId: music?.id ?? null,
    voiceId: voice?.id ?? null
  };
}

type AdSpec = { label: string; format: MotionFormat; seconds: number; build: (a: TemplateAssets) => MotionDoc };

const INK = '#0a0a0a';
const WHITE = '#ffffff';

const TRACKS: TrackSpec[] = [
  { id: 'text', kind: TrackKind.Visual, name: 'Text' },
  { id: 'media', kind: TrackKind.Visual, name: 'Media' },
  { id: 'bg', kind: TrackKind.Visual, name: 'Background' },
  { id: 'vo', kind: TrackKind.Audio, name: 'Voice-over' },
  { id: 'music', kind: TrackKind.Audio, name: 'Music' }
];

const music = (a: TemplateAssets, seconds: number, volume = 0.8): Beat | null =>
  a.musicId ? { id: 'music', track: 'music', component: 'Audio', at: 0, len: seconds, props: { assetId: a.musicId, volume, fadeIn: 0.3, fadeOut: 1.5 } } : null;

const POP = { scale: [[0, 0.86], [0.3, 1, Ease.Overshoot]] } as Beat['keys'];

function productHero(a: TemplateAssets): MotionDoc {
  const benefits = ['Feather-light foam', 'Grips any street', 'Recycled knit'];
  return assemble({
    format: MotionFormat.Vertical,
    seconds: 15,
    tracks: TRACKS,
    beats: [
      { id: 'bg', track: 'bg', component: 'BrandBackground', at: 0, len: 15, props: { pattern: 'gradient' } },
      { id: 'hook-kicker', track: 'text', component: 'Kicker', at: 0.2, len: 2.4, props: { text: '( New drop )', y: 0.27, width: 0.8, size: 0.045 }, exit: FADE_OUT },
      { id: 'hook', track: 'text', component: 'Title', at: 0.25, len: 2.35, props: { text: 'Stop scrolling.\nStart running.', y: 0.45, width: 0.92, height: 0.36, size: 0.17 }, exit: FADE_OUT },
      { id: 'halo', track: 'media', component: 'Shape', at: 2.5, len: 4.7, props: { shape: 'circle', fill: 'brand.accent', y: 0.48, width: 0.72, height: 0.405, opacity: 0.9 }, keys: { scale: [[0, 0], [0.6, 1, Ease.Overshoot]] }, exit: FADE_OUT },
      {
        id: 'product',
        track: 'media',
        component: 'Image',
        at: 2.5,
        len: 4.7,
        props: { assetId: a.imageId, fit: 'contain', y: 0.48, width: 0.95, height: 0.55 },
        mask: { kind: MaskKind.Ellipse, x: 0.5, y: 0.48, width: 0, height: 0, feather: 30 },
        keys: { maskWidth: [[0, 0], [1.2, 1.6, Ease.Enter]], maskHeight: [[0, 0], [1.2, 0.9, Ease.Enter]], scale: [[0, 1.12], [4.7, 1]] },
        exit: FADE_OUT
      },
      { id: 'name-kicker', track: 'text', component: 'Kicker', at: 2.9, len: 4.3, props: { text: '( Runner One )', y: 0.13, width: 0.8, size: 0.045 }, enter: RISE, exit: FADE_OUT },
      { id: 'name', track: 'text', component: 'Title', at: 3.1, len: 4.1, props: { text: 'Made to move.', y: 0.84, width: 0.9, height: 0.12, size: 0.13 }, exit: FADE_OUT },
      { id: 'product-small', track: 'media', component: 'Image', at: 7.2, len: 4.8, props: { assetId: a.imageId, fit: 'contain', y: 0.74, width: 0.86, height: 0.4 }, enter: edge(TransitionKind.Scale, 0.5), keys: { rotateZ: [[0, -6], [4.8, 4]] }, exit: FADE_OUT },
      ...benefits.flatMap((text, i): Beat[] => [
        { id: `num-${i}`, track: 'text', component: 'Kicker', at: 7.4 + i * 0.6, len: 4.6 - i * 0.6, props: { text: `0${i + 1}`, x: 0.12, y: 0.15 + i * 0.14, width: 0.14, align: 'left', size: 0.045 }, enter: RISE, exit: FADE_OUT },
        { id: `benefit-${i}`, track: 'text', component: 'Title', at: 7.4 + i * 0.6, len: 4.6 - i * 0.6, props: { text, x: 0.57, y: 0.15 + i * 0.14, width: 0.74, height: 0.1, align: 'left', size: 0.1 }, exit: FADE_OUT }
      ]),
      { id: 'cta-bg', track: 'bg', component: 'BrandBackground', at: 12, len: 3, props: { fill: 'brand.accent' }, mask: { kind: MaskKind.Rect, x: 0.5, y: 0.5, width: 1, height: 0 }, keys: { maskHeight: [[0, 0], [0.45, 1, Ease.Enter]] } },
      { id: 'cta', track: 'text', component: 'Title', at: 12.25, len: 2.75, props: { text: 'Shop now.', y: 0.42, width: 0.92, height: 0.18, size: 0.22, color: INK } },
      { id: 'cta-url', track: 'text', component: 'Caption', at: 12.6, len: 2.4, props: { text: 'yourbrand.com', y: 0.58, width: 0.8, size: 0.055, background: INK, color: WHITE }, keys: POP },
      { id: 'logo', track: 'text', component: 'Logo', at: 12.8, len: 2.2, props: { y: 0.86, width: 0.3, height: 0.07 }, enter: RISE },
      music(a, 15)
    ]
  });
}

function ugcVoiceover(a: TemplateAssets): MotionDoc {
  const captions = ['Okay, I did not expect this.', 'Ten minutes, zero effort.', 'And it actually lasts.', 'Link in bio. Seriously.'];
  return assemble({
    format: MotionFormat.Vertical,
    seconds: 15,
    tracks: TRACKS,
    beats: [
      { id: 'bg', track: 'bg', component: 'BrandBackground', at: 0, len: 15 },
      { id: 'clip', track: 'media', component: 'Video', at: 0, len: 12, props: { assetId: a.videoId, fit: 'cover' }, keys: { scale: [[0, 1.08], [12, 1]] } },
      { id: 'shade', track: 'media', component: 'Shape', at: 0, len: 12, props: { shape: 'rect', fill: '#000000', y: 0.06, width: 1, height: 0.12, opacity: 0.35 } },
      { id: 'handle', track: 'text', component: 'Kicker', at: 0.3, len: 11.7, props: { text: '@yourbrand', y: 0.055, width: 0.8, size: 0.042, color: WHITE }, enter: RISE },
      ...captions.map((text, i): Beat => ({
        id: `caption-${i}`,
        track: 'text',
        component: 'Caption',
        at: 0.5 + i * 2.85,
        len: 2.75,
        props: { text, y: 0.74, width: 0.92, size: 0.06, background: WHITE, color: '#111111' },
        keys: POP
      })),
      { id: 'end-bg', track: 'bg', component: 'BrandBackground', at: 12, len: 3, props: { pattern: 'dots' }, mask: { kind: MaskKind.Ellipse, x: 0.5, y: 0.5, width: 0, height: 0 }, keys: { maskWidth: [[0, 0], [0.6, 2.4, Ease.Enter]], maskHeight: [[0, 0], [0.6, 1.4, Ease.Enter]] } },
      { id: 'end', track: 'text', component: 'Title', at: 12.25, len: 2.75, props: { text: 'Try it today.', y: 0.45, width: 0.92, height: 0.18, size: 0.2 } },
      { id: 'end-cta', track: 'text', component: 'Caption', at: 12.6, len: 2.4, props: { text: 'Shop at yourbrand.com', y: 0.6, width: 0.9, size: 0.055, background: 'brand.accent', color: WHITE }, keys: POP },
      a.voiceId ? { id: 'voice', track: 'vo', component: 'Audio', at: 0.4, len: 11.4, props: { assetId: a.voiceId, volume: 1, fadeOut: 0.3 } } : null,
      music(a, 15, 0.25)
    ]
  });
}

function kineticPromo(a: TemplateAssets): MotionDoc {
  const punch = (id: string, text: string, at: number, len: number, size: number): Beat => ({
    id,
    track: 'text',
    component: 'Title',
    at,
    len,
    props: { text, y: 0.5, width: 0.92, height: 0.4, size },
    keys: { scale: [[0, 1.25], [0.25, 1, Ease.Enter]] }
  });
  return assemble({
    format: MotionFormat.Square,
    seconds: 15,
    tracks: TRACKS,
    beats: [
      {
        id: 'bg',
        track: 'bg',
        component: 'BrandBackground',
        at: 0,
        len: 15,
        keys: { fill: [[0, 'brand.background'], [2.95, 'brand.background'], [3, 'brand.accent', Ease.Linear], [5.95, 'brand.accent'], [6, 'brand.background', Ease.Linear]] }
      },
      punch('w1', 'THIS', 0.2, 0.7, 0.3),
      punch('w2', 'WEEK', 0.9, 0.7, 0.3),
      punch('w3', 'ONLY', 1.6, 0.7, 0.3),
      punch('w4', 'BIG', 2.3, 0.7, 0.4),
      { id: 'sale', track: 'text', component: 'Title', at: 3, len: 3, props: { text: 'SUMMER\nSALE', y: 0.5, width: 0.9, height: 0.6, size: 0.24, color: INK }, keys: { rotateZ: [[0, -4], [3, 0]], scale: [[0, 0.9], [3, 1.05]] } },
      { id: 'up-to', track: 'text', component: 'Kicker', at: 6.1, len: 3.9, props: { text: 'Up to', y: 0.16, width: 0.6, size: 0.05 }, enter: RISE, exit: FADE_OUT },
      {
        id: 'product-in-type',
        track: 'media',
        component: 'Image',
        at: 6,
        len: 4,
        props: { assetId: a.imageId, fit: 'cover', width: 1, height: 1 },
        mask: { kind: MaskKind.Text, text: '40%', x: 0.5, y: 0.5, width: 0.95, height: 0.5 },
        keys: { scale: [[0, 1.3], [4, 1]], maskWidth: [[0, 0.8], [0.5, 0.95, Ease.Enter]] },
        exit: FADE_OUT
      },
      { id: 'off', track: 'text', component: 'Kicker', at: 6.4, len: 3.6, props: { text: 'Off everything', y: 0.84, width: 0.8, size: 0.05 }, enter: RISE, exit: FADE_OUT },
      { id: 'ends', track: 'text', component: 'Title', at: 10.1, len: 4.9, props: { text: 'Ends Sunday.', y: 0.42, width: 0.9, height: 0.2, size: 0.15 } },
      { id: 'cta', track: 'text', component: 'Caption', at: 10.6, len: 4.4, props: { text: 'Shop the sale', y: 0.62, width: 0.8, size: 0.05, background: 'brand.accent', color: WHITE }, keys: POP },
      { id: 'logo', track: 'text', component: 'Logo', at: 11, len: 4, props: { y: 0.85, width: 0.24, height: 0.08 }, enter: RISE },
      music(a, 15)
    ]
  });
}

function launch3d(a: TemplateAssets): MotionDoc {
  const chapters: [string, string, number][] = [
    ['( Introducing )', 'Aero One.', 0.4],
    ['( 01 ) Weight', '182 g.\nFeels like air.', 5],
    ['( 02 ) Build', 'One-piece\nknit shell.', 10],
    ['( 03 ) Launch', 'Pre-order\nnow.', 15]
  ];
  const product: Beat = a.modelId
    ? { id: 'product', track: 'media', component: 'Model3D', at: 0.3, len: 19.7, props: { assetId: a.modelId, x: 0.75, width: 0.5, startAngle: -70, endAngle: 290, zoom: 1.1, lighting: 'dramatic' }, keys: { opacity: [[0, 0], [1, 1]] } }
    : { id: 'product', track: 'media', component: 'Shape3D', at: 0.3, len: 19.7, props: { shape: 'torus', x: 0.75, width: 0.5, orbitSpeed: 40, lighting: 'dramatic' }, keys: { opacity: [[0, 0], [1, 1]] } };
  return assemble({
    format: MotionFormat.Landscape,
    seconds: 20,
    tracks: TRACKS,
    beats: [
      { id: 'bg', track: 'bg', component: 'BrandBackground', at: 0, len: 20, props: { pattern: 'gradient' } },
      product,
      ...chapters.flatMap(([kicker, title, at], i): Beat[] => {
        const len = i === chapters.length - 1 ? 20 - at : 4.6;
        return [
          { id: `kicker-${i}`, track: 'text', component: 'Kicker', at, len, props: { text: kicker, x: 0.3, y: 0.24, width: 0.5, align: 'left', size: 0.035 }, enter: RISE, exit: FADE_OUT },
          {
            id: `title-${i}`,
            track: 'text',
            component: 'Title',
            at: at + 0.1,
            len: len - 0.1,
            props: { text: title, x: 0.3, y: 0.5, width: 0.5, height: 0.42, align: 'left', size: 0.19 },
            mask: { kind: MaskKind.Rect, x: 0.3, y: 0.5, width: 0, height: 0.5, feather: 8 },
            keys: { maskWidth: [[0, 0], [0.7, 0.6, Ease.Enter]] },
            exit: FADE_OUT
          },
          { id: `rule-${i}`, track: 'text', component: 'Shape', at: at + 0.3, len: len - 0.3, props: { shape: 'line', x: 0.3, y: 0.76, width: 0.5, height: 0.004 }, exit: FADE_OUT }
        ];
      }),
      { id: 'ship', track: 'text', component: 'Caption', at: 15.8, len: 4.2, props: { text: 'Ships 12 May', x: 0.3, y: 0.86, width: 0.5, align: 'left', size: 0.04, background: 'brand.accent', color: WHITE }, keys: POP },
      music(a, 20)
    ]
  });
}

function beforeAfterOffer(a: TemplateAssets): MotionDoc {
  const wipe: Beat['keys'] = { maskWidth: [[1, 1], [4.5, 0]], maskX: [[1, 0.5], [4.5, 0]] };
  return assemble({
    format: MotionFormat.Vertical,
    seconds: 15,
    tracks: TRACKS,
    beats: [
      { id: 'bg', track: 'bg', component: 'BrandBackground', at: 0, len: 15 },
      { id: 'after', track: 'media', component: 'Image', at: 0, len: 7, props: { assetId: a.secondImageId ?? a.imageId, fit: 'cover', width: 1, height: 1 }, exit: FADE_OUT },
      { id: 'before', track: 'media', component: 'Image', at: 0, len: 7, props: { assetId: a.imageId, fit: 'cover', width: 1, height: 1 }, mask: { kind: MaskKind.Rect, x: 0.5, y: 0.5, width: 1, height: 1 }, keys: wipe, exit: FADE_OUT },
      { id: 'divider', track: 'media', component: 'Shape', at: 0, len: 7, props: { shape: 'rect', fill: WHITE, width: 0.02, height: 1 }, transform: { scaleX: 0.4 }, keys: { x: [[1, 0.5], [4.5, -0.5]] }, exit: FADE_OUT },
      { id: 'before-label', track: 'text', component: 'Caption', at: 0.3, len: 4, props: { text: 'BEFORE', x: 0.18, y: 0.08, width: 0.3, size: 0.032, background: INK, color: WHITE }, exit: FADE_OUT },
      { id: 'after-label', track: 'text', component: 'Caption', at: 0.3, len: 6.7, props: { text: 'AFTER', x: 0.82, y: 0.08, width: 0.3, size: 0.032, background: 'brand.accent', color: WHITE }, exit: FADE_OUT },
      { id: 'offer-bg', track: 'bg', component: 'BrandBackground', at: 7, len: 8, props: { fill: 'brand.accent', pattern: 'dots', accent: INK }, enter: edge(TransitionKind.Wipe, 0.5) },
      { id: 'offer-kicker', track: 'text', component: 'Kicker', at: 7.3, len: 7.7, props: { text: '( This week )', y: 0.24, width: 0.8, size: 0.035, color: INK }, enter: RISE },
      { id: 'offer', track: 'text', component: 'Title', at: 7.4, len: 7.6, props: { text: '-30%', y: 0.4, width: 0.9, height: 0.22, size: 0.32, color: INK }, keys: { scale: [[0, 0.6], [0.45, 1, Ease.Overshoot]] } },
      { id: 'code', track: 'text', component: 'Text', at: 8, len: 7, props: { text: 'Code SPRING30 · ends Sunday', y: 0.56, width: 0.86, height: 0.06, size: 0.045, color: INK } },
      { id: 'claim', track: 'text', component: 'Caption', at: 8.5, len: 6.5, props: { text: 'Claim the offer', y: 0.68, width: 0.8, size: 0.05, background: INK, color: WHITE }, keys: POP },
      { id: 'logo', track: 'text', component: 'Logo', at: 9, len: 6, props: { y: 0.88, width: 0.3, height: 0.07 }, enter: RISE },
      music(a, 15)
    ]
  });
}

export const AD_TEMPLATES: Record<AdTemplate, AdSpec> = {
  [AdTemplate.ProductHero]: { label: 'Product hero · 9:16', format: MotionFormat.Vertical, seconds: 15, build: productHero },
  [AdTemplate.UgcVoiceover]: { label: 'UGC with voice-over · 9:16', format: MotionFormat.Vertical, seconds: 15, build: ugcVoiceover },
  [AdTemplate.KineticPromo]: { label: 'Kinetic text promo · 1:1', format: MotionFormat.Square, seconds: 15, build: kineticPromo },
  [AdTemplate.Launch3D]: { label: '3D product launch · 16:9', format: MotionFormat.Landscape, seconds: 20, build: launch3d },
  [AdTemplate.Offer]: { label: 'Before / after offer · 9:16', format: MotionFormat.Vertical, seconds: 15, build: beforeAfterOffer },
  [AdTemplate.TrailerV2]: { label: 'feega trailer v2 · 16:9', format: MotionFormat.Landscape, seconds: TRAILER_V2_SECONDS, build: (a) => feegaTrailerV2(MotionFormat.Landscape, a) },
  [AdTemplate.TrailerV2Vertical]: { label: 'feega trailer v2 · 9:16', format: MotionFormat.Vertical, seconds: TRAILER_V2_SECONDS, build: (a) => feegaTrailerV2(MotionFormat.Vertical, a) }
};

export const AD_TEMPLATE_IDS = Object.values(AdTemplate);
