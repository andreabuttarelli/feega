import type { RestNode, RestPaint } from '$lib/server/figma/rest-message';

export enum Merge {
  ByName = 'name',
  BySimilarity = 'similarity'
}

export enum Level {
  Atom = 'atom',
  Molecule = 'molecule'
}

export enum Prop {
  Style = 'Style',
  Size = 'Size',
  Icon = 'Icon',
  Image = 'Image',
  Items = 'Items'
}

export type Facts = {
  tag: string;
  role: string;
  hint: string;
  landmark: string;
  press: string;
  label: string;
  filled: boolean;
  outlined: boolean;
  shadowed: boolean;
  radius: number;
  texts: number;
  chars: number;
  maxFont: number;
  links: number;
  images: number;
  vectors: number;
  drawing: boolean;
  priced: boolean;
  periodic: boolean;
  quoted: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
};

export type Kind = {
  name: string;
  when: (f: Facts) => boolean;
  alone: (f: Facts) => boolean;
  merge: Merge;
  level: Level;
  nests: boolean;
  paintless: boolean;
  leaf: boolean;
  sized: boolean;
  labelled: boolean;
  stateful: boolean;
  props: Prop[];
};

const HEADER_BOTTOM = 120;
const BUTTON_HEIGHT = 64;
const CONTROL_HEIGHT = 80;
const LINK_HEIGHT = 48;
const FOOTER_LINK_HEIGHT = 40;
const BADGE_HEIGHT = 28;
const HINTED_BADGE_HEIGHT = 40;
const BADGE_FONT = 14;
const BADGE_CHARS = 24;
const BUTTON_CHARS = 40;
const AVATAR_SIDE = 96;
const ICON_SIDE = 48;
const SQUARE_SLACK = 2;
const CARD_MIN_WIDTH = 120;
const CARD_MIN_HEIGHT = 80;
const CARD_MAX_HEIGHT = 1200;
const CARD_MAX_SHARE = 0.7;
const COLUMN_MAX_WIDTH = 360;
const LOGO_LEFT_SHARE = 0.3;
const LOGO_MAX_HEIGHT = 200;
const LOGO_MAX_SHARE = 0.5;
const TIER_MIN_HEIGHT = 120;
const QUOTE_CHARS = 40;
const MIN_LINKS = 3;
const MIN_TIER_TEXTS = 3;

