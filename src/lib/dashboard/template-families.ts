export enum TemplateFamily {
  Motion = 'motion',
  Composition = 'composition',
  Effects = 'effects'
}

export const TEMPLATE_FAMILIES: { id: TemplateFamily; label: string }[] = [
  { id: TemplateFamily.Motion, label: 'motion' },
  { id: TemplateFamily.Composition, label: 'composition' },
  { id: TemplateFamily.Effects, label: 'effects' }
];

export function familyShown(filter: TemplateFamily | null, family: TemplateFamily): boolean {
  return filter === null || filter === family;
}
