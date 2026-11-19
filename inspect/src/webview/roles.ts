import { Section } from './controls';

export enum Role {
  Text = 'text',
  Container = 'container',
  Media = 'media',
  Icon = 'icon',
  Input = 'input',
  Head = 'head',
  Page = 'page'
}

export type Element = { tag: string; ownText: boolean; elements: number; display: string; inlineText: boolean };

const PAGE = new Set(['html', 'body']);
const HEAD = new Set(['head', 'title', 'meta', 'link', 'script', 'style', 'base', 'noscript']);
const MEDIA = new Set(['img', 'video', 'canvas', 'picture', 'iframe']);
const INPUTS = new Set(['input', 'textarea', 'select']);
const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'label', 'li', 'strong', 'em', 'b', 'i', 'small', 'code', 'blockquote', 'figcaption', 'dt', 'dd', 'caption', 'legend', 'summary', 'cite', 'q']);
const LAID_OUT = /^(inline-)?(flex|grid)$/;

const PLACED = [Section.Position, Section.Display, Section.Constraints, Section.Child];
const FINISH = [Section.Stroke, Section.Filters, Section.Transform, Section.Transition, Section.Cursor];

const SECTIONS: Record<Role, Section[]> = {
  [Role.Text]: [Section.Typography, Section.TextOptions, Section.Size, ...PLACED, Section.Spacing, Section.Fill, Section.Radius, Section.Effects, Section.List, ...FINISH],
  [Role.Container]: [Section.Layout, Section.Grid, Section.Size, ...PLACED, Section.Spacing, Section.Fill, Section.Radius, Section.Border, Section.Effects, Section.List, ...FINISH],
  [Role.Media]: [Section.Size, Section.Object, ...PLACED, Section.Radius, Section.Effects, ...FINISH],
  [Role.Icon]: [Section.Icon, Section.Size, ...PLACED, Section.Effects, ...FINISH],
  [Role.Input]: [Section.Typography, Section.Size, ...PLACED, Section.Spacing, Section.Fill, Section.Radius, Section.Border, ...FINISH],
  [Role.Head]: [],
  [Role.Page]: [Section.Layout, Section.Grid, Section.Size, ...PLACED, Section.Spacing, Section.Fill, Section.Radius, Section.Border, Section.Effects, Section.List, ...FINISH]
};

export type Actions = { visibility: boolean; lock: boolean };

const EDITABLE_LAYER: Actions = { visibility: true, lock: true };
const FIXED_LAYER: Actions = { visibility: false, lock: false };

const ACTIONS: Record<Role, Actions> = {
  [Role.Text]: EDITABLE_LAYER,
  [Role.Container]: EDITABLE_LAYER,
  [Role.Media]: EDITABLE_LAYER,
  [Role.Icon]: EDITABLE_LAYER,
  [Role.Input]: EDITABLE_LAYER,
  [Role.Head]: FIXED_LAYER,
  [Role.Page]: FIXED_LAYER
};

export function roleOf({ tag, ownText, elements, display, inlineText }: Element): Role {
  const name = tag.toLowerCase();
  if (PAGE.has(name)) {
    return Role.Page;
  }
  if (HEAD.has(name)) {
    return Role.Head;
  }
  if (name === 'svg') {
    return Role.Icon;
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

export const actionsOf = (role: Role): Actions => ACTIONS[role];
export const sectionsOf = (role: Role): Section[] => SECTIONS[role];
