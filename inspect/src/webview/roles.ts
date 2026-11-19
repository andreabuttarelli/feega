import { Section } from './controls';

export enum Role {
  Text = 'text',
  Container = 'container',
  Media = 'media',
  Input = 'input'
}

export type Element = { tag: string; ownText: boolean; elements: number; display: string };

const MEDIA = new Set(['img', 'svg', 'video', 'canvas', 'picture', 'iframe']);
const INPUTS = new Set(['input', 'textarea', 'select']);
const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button', 'label', 'li', 'strong', 'em', 'b', 'i', 'small', 'code', 'blockquote']);
const LAID_OUT = /^(inline-)?(flex|grid)$/;

const SECTIONS: Record<Role, Section[]> = {
  [Role.Text]: [Section.Typography, Section.Size, Section.Spacing, Section.Fill, Section.Radius, Section.Effects],
  [Role.Container]: [Section.Layout, Section.Size, Section.Spacing, Section.Fill, Section.Radius, Section.Border, Section.Effects],
  [Role.Media]: [Section.Size, Section.Radius, Section.Effects],
  [Role.Input]: [Section.Typography, Section.Size, Section.Spacing, Section.Fill, Section.Radius, Section.Border]
};

export function roleOf({ tag, ownText, elements, display }: Element): Role {
  const name = tag.toLowerCase();
  if (MEDIA.has(name)) {
    return Role.Media;
  }
  if (INPUTS.has(name)) {
    return Role.Input;
  }
  if (LAID_OUT.test(display) && elements > 0) {
    return Role.Container;
  }
  return ownText || (TEXT_TAGS.has(name) && elements === 0) ? Role.Text : Role.Container;
}

export const sectionsOf = (role: Role): Section[] => SECTIONS[role];
