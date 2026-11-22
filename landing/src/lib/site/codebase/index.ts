import { GITHUB_URL } from '../links';
import { primaryCta } from '../install';
import type { Logo } from './logos';
import type { ChapterCopy, Step } from '../chapters';

export const CODEBASE_PATH = '/design-in-your-codebase';

const cta = primaryCta();

export const CODEBASE = {
  title: 'Design in Your Codebase: a VS Code extension | Feega',
  description:
    'A free VS Code extension. Click any element of your running app, edit it like in Figma, and the change is written to your code. No AI, with diffs.',
  eyebrow: 'VS Code · Cursor · Windsurf',
  heading: 'Design in your codebase',
  lead: 'Click any element of your running app and edit it like in Figma. The change is written to your code. No AI, no tokens, every edit a diff. Free.',
  start: { href: cta.href, label: cta.label },
  more: { href: GITHUB_URL, label: 'See the source' }
} as const satisfies ChapterCopy & { title: string; description: string };

export enum Glyph {
  Import = 'import',
  Edit = 'edit',
  Ship = 'ship'
}

export const STEPS: readonly Step<Glyph>[] = [
  { glyph: Glyph.Import, title: 'Run your app', text: 'Open it in your editor as usual.' },
  { glyph: Glyph.Edit, title: 'Click and edit', text: 'Spacing, colour, type. Like in Figma.' },
  { glyph: Glyph.Ship, title: 'Review the diff', text: 'Written to your code, Tailwind or plain CSS.' }
];

export type Framework = { name: string; logo: Logo };

export const TESTED: readonly Framework[] = [
  { name: 'Next.js', logo: 'Next' },
  { name: 'SvelteKit', logo: 'Svelte' },
  { name: 'React + Vite', logo: 'React' },
  { name: 'Vue + Vite', logo: 'Vue' },
  { name: 'Nuxt', logo: 'Nuxt' },
  { name: 'React Router', logo: 'ReactRouter' },
  { name: 'Astro', logo: 'Astro' },
  { name: 'Vite', logo: 'Vite' }
];
