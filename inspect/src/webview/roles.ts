import { Section } from './controls';

export enum Role {
  Text = 'text',
  Container = 'container',
  Media = 'media',
  Input = 'input',
  Head = 'head'
}

export type Element = { tag: string; ownText: boolean; elements: number; display: string; inlineText: boolean };

const HEAD = new Set(['head', 'title', 'meta', 'link', 'script', 'style', 'base', 'noscript']);
const MEDIA = new Set(['img', 'svg', 'video', 'canvas', 'picture', 'iframe']);
const INPUTS = new Set(['input', 'textarea', 'select']);
const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'label', 'li', 'strong', 'em', 'b', 'i', 'small', 'code', 'blockquote', 'figcaption', 'dt', 'dd', 'caption', 'legend', 'summary', 'cite', 'q']);
const LAID_OUT = /^(inline-)?(flex|grid)$/;

const PLACED = [Section.Position, Section.Display, Section.Constraints, Section.Child];
const FINISH = [Section.Stroke, Section.Filters, Section.Transform, Section.Transition, Section.Cursor];

const SECTIONS: Record<Role, Section[]> = {
  [Role.Text]: [Section.Typography, Section.TextOptions, Section.Size, ...PLACED, Section.Spacing, Section.Fill, Section.Radius, Section.Effects, Section.List, ...FINISH],
  [Role.Container]: [Section.Layout, Section.Grid, Section.Size, ...PLACED, Section.Spacing, Section.Fill, Section.Radius, Section.Border, Section.Effects, Section.List, ...FINISH],
  [Role.Media]: [Section.Size, Section.Object, ...PLACED, Section.Radius, Section.Effects, ...FINISH],
  [Role.Input]: [Section.Typography, Section.Size, ...PLACED, Section.Spacing, Section.Fill, Section.Radius, Section.Border, ...FINISH],
  [Role.Head]: []
};

export function roleOf({ tag, ownText, elements, display, inlineText }: Element): Role {
  const name = tag.toLowerCase();
  if (HEAD.has(name)) {
    return Role.Head;
  }
  if (MEDIA.has(name)) {
    return Role.Media;
  }
  if (INPUTS.has(name)) {
    return Role.Input;
  }
  if (LAID_OUT.test(display) && elements > 0) {
    return Role.Container;
  }
  return ownText || inlineText || TEXT_TAGS.has(name) ? Role.Text : Role.Container;
}

export const sectionsOf = (role: Role): Section[] => SECTIONS[role];
