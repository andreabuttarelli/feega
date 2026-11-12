import { APP_URL } from '../links';
import type { Logo } from './logos';

export const CODEBASE_PATH = '/design-in-your-codebase';

export const CODEBASE = {
  title: 'Design in Your Codebase – Code to Design to Code | Feega',
  description:
    'Import a GitHub repo or folder into Feega: pages become boards, tokens become variables with light and dark modes. Edit, then open a pull request.',
  cta: {
    href: `${APP_URL}/?utm_source=feega.app&utm_medium=site&utm_campaign=design-in-your-codebase`,
    label: 'Import your repo →'
  }
} as const;

export type Step = { label: string; title: string; text: string };

export const STEPS: readonly Step[] = [
  { label: 'Code', title: 'Import your app', text: 'Paste a GitHub repo, public or private, or pick a folder. Feega starts the app and opens the routes you choose.' },
  { label: 'Design', title: 'Edit it on the canvas', text: 'Pages become editable boards. Design tokens become variables with light and dark modes. React, Vue and Svelte components stay components.' },
  { label: 'Code', title: 'Send it back', text: 'Token edits go back as a pull request. Pull the latest code whenever the repo moves on.' }
];

export enum Tier {
  Tested = 'tested',
  Early = 'early'
}

export type Framework = { name: string; logo: Logo; tier: Tier };

export const FRAMEWORKS: readonly Framework[] = [
  { name: 'Next.js', logo: 'Next', tier: Tier.Tested },
  { name: 'SvelteKit', logo: 'Svelte', tier: Tier.Tested },
  { name: 'React + Vite', logo: 'React', tier: Tier.Tested },
  { name: 'Vue + Vite', logo: 'Vue', tier: Tier.Tested },
  { name: 'Nuxt', logo: 'Nuxt', tier: Tier.Early },
  { name: 'Astro', logo: 'Astro', tier: Tier.Early },
  { name: 'React Router / Remix', logo: 'ReactRouter', tier: Tier.Early },
  { name: 'Gatsby', logo: 'Gatsby', tier: Tier.Early },
  { name: 'Angular', logo: 'Angular', tier: Tier.Early },
  { name: 'Create React App', logo: 'CreateReactApp', tier: Tier.Early },
  { name: 'Svelte + Vite', logo: 'Vite', tier: Tier.Early },
  { name: 'Solid + Vite', logo: 'Solid', tier: Tier.Early }
];

export const TIERS: readonly { tier: Tier; label: string; note: string }[] = [
  { tier: Tier.Tested, label: 'Tested', note: 'Measured on real open-source apps.' },
  { tier: Tier.Early, label: 'Early support', note: 'Recognised and started; not yet measured on real apps.' }
];

export const STYLE_SOURCES: readonly { name: string; logo: Logo }[] = [
  { name: 'Tailwind v4', logo: 'Tailwind' },
  { name: 'CSS variables', logo: 'Css' },
  { name: 'shadcn/ui', logo: 'Shadcn' }
];

export type Fact = { title: string; text: string };

export const CARRIED: readonly Fact[] = [
  { title: 'Pages', text: 'One board per route, up to 8 routes per import.' },
  { title: 'Widths and themes', text: 'Phone, tablet and desktop widths, in light and dark.' },
  { title: 'Components', text: 'Named as in your code. React and Vue components get variants from the props your pages use; Svelte components come without variants for now.' },
  { title: 'Design tokens', text: 'CSS variables, Tailwind v4 @theme and shadcn/ui themes become variables, with a mode per theme.' },
  { title: 'Fonts and images', text: 'Your web fonts and images, as files on the canvas.' }
];

export const SOURCES: readonly Fact[] = [
  { title: 'GitHub', text: 'Public repos by URL. Connect GitHub for private ones.' },
  { title: 'Local folder', text: 'In the local app, read and written in place.' },
  { title: 'Folder upload', text: 'On the web, a one-time snapshot.' }
];

export const RETURNS: readonly Fact[] = [
  { title: 'Tokens', text: 'A variable you change is written to its declaration, in each mode.' },
  { title: 'Text and style', text: 'Written at the exact line on Svelte 5 and React 18 apps. React 19 and Vue apps send token edits only.' },
  { title: 'Publish', text: 'GitHub: a new branch and a pull request. Local folder: a commit on a feega/ branch.' },
  { title: 'Pull', text: 'Re-imports the latest code and keeps your edits. When both sides change the same property, the code wins and you see the conflict.' }
];

export const COMPONENTS_NOTE = 'Components are read from React, Vue and Svelte. Angular and Solid apps come across as pages only.';

export const NOT_YET = 'Not yet: pages behind a login, apps that need environment variables, and components no imported page renders.';
