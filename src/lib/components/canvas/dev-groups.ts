import type { Declaration } from '@feega/motion-core/motion/codegen/dev-css';

export enum Group {
  Layout = 'Layout',
  Typography = 'Typography',
  Fill = 'Fill',
  Effects = 'Effects'
}

export type Row = { property: string; value: string; swatch: boolean };

const GROUP_OF: Record<string, Group> = {
  display: Group.Layout,
  position: Group.Layout,
  gap: Group.Layout,
  padding: Group.Layout,
  margin: Group.Layout,
  flex: Group.Layout,
  'flex-direction': Group.Layout,
  'align-items': Group.Layout,
  'justify-content': Group.Layout,
  'border-radius': Group.Layout,
  overflow: Group.Layout,
  'font-family': Group.Typography,
  'font-size': Group.Typography,
  'font-weight': Group.Typography,
  'line-height': Group.Typography,
  'letter-spacing': Group.Typography,
  'text-align': Group.Typography,
  color: Group.Fill,
  background: Group.Fill,
  'background-color': Group.Fill,
  border: Group.Fill,
  opacity: Group.Effects,
  transform: Group.Effects,
  filter: Group.Effects,
  'backdrop-filter': Group.Effects,
  'box-shadow': Group.Effects
};

const SIZE_PROPERTIES = new Set(['width', 'height', 'left', 'top']);
const COLOUR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\(.*\))$/i;
const GROUP_ORDER = [Group.Layout, Group.Typography, Group.Fill, Group.Effects];

export const isColour = (value: string) => COLOUR.test(value.trim());

export function groupDeclarations(declarations: Declaration[]): [Group, Row[]][] {
  const grouped = new Map<Group, Row[]>();

  for (const [property, value] of declarations) {
    const group = GROUP_OF[property];
    if (!group || SIZE_PROPERTIES.has(property)) {
      continue;
    }
    grouped.set(group, [...(grouped.get(group) ?? []), { property, value, swatch: isColour(value) }]);
  }

  return GROUP_ORDER.flatMap((group) => (grouped.has(group) ? [[group, grouped.get(group)!] as [Group, Row[]]] : []));
}
