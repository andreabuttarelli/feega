import { Framework } from './template';

export const FRAMEWORK_LABEL: Readonly<Record<Framework, string>> = {
  [Framework.Svelte]: 'Svelte',
  [Framework.React]: 'React',
  [Framework.Vue]: 'Vue',
  [Framework.Astro]: 'Astro',
  [Framework.Html]: 'HTML'
};
