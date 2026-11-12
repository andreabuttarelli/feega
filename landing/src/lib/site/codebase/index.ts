import { APP_URL, DOCS_URL } from '../links';
import type { Logo } from './logos';

export const CODEBASE_PATH = '/design-in-your-codebase';

export const CODEBASE = {
  title: 'Design Directly in Your Codebase | Feega',
  description:
    'Feega opens your GitHub repo or folder as an editable design: real pages, your components and colours. Change it on the canvas, ship a pull request.',
  eyebrow: 'Code → Design → Code',
  heading: 'Design directly in your codebase',
  lead: 'Open your real app as an editable design. Send the changes back as a pull request.',
  start: { href: `${APP_URL}/?utm_source=feega.app&utm_medium=site&utm_campaign=design-in-your-codebase`, label: 'Import your repo' },
  docs: { href: `${DOCS_URL}/integrations/import-from-code/`, label: 'Read the docs' }
} as const;

export enum Glyph {
  Import = 'import',
  Edit = 'edit',
  Ship = 'ship'
}

export type Step = { glyph: Glyph; title: string; text: string };

export const STEPS: readonly Step[] = [
  { glyph: Glyph.Import, title: 'Import your repo', text: 'GitHub or a local folder. Feega runs it.' },
  { glyph: Glyph.Edit, title: 'Design on the canvas', text: 'Real pages, your components, your colours.' },
  { glyph: Glyph.Ship, title: 'Ship a pull request', text: 'Or pull the latest code back in.' }
];

export type Framework = { name: string; logo: Logo };

export const TESTED: readonly Framework[] = [
  { name: 'Next.js', logo: 'Next' },
  { name: 'SvelteKit', logo: 'Svelte' },
  { name: 'React + Vite', logo: 'React' },
  { name: 'Vue + Vite', logo: 'Vue' }
];

export const EARLY: readonly Framework[] = [
  { name: 'Nuxt', logo: 'Nuxt' },
  { name: 'Astro', logo: 'Astro' },
  { name: 'React Router / Remix', logo: 'ReactRouter' },
  { name: 'Gatsby', logo: 'Gatsby' },
  { name: 'Angular', logo: 'Angular' },
  { name: 'Create React App', logo: 'CreateReactApp' },
  { name: 'Vite', logo: 'Vite' },
  { name: 'Solid', logo: 'Solid' }
];

export const EARLY_LABEL = 'and more in early support';
