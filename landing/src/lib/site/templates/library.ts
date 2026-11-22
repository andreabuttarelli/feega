import { Category, Tier, type Template } from './template';

type Manifest = {
  id: string;
  name: string;
  description: string;
  category: Category;
  tags: string[];
  fonts: { family: string; weights: number[] }[];
  tier: Tier;
};

const MANIFESTS = import.meta.glob<Manifest>('../../../../../packages/library/items/*/manifest.json', { eager: true, import: 'default' });

const CATEGORY_ORDER: readonly Category[] = [Category.Section, Category.Component, Category.App];

const byCategoryThenName = (a: Template, b: Template) =>
  CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name);

export const TEMPLATES: readonly Template[] = Object.values(MANIFESTS)
  .map((m) => ({ id: m.id, name: m.name, description: m.description, category: m.category, tags: m.tags, fonts: m.fonts, tier: m.tier }))
  .sort(byCategoryThenName);

export const templateById = (id: string): Template | undefined => TEMPLATES.find((t) => t.id === id);

export const isTemplateId = (id: string): boolean => templateById(id) !== undefined;

export const ALL_TAGS: readonly string[] = [...new Set(TEMPLATES.flatMap((t) => t.tags))].sort();
