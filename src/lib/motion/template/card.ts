import { MotionFormat } from '$lib/motion/doc';

export enum SectionRole {
  Opener = 'opener',
  Feature = 'feature',
  Product = 'product',
  Proof = 'proof',
  Stat = 'stat',
  List = 'list',
  Gallery = 'gallery',
  Transition = 'transition',
  Closer = 'closer',
  Poster = 'poster',
  Background = 'background'
}

export enum Energy {
  Calm = 'calm',
  Medium = 'medium',
  Fast = 'fast'
}

export enum TextAmount {
  None = 'none',
  Word = 'word',
  Line = 'line',
  Lines = 'lines'
}

export enum MediaAspect {
  Any = 'any',
  Landscape = 'landscape',
  Portrait = 'portrait',
  Square = 'square',
  Screenshot = 'screenshot',
  PhoneScreen = 'phone-screen',
  Logo = 'logo'
}

export enum EdgeTone {
  Dark = 'dark',
  Light = 'light',
  Colour = 'colour',
  Media = 'media'
}

export enum Joint {
  Cut = 'cut',
  Fade = 'fade',
  Blur = 'blur',
  Wipe = 'wipe',
  MatchCut = 'match-cut'
}

export const ROLE_MEANING: Record<SectionRole, string> = {
  [SectionRole.Opener]: 'the hook: first 2–5 s, the claim or the brand',
  [SectionRole.Feature]: 'one benefit or feature, said or shown',
  [SectionRole.Product]: 'the product itself: app screen, device, product photo',
  [SectionRole.Proof]: 'testimonials, logos, quotes',
  [SectionRole.Stat]: 'one or two numbers',
  [SectionRole.List]: 'several features or steps in one go',
  [SectionRole.Gallery]: 'many pictures or clips at once',
  [SectionRole.Transition]: 'a short bridge between sections',
  [SectionRole.Closer]: 'the end: logo, call to action, address',
  [SectionRole.Poster]: 'a still poster: one designed frame, for a still post or a held beat',
  [SectionRole.Background]: 'motion behind other clips, holds no message alone'
};

export type OnScreenBeat = { from: number; to?: number; what: string };
export type MediaNeed = { min: number; max: number; aspect: MediaAspect };

export type TemplateCard = {
  roles: [SectionRole, ...SectionRole[]];
  energy: Energy;
  loops: boolean;
  onScreen: OnScreenBeat[];
  needs: { media: MediaNeed | null; text: TextAmount };
  bestFormats: MotionFormat[];
  edges: { start: EdgeTone; end: EdgeTone; transition: Joint };
  goodFor: string[];
};

const LATE_TOLERANCE_S = 0.5;

const round = (n: number) => Math.round(n * 10) / 10;

export const beatLine = (b: OnScreenBeat) => `${round(b.from)}${b.to === undefined ? '' : `–${round(b.to)}`}s ${b.what}`;

function beatProblems(beats: OnScreenBeat[], seconds: number): string[] {
  if (!beats.length) {
    return ['onScreen is empty'];
  }
  const problems: string[] = [];
  beats.forEach((b, i) => {
    if (Math.max(b.from, b.to ?? b.from) > seconds + LATE_TOLERANCE_S) {
      problems.push(`onScreen "${b.what}" runs past the end (${seconds}s)`);
    }
    if (b.to !== undefined && b.to < b.from) {
      problems.push(`onScreen "${b.what}" ends before it starts`);
    }
    if (i > 0 && b.from < beats[i - 1].from) {
      problems.push(`onScreen "${b.what}" is out of order`);
    }
    if (!b.what.trim()) {
      problems.push('an onScreen beat says nothing');
    }
  });
  return problems;
}

export function cardProblems(card: TemplateCard, seconds: number): string[] {
  const media = card.needs.media;
  return [
    ...beatProblems(card.onScreen, seconds),
    ...(card.goodFor.length ? [] : ['goodFor is empty']),
    ...(card.bestFormats.length ? [] : ['bestFormats is empty']),
    ...(media && (media.min < 0 || media.min > media.max) ? [`media needs ${media.min}–${media.max}`] : [])
  ];
}

const mediaLine = (m: MediaNeed | null) => (m ? `media ${m.min === m.max ? m.min : `${m.min}–${m.max}`} ${m.aspect}` : 'no media');

export function cardLine(card: TemplateCard): string {
  return [
    card.roles.join('/'),
    card.energy,
    card.loops ? 'loops' : null,
    `${card.edges.start}→${card.edges.end} ${card.edges.transition}`,
    mediaLine(card.needs.media),
    `text ${card.needs.text}`,
    card.onScreen.map(beatLine).join('; '),
    `for ${card.goodFor.join(', ')}`
  ]
    .filter(Boolean)
    .join(' · ');
}

export const cardDetail = (card: TemplateCard) => ({ ...card, onScreen: card.onScreen.map(beatLine) });

export const SECTION_ROLES = Object.values(SectionRole) as [SectionRole, ...SectionRole[]];
