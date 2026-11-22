import { CATEGORY_COPY, FRAMEWORK_COPY } from './copy';
import { Category, type HubFramework, type Template } from './template';
import { TEMPLATES } from './library';

export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 155;

export type Meta = { readonly title: string; readonly description: string };

const firstFitting = (candidates: readonly string[], limit: number): string => candidates.find((c) => c.length <= limit) ?? candidates[candidates.length - 1];

const NOUN: Readonly<Record<Category, string>> = {
  [Category.Section]: 'section',
  [Category.Component]: 'component',
  [Category.App]: 'app UI'
};

export function templateMeta(template: Template): Meta {
  const noun = NOUN[template.category];
  const title = firstFitting(
    [
      `${template.name}: free ${noun} for Svelte, React, Vue | Feega`,
      `${template.name}: free ${noun} for React and Svelte | Feega`,
      `${template.name}: free ${noun} | Feega`,
      `${template.name} | Feega`
    ],
    MAX_TITLE
  );
  const description = firstFitting(
    [
      `${template.description} Free ${noun} in Svelte, React, Vue, Astro and HTML, with light and dark themes.`,
      `${template.description} Free ${noun} in Svelte, React, Vue, Astro and HTML.`,
      `${template.description} Free ${noun} for Svelte, React and Vue.`,
      template.description
    ],
    MAX_DESCRIPTION
  );

  return { title, description };
}

export const HUB_META: Meta = {
  title: 'Free UI sections and components for 5 frameworks | Feega',
  description: `${TEMPLATES.length} free website sections, UI components and app screens in Svelte, React, Vue, Astro and HTML, with live previews, light and dark.`
};

export const categoryMeta = (category: Category): Meta => ({ title: CATEGORY_COPY[category].title, description: CATEGORY_COPY[category].description });

export const frameworkMeta = (framework: HubFramework): Meta => ({ title: FRAMEWORK_COPY[framework].title, description: FRAMEWORK_COPY[framework].description });
