import { Category, Framework, Theme, type HubFramework } from './template';

export const TEMPLATES_PATH = '/templates';

export const FRAMEWORK_QUERY = 'framework';

export const CATEGORY_SLUGS: Readonly<Record<Category, string>> = {
  [Category.Section]: 'sections',
  [Category.Component]: 'components',
  [Category.App]: 'app'
};

export const HUB_FRAMEWORKS: readonly HubFramework[] = [Framework.Svelte, Framework.React, Framework.Vue, Framework.Astro];

export const categoryPath = (category: Category) => `${TEMPLATES_PATH}/${CATEGORY_SLUGS[category]}`;

export const frameworkPath = (framework: Framework) => `${TEMPLATES_PATH}/${framework}`;

export const templatePath = (id: string) => `${TEMPLATES_PATH}/${id}`;

export const itemHref = (id: string, framework?: Framework) => (framework ? `${templatePath(id)}?${FRAMEWORK_QUERY}=${framework}` : templatePath(id));

export const HUB_SLUGS: readonly string[] = [...Object.values(CATEGORY_SLUGS), ...HUB_FRAMEWORKS];

export const isHubSlug = (slug: string): boolean => HUB_SLUGS.includes(slug);

export const categoryOfSlug = (slug: string): Category | undefined => (Object.keys(CATEGORY_SLUGS) as Category[]).find((c) => CATEGORY_SLUGS[c] === slug);

export const PREVIEW_DIR = `${TEMPLATES_PATH}/preview`;

export const previewPath = (id: string) => `${PREVIEW_DIR}/${id}.html`;

export const TOKENS_PATH = `${TEMPLATES_PATH}/tokens.css`;

export enum VideoFormat {
  Webm = 'webm',
  Mp4 = 'mp4'
}

export const proVideoPath = (id: string, format: VideoFormat) => `/templates-shots/${id}.${format}`;

export const proPosterPath = (id: string) => `/templates-shots/${id}.webp`;

export const shotPath = (id: string, theme: Theme) => `/templates-shots/${id}-${theme}.webp`;
