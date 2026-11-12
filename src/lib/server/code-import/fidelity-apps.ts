import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ComponentUse } from './component-marks';
import type { PageTree } from '$lib/server/url-import/page-tree';

const ARC_PAGES = ['buttons', 'forms', 'selection', 'pickers', 'editors', 'navigation', 'feedback', 'data-display', 'data-media', 'data-tables', 'charts-core', 'charts-more', 'text', 'overlay-dialog', 'overlay-drawer', 'overlay-sheet', 'overlay-popovers', 'overlay-hover', 'overlay-tooltip', 'overlay-notifications', 'overlay-user-menu', 'overlay-menus', 'overlay-notices', 'blocks-site', 'blocks-marketing', 'blocks-contact', 'blocks-band', 'blocks-content', 'blocks-compare', 'blocks-app', 'blocks-auth'];

const RUIXEN_PAGES = ['heroes-1', 'heroes-2', 'heroes-3', 'pricing-1', 'pricing-2', 'footers-banners-1', 'footers-banners-2', 'navigation-1', 'navigation-2', 'navigation-3', 'navigation-4', 'navigation-5', 'navigation-6', 'navigation-7', 'faq-1', 'calendars-1', 'calendars-2', 'calendars-3', 'tables-1', 'inputs-1', 'inputs-2', 'inputs-3', 'inputs-4', 'inputs-5', 'buttons-1', 'buttons-2', 'buttons-3', 'cards-1', 'cards-2', 'cards-3', 'cards-4', 'text-1', 'text-2', 'more-1', 'more-2', 'more-3', 'more-4', 'more-5', 'more-6'];

export enum AppSource {
  Repo = 'repo',
  Storybook = 'storybook',
  Folder = 'folder'
}

export type FidelityApp = { source: AppSource; at: string; pages: string[] };

export const FIDELITY_APPS: Record<string, FidelityApp> = {
  'shadcn-admin': { source: AppSource.Repo, at: 'https://github.com/satnaing/shadcn-admin', pages: ['/', '/tasks', '/users', '/settings'] },
  'next-playground': { source: AppSource.Repo, at: 'https://github.com/vercel/next-app-router-playground', pages: ['/', '/layouts', '/context'] },
  svgl: { source: AppSource.Repo, at: 'https://github.com/pheralb/svgl', pages: ['/', '/extensions'] },
  vitesse: { source: AppSource.Repo, at: 'https://github.com/antfu-collective/vitesse', pages: ['/', '/about'] },
  heroui: { source: AppSource.Storybook, at: 'https://storybook.heroui.com/', pages: [] },
  arc: { source: AppSource.Folder, at: 'libraries/arc', pages: ARC_PAGES },
  ruixen: { source: AppSource.Folder, at: 'libraries/ruixen', pages: RUIXEN_PAGES }
};

export type CapturedPage = { label: string; url: string; tree: PageTree; uses: ComponentUse[] };

export type CapturedApp = { pages: CapturedPage[]; names: string[] };

export const CODE_FIDELITY_DIR = join(homedir(), 'Documents/feega-videos/code-import/round2');

export const codeCapturedIn = (label: string) => join(CODE_FIDELITY_DIR, 'captures', label);

export const codeScoredIn = (label: string) => join(CODE_FIDELITY_DIR, 'runs', label);
