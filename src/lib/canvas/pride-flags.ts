export enum PrideFlag {
  Rainbow = 'rainbow',
  Trans = 'trans',
  Lesbian = 'lesbian',
  Bisexual = 'bisexual',
  Pansexual = 'pansexual',
  NonBinary = 'non-binary',
  Asexual = 'asexual'
}

export const PRIDE_FLAGS: readonly { flag: PrideFlag; stripes: readonly string[] }[] = [
  { flag: PrideFlag.Rainbow, stripes: ['#E40303', '#FF8C00', '#FFED00', '#008026', '#004DFF', '#750787'] },
  { flag: PrideFlag.Trans, stripes: ['#5BCEFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCEFA'] },
  { flag: PrideFlag.Lesbian, stripes: ['#D52D00', '#EF7627', '#FF9A56', '#FFFFFF', '#D162A4', '#B55690', '#A30262'] },
  { flag: PrideFlag.Bisexual, stripes: ['#D60270', '#D60270', '#9B4F96', '#0038A8', '#0038A8'] },
  { flag: PrideFlag.Pansexual, stripes: ['#FF218C', '#FFD800', '#21B1FF'] },
  { flag: PrideFlag.NonBinary, stripes: ['#FCF434', '#FFFFFF', '#9C59D1', '#2C2C2C'] },
  { flag: PrideFlag.Asexual, stripes: ['#000000', '#A3A3A3', '#FFFFFF', '#800080'] }
];

const FALLBACK = PRIDE_FLAGS.find((f) => f.flag === PrideFlag.Rainbow)!;
const KEY = 'feega:loading-flag';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function storedIndex(store: Store): number {
  try {
    const i = PRIDE_FLAGS.findIndex((f) => f.flag === store.getItem(KEY));
    return i < 0 ? -1 : i;
  } catch {
    return -1;
  }
}

export function nextFlag(store: Store) {
  const stored = storedIndex(store);
  const flag = stored < 0 ? FALLBACK : PRIDE_FLAGS[(stored + 1) % PRIDE_FLAGS.length];
  try {
    store.setItem(KEY, flag.flag);
  } catch {
    return FALLBACK;
  }
  return flag;
}

const WHITE = '#FFFFFF';
const WHITE_ON_PAPER = '#ECECEC';

const onPaper = (colour: string) => (colour.toUpperCase() === WHITE ? WHITE_ON_PAPER : colour);

export function flagGradient(stripes: readonly string[]): string {
  const step = 100 / Math.max(stripes.length - 1, 1);
  return `linear-gradient(to right, ${stripes.map((c, i) => `${onPaper(c)} ${i * step}%`).join(', ')})`;
}
