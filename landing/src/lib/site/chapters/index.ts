export enum Side {
  Right = 'right',
  Left = 'left'
}

export type Action = { href: string; label: string };

export type ChapterCopy = {
  eyebrow: string;
  heading: string;
  lead: string;
  start: Action;
  more: Action;
};

export type Step<G extends string> = { glyph: G; title: string; text: string };
