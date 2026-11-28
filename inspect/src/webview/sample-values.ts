import { FieldKind } from './component-props';

export enum TargetKind {
  Route = 'route',
  Prop = 'prop'
}

export type Target = { kind: TargetKind.Route } | { kind: TargetKind.Prop; fieldKind: FieldKind; name: string };

export type Sample = {
  id: string;
  label: string;
  make: (seed: number) => string;
  route: boolean;
  link: boolean;
  kinds: FieldKind[];
};

const LINK_NAME = /url|src|href|image|img|avatar|photo|picture|thumb/i;
const HEX = '0123456789abcdef';
const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const SHORT_ID_LENGTH = 8;
const NUMBER_MAX = 100;
const UUID_VARIANTS = '89ab';
const WORDS = ['hello', 'world', 'quiet', 'river', 'bright', 'paper', 'cedar', 'signal', 'harbor', 'maple', 'orbit', 'lantern'];
const FIRST_NAMES = ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken'];
const LAST_NAMES = ['Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson'];
const SENTENCE_WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore'];
const SENTENCE_LENGTH = 8;
const PARAGRAPH_SENTENCES = 3;
const DATE_SPAN_DAYS = 3650;
const DATE_START_MS = Date.UTC(2020, 0, 1);
const DAY_MS = 86_400_000;
const NOT_FOUND = 'feega-not-found';

type Rng = () => number;

function rngOf(seed: number): Rng {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(list: T[], rng: Rng): T => list[Math.floor(rng() * list.length)];
const chars = (alphabet: string, count: number, rng: Rng) => Array.from({ length: count }, () => pick([...alphabet], rng)).join('');
const slug = (rng: Rng) => `${pick(WORDS, rng)}-${pick(WORDS, rng)}`;
const sentence = (rng: Rng) => {
  const words = Array.from({ length: SENTENCE_LENGTH }, () => pick(SENTENCE_WORDS, rng)).join(' ');

  return `${words[0].toUpperCase()}${words.slice(1)}.`;
};

const uuid = (rng: Rng) => `${chars(HEX, 8, rng)}-${chars(HEX, 4, rng)}-4${chars(HEX, 3, rng)}-${pick([...UUID_VARIANTS], rng)}${chars(HEX, 3, rng)}-${chars(HEX, 12, rng)}`;

const TEXT = [FieldKind.Text];
const NO_KINDS: FieldKind[] = [];

export const SAMPLES: Sample[] = [
  { id: 'uuid', label: 'UUID', make: (seed) => uuid(rngOf(seed)), route: true, link: false, kinds: TEXT },
  { id: 'short-id', label: 'Short id', make: (seed) => chars(URL_SAFE, SHORT_ID_LENGTH, rngOf(seed)), route: true, link: false, kinds: TEXT },
  { id: 'slug', label: 'Slug', make: (seed) => slug(rngOf(seed)), route: true, link: false, kinds: TEXT },
  { id: 'number', label: 'Number', make: (seed) => String(1 + Math.floor(rngOf(seed)() * NUMBER_MAX)), route: true, link: false, kinds: [FieldKind.Number] },
  { id: 'sentence', label: 'Lorem sentence', make: (seed) => sentence(rngOf(seed)), route: false, link: false, kinds: TEXT },
  {
    id: 'paragraph',
    label: 'Lorem paragraph',
    make: (seed) => {
      const rng = rngOf(seed);

      return Array.from({ length: PARAGRAPH_SENTENCES }, () => sentence(rng)).join(' ');
    },
    route: false,
    link: false,
    kinds: TEXT
  },
  { id: 'name', label: 'Name', make: (seed) => `${pick(FIRST_NAMES, rngOf(seed))} ${pick(LAST_NAMES, rngOf(seed + 1))}`, route: false, link: false, kinds: TEXT },
  { id: 'email', label: 'Email', make: (seed) => `${pick(FIRST_NAMES, rngOf(seed)).toLowerCase()}.${pick(LAST_NAMES, rngOf(seed + 1)).toLowerCase()}@example.com`, route: false, link: false, kinds: TEXT },
  { id: 'date', label: 'Date', make: (seed) => new Date(DATE_START_MS + Math.floor(rngOf(seed)() * DATE_SPAN_DAYS) * DAY_MS).toISOString().slice(0, 10), route: false, link: false, kinds: TEXT },
  { id: 'url', label: 'URL', make: (seed) => `https://example.com/${slug(rngOf(seed))}`, route: false, link: true, kinds: TEXT },
  { id: 'image', label: 'Image URL', make: (seed) => `https://picsum.photos/seed/${slug(rngOf(seed))}/800/600`, route: false, link: true, kinds: TEXT },
  { id: 'true', label: 'true', make: () => 'true', route: false, link: false, kinds: [FieldKind.Toggle] },
  { id: 'false', label: 'false', make: () => 'false', route: false, link: false, kinds: [FieldKind.Toggle] },
  { id: 'empty', label: 'Empty string', make: () => '', route: false, link: false, kinds: TEXT },
  { id: 'not-found', label: 'Not found', make: () => NOT_FOUND, route: true, link: false, kinds: NO_KINDS }
];

const UNTYPED_KINDS = [FieldKind.Json];

function forProp(sample: Sample, fieldKind: FieldKind, name: string): boolean {
  if (sample.id === 'not-found') {
    return false;
  }
  if (UNTYPED_KINDS.includes(fieldKind)) {
    return true;
  }
  if (fieldKind === FieldKind.Text && LINK_NAME.test(name)) {
    return sample.link;
  }

  return sample.kinds.includes(fieldKind);
}

export function samplesFor(target: Target): Sample[] {
  if (target.kind === TargetKind.Route) {
    return SAMPLES.filter((sample) => sample.route);
  }

  return SAMPLES.filter((sample) => forProp(sample, target.fieldKind, target.name));
}
