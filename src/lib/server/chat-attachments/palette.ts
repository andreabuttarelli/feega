import sharp from 'sharp';

export type Swatch = { hex: string; share: number };

const SAMPLE_PX = 64;
const LEVEL_BITS = 5;
const MIN_SHARE = 0.03;
const MAX_SWATCHES = 6;
const CHANNEL_MAX = 255;
const SAME_COLOUR = 80;

enum Ground {
  Dark = 'dark',
  Mid = 'mid-tone',
  Bright = 'bright'
}

const GROUND_FROM: readonly (readonly [number, Ground])[] = [
  [0.6, Ground.Bright],
  [0.25, Ground.Mid],
  [0, Ground.Dark]
];

type Bucket = { n: number; r: number; g: number; b: number };

const meanOf = (b: Bucket) => [b.r / b.n, b.g / b.n, b.b / b.n];

const distance = (a: Bucket, b: Bucket) => Math.hypot(...meanOf(a).map((v, i) => v - meanOf(b)[i]));

function merged(buckets: readonly Bucket[]): Bucket[] {
  return buckets.reduce<Bucket[]>((kept, bucket) => {
    const near = kept.findIndex((k) => distance(k, bucket) < SAME_COLOUR);
    if (near < 0) {
      return [...kept, bucket];
    }
    const k = kept[near];
    return kept.map((c, i) => (i === near ? { n: k.n + bucket.n, r: k.r + bucket.r, g: k.g + bucket.g, b: k.b + bucket.b } : c));
  }, []);
}

const hexOf = (b: Bucket) => `#${[b.r, b.g, b.b].map((sum) => Math.round(sum / b.n).toString(16).padStart(2, '0')).join('')}`;

export async function paletteOf(image: Buffer): Promise<Swatch[]> {
  const { data, info } = await sharp(image).removeAlpha().resize(SAMPLE_PX, SAMPLE_PX, { fit: 'inside', kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, Bucket>();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = ((r >> LEVEL_BITS) << 6) | ((g >> LEVEL_BITS) << 3) | (b >> LEVEL_BITS);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    buckets.set(key, { n: bucket.n + 1, r: bucket.r + r, g: bucket.g + g, b: bucket.b + b });
  }
  const pixels = data.length / info.channels;
  return merged([...buckets.values()].sort((a, b) => b.n - a.n))
    .sort((a, b) => b.n - a.n)
    .map((b) => ({ hex: hexOf(b), share: b.n / pixels }))
    .filter((s) => s.share >= MIN_SHARE)
    .slice(0, MAX_SWATCHES);
}

const valueOf = (hex: string) => Math.max(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))) / CHANNEL_MAX;

const groundOf = (hex: string) => GROUND_FROM.find(([from]) => valueOf(hex) >= from)![1];

export function paletteNote(palette: readonly Swatch[]): string {
  if (!palette.length) {
    return '';
  }
  const colours = palette.map((s) => `${s.hex} ${Math.round(s.share * 100)}%`).join(', ');
  return `Its palette, by share of the picture: ${colours}. The ground is ${groundOf(palette[0].hex)} (${palette[0].hex}). When it is a reference, the video takes these colours in these proportions (the largest one as the ground, never a darker or different one), not the brand's or the house palette.`;
}
