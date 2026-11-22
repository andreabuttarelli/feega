import { CATEGORY_COPY, FRAMEWORK_COPY } from './copy';
import { HUB_META } from './meta';
import { TEMPLATES } from './library';
import { CATEGORY_SLUGS, HUB_FRAMEWORKS, TEMPLATES_PATH, categoryPath, frameworkPath, templatePath } from './paths';
import { Category } from './template';

export const TEMPLATES_HEADING = 'Free UI sections and components';

export const HUB_PATHS: readonly string[] = [
  TEMPLATES_PATH,
  ...(Object.keys(CATEGORY_SLUGS) as Category[]).map(categoryPath),
  ...HUB_FRAMEWORKS.map(frameworkPath)
];

export const TEMPLATE_PATHS: readonly string[] = [...HUB_PATHS, ...TEMPLATES.map((t) => templatePath(t.id))];

export const TEMPLATE_TITLES: Readonly<Record<string, string>> = {
  [TEMPLATES_PATH]: TEMPLATES_HEADING,
  ...Object.fromEntries((Object.keys(CATEGORY_SLUGS) as Category[]).map((c) => [categoryPath(c), CATEGORY_COPY[c].heading])),
  ...Object.fromEntries(HUB_FRAMEWORKS.map((f) => [frameworkPath(f), FRAMEWORK_COPY[f].heading])),
  ...Object.fromEntries(TEMPLATES.map((t) => [templatePath(t.id), t.name]))
};

export const TEMPLATES_INTRO = HUB_META.description;