const LINK = 'link';
const BUTTON = 'button';
const FIELD_TAGS = new Set(['input', 'textarea', 'select']);
const FIELD_ROLES = new Set(['textbox', 'searchbox', 'combobox']);
const FIELD_HINTS = new Set(['input', 'field', 'search']);
const BADGE_HINTS = new Set(['badge', 'pill', 'chip', 'tag']);
const BUTTON_HINTS = new Set(['button', 'btn', 'cta']);
const NAV_HINTS = new Set(['nav', 'menu', 'link', 'item']);
const NAV_PRESSES = new Set([LINK, BUTTON, 'menuitem']);
const TIER_HINTS = new Set(['pricing', 'tier', 'plan']);
const QUOTE_HINTS = new Set(['testimonial', 'quote', 'review']);
const FEATURE_HINTS = new Set(['feature', 'tile']);
const ACCORDION_TAGS = new Set(['details', 'summary']);
const ACCORDION_HINTS = new Set(['accordion', 'faq']);
const QUOTE_TAGS = new Set(['blockquote']);
const NAV_LANDMARKS = new Set(['nav', 'header']);
const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'LINE', 'STAR', 'REGULAR_POLYGON']);
const QUOTE_MARK = /^\s*[“"«„]/;
const PRICE = /[$€£¥₹]\s?\d|\d\s?[$€£]|^\s*free\s*$/i;
const PERIOD = /\/\s?(mo|month|yr|year|user|seat)\b|\bper (month|year|user|seat)\b|\b(monthly|yearly|annually)\b/i;
const LOGO_NAME = /logo/i;

const shows = (paints: RestPaint[] | undefined) => (paints ?? []).some((p) => p.visible !== false && (p.opacity ?? 1) > 0 && (p.type !== 'SOLID' || (p.color?.a ?? 1) > 0));

const radiusOf = (n: RestNode) => Math.max(n.cornerRadius ?? 0, ...(n.rectangleCornerRadii ?? [0]));

const inNav = (f: Facts) => NAV_LANDMARKS.has(f.landmark) || f.y < HEADER_BOTTOM;

const painted = (f: Facts) => f.filled || f.outlined;

const bounded = (f: Facts) => f.width >= CARD_MIN_WIDTH && f.height >= CARD_MIN_HEIGHT && f.width <= f.pageWidth * CARD_MAX_SHARE && f.height <= CARD_MAX_HEIGHT;

const boxed = (f: Facts) => bounded(f) && ((f.filled && f.radius > 0) || f.outlined || f.shadowed);

const logoLike = (f: Facts) => !f.texts && (f.images > 0 || f.vectors > 0) && f.height <= LOGO_MAX_HEIGHT && f.width <= f.pageWidth * LOGO_MAX_SHARE;

const iconOnly = (f: Facts) => f.vectors > 0 && !f.texts && !f.images;

const field = (f: Facts) => (FIELD_TAGS.has(f.tag) || FIELD_ROLES.has(f.role) || FIELD_HINTS.has(f.hint)) && f.height <= CONTROL_HEIGHT && !f.images;

const avatar = (f: Facts) => f.hint === 'avatar' || (f.images === 1 && !f.texts && Math.abs(f.width - f.height) <= SQUARE_SLACK && f.width <= AVATAR_SIDE && f.radius >= f.width / 2 - 1);

const badge = (f: Facts) =>
  (BADGE_HINTS.has(f.hint) && f.height <= HINTED_BADGE_HEIGHT) || (painted(f) && f.texts === 1 && !f.images && f.vectors <= 1 && f.height <= BADGE_HEIGHT && f.maxFont <= BADGE_FONT && f.chars <= BADGE_CHARS && !f.press);

const button = (f: Facts) => ((f.press === BUTTON || BUTTON_HINTS.has(f.hint)) && f.height <= CONTROL_HEIGHT && !f.images && f.texts <= 2) || (painted(f) && f.texts >= 1 && f.texts <= 2 && !f.images && f.height <= BUTTON_HEIGHT && f.chars <= BUTTON_CHARS);

const navLink = (f: Facts) => (NAV_PRESSES.has(f.press) || NAV_HINTS.has(f.hint)) && inNav(f) && !f.filled && f.height <= LINK_HEIGHT && f.texts >= 1 && !f.images;

const logoNamed = (f: Facts) => f.hint === 'logo' || LOGO_NAME.test(f.label) || (NAV_LANDMARKS.has(f.landmark) && f.x < f.pageWidth * LOGO_LEFT_SHARE);

const always = () => true;
const never = () => false;

type Row = Pick<Kind, 'name' | 'when'> & Partial<Omit<Kind, 'name' | 'when'>>;

const PRESSED_PROPS = [Prop.Style, Prop.Size, Prop.Icon];
const LABEL_PROPS = [Prop.Style, Prop.Icon];
const BLOCK_PROPS = [Prop.Style, Prop.Image, Prop.Items];

const kind = (row: Row): Kind => ({ alone: never, merge: Merge.ByName, level: Level.Atom, nests: true, paintless: false, leaf: false, sized: false, labelled: false, stateful: false, props: BLOCK_PROPS, ...row });

const molecule = (row: Row): Kind => kind({ merge: Merge.BySimilarity, level: Level.Molecule, ...row });

export const KINDS: Kind[] = [
  kind({ name: 'Input', when: field, alone: always, labelled: true, props: LABEL_PROPS }),
  kind({ name: 'Avatar', when: avatar, alone: always, leaf: true, sized: true, props: [Prop.Size] }),
  kind({ name: 'Tab', when: (f) => (f.press === 'tab' || f.hint === 'tab') && f.height <= BUTTON_HEIGHT, alone: always, labelled: true, props: LABEL_PROPS }),
  molecule({ name: 'Accordion item', when: (f) => ACCORDION_TAGS.has(f.tag) || ACCORDION_HINTS.has(f.hint), alone: always, paintless: true }),
  kind({ name: 'Badge', when: badge, alone: always, labelled: true, props: LABEL_PROPS }),
  kind({ name: 'Nav link', when: navLink, alone: always, leaf: true, sized: true, labelled: true, stateful: true, props: PRESSED_PROPS }),
  kind({ name: 'Button', when: button, alone: always, sized: true, labelled: true, stateful: true, props: PRESSED_PROPS }),
  kind({ name: 'Footer link', when: (f) => f.press === LINK && f.landmark === 'footer' && f.height <= FOOTER_LINK_HEIGHT && f.texts === 1, alone: always, leaf: true, labelled: true, stateful: true, props: [Prop.Icon] }),
  kind({ name: 'Link', when: (f) => f.press === LINK && f.height <= LINK_HEIGHT && f.texts >= 1 && !f.images, leaf: true, sized: true, labelled: true, stateful: true, props: [Prop.Size, Prop.Icon] }),
  molecule({ name: 'Pricing tier', when: (f) => (TIER_HINTS.has(f.hint) || (f.priced && f.periodic)) && f.texts >= MIN_TIER_TEXTS && f.height >= TIER_MIN_HEIGHT && bounded(f), alone: always }),
  molecule({ name: 'Testimonial', when: (f) => (QUOTE_HINTS.has(f.hint) || f.quoted) && f.texts >= 2 && bounded(f), alone: always }),
  molecule({ name: 'Footer column', when: (f) => f.landmark === 'footer' && f.links >= MIN_LINKS && f.width <= COLUMN_MAX_WIDTH, alone: always, paintless: true, props: [Prop.Items] }),
  kind({ name: 'Logo', when: (f) => logoLike(f) && logoNamed(f), alone: always, leaf: true, props: [] }),
  kind({ name: 'Icon', when: (f) => iconOnly(f) && f.drawing && f.width <= ICON_SIDE && f.height <= ICON_SIDE, nests: false, props: [] }),
  kind({ name: 'Logo', when: logoLike, props: [] }),
  molecule({ name: 'Feature tile', when: (f) => (FEATURE_HINTS.has(f.hint) || (f.vectors > 0 && !f.images)) && f.texts >= 2, alone: boxed }),
  molecule({ name: 'Card', when: (f) => f.hint === 'card' || (f.images > 0 && f.texts > 0) || f.texts >= 2, alone: (f) => boxed(f) && f.texts >= 2 }),
  molecule({ name: 'List item', when: (f) => f.tag === 'li', paintless: true, labelled: true }),
  molecule({ name: 'Item', when: always, nests: false, labelled: true })
];

const NUMBERED = / \d+$/;

const BY_LENGTH = [...KINDS].sort((a, b) => b.name.length - a.name.length);

export const kindOf = (f: Facts): Kind => KINDS.find((k) => k.when(f))!;

export const kindNamed = (name: string): Kind | undefined => {
  const bare = name.replace(NUMBERED, '');
  return BY_LENGTH.find((k) => bare === k.name || bare.endsWith(` ${k.name}`));
};

const domOf = (n: RestNode) => n.dom ?? (n.children?.length === 1 ? n.children[0].dom : undefined);

export function factsOf(n: RestNode, kids: Facts[], pageWidth: number): Facts {
  const dom = domOf(n);
  const box = n.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 };
  const text = n.type === 'TEXT' ? (n.characters ?? '') : '';
  const sum = (key: 'texts' | 'chars' | 'images' | 'vectors' | 'links') => kids.reduce((s, k) => s + k[key], 0);
  const only = n.children?.length === 1 ? kids[0] : undefined;
  return {
    tag: dom?.tag ?? '',
    role: dom?.role ?? '',
    hint: dom?.hint ?? '',
    landmark: dom?.landmark ?? '',
    press: dom?.press ?? '',
    label: n.name ?? '',
    filled: shows(n.fills) && n.type !== 'TEXT',
    outlined: shows(n.strokes) && !shows(n.fills),
    shadowed: (n.effects ?? []).some((e) => e.visible !== false && (e.color?.a ?? 1) > 0),
    radius: Math.max(radiusOf(n), only?.radius ?? 0),
    texts: sum('texts') + (n.type === 'TEXT' ? 1 : 0),
    chars: sum('chars') + text.trim().length,
    maxFont: Math.max(n.style?.fontSize ?? 0, ...kids.map((k) => k.maxFont)),
    links: dom?.press === LINK ? 1 : sum('links'),
    images: sum('images') + (n.fills?.some((p) => p.type === 'IMAGE') ? 1 : 0),
    vectors: sum('vectors') + (VECTOR_TYPES.has(n.type) ? 1 : 0),
    drawing: Boolean(n.children?.length) && n.children!.every((c) => VECTOR_TYPES.has(c.type)),
    priced: kids.some((k) => k.priced) || PRICE.test(text),
    periodic: kids.some((k) => k.periodic) || PERIOD.test(text),
    quoted: kids.some((k) => k.quoted) || QUOTE_TAGS.has(n.dom?.tag ?? '') || (QUOTE_MARK.test(text) && text.length >= QUOTE_CHARS),
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    pageWidth
  };
}
