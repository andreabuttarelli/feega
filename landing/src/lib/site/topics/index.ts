import { ALTERNATIVES, ALTERNATIVES_INDEX, ALTERNATIVES_PATH, alternativePath } from '../alternatives';
import { CODEBASE, CODEBASE_PATH } from '../codebase';
import { DOWNLOAD_PATH } from '../links';
import { topicPath, type Hub } from './topic';
import { TEMPLATE_TITLES } from '../templates';
import { REACT } from './for/react';
import { NEXTJS } from './for/nextjs';
import { SVELTEKIT } from './for/sveltekit';
import { VUE } from './for/vue';
import { TAILWIND } from './for/tailwind';
import { VSCODE } from './integrations/vscode';
import { CURSOR } from './integrations/cursor';
import { WINDSURF } from './integrations/windsurf';
import { VSCODIUM } from './integrations/vscodium';

export const FOR_HUB: Hub = {
  path: '/for',
  title: 'Visual editing for React, Vue, Nuxt and more | Feega',
  description: 'How Feega maps a click to your source in each framework, what it writes back (Tailwind, CSS modules or <style>) and where it stops.',
  heading: 'Feega for your framework',
  menuLabel: 'frameworks',
  intro: 'One page per stack, covering how a click on the page finds the line in your code and what Feega writes there or leaves alone.',
  topics: { react: REACT, nextjs: NEXTJS, sveltekit: SVELTEKIT, vue: VUE, tailwind: TAILWIND }
};

export const INTEGRATIONS_HUB: Hub = {
  path: '/integrations',
  title: 'Feega in VS Code, Cursor, Windsurf and VSCodium | Feega',
  description: 'Install Feega in the editor you already use. Where to get it, the commands and settings, and how it sits next to AI agents in each editor.',
  heading: 'Feega in your editor',
  menuLabel: 'editors',
  intro: 'Feega is one extension built on the VS Code extension API, so it runs in VS Code and in the editors built on it. Each page covers install, first run and the details that differ.',
  topics: { vscode: VSCODE, cursor: CURSOR, windsurf: WINDSURF, vscodium: VSCODIUM }
};

export const HUBS: readonly Hub[] = [FOR_HUB, INTEGRATIONS_HUB];

const FIXED_LABELS: Readonly<Record<string, string>> = {
  '/': 'Feega home',
  [DOWNLOAD_PATH]: 'Download Feega',
  '/pricing': 'Pricing',
  '/changelog': 'Changelog',
  [CODEBASE_PATH]: CODEBASE.heading,
  [ALTERNATIVES_PATH]: ALTERNATIVES_INDEX.heading
};

const LABELS: Readonly<Record<string, string>> = {
  ...FIXED_LABELS,
  ...TEMPLATE_TITLES,
  ...Object.fromEntries(HUBS.map((h) => [h.path, h.heading])),
  ...Object.fromEntries(HUBS.flatMap((h) => Object.entries(h.topics).map(([slug, t]) => [topicPath(h, slug), t.heading]))),
  ...Object.fromEntries(Object.entries(ALTERNATIVES).map(([slug, a]) => [alternativePath(slug), a.heading]))
};

export const linkLabel = (path: string): string | undefined => LABELS[path];

export const hubOf = (path: string): Hub | undefined => HUBS.find((h) => h.path === path);
