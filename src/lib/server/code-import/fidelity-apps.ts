import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ComponentUse } from './component-marks';
import type { PageTree } from '$lib/server/url-import/page-tree';

const ARC_PAGES = ['buttons', 'forms', 'selection', 'pickers', 'editors', 'navigation', 'feedback', 'data-display', 'data-media', 'data-tables', 'charts-core', 'charts-more', 'text', 'overlay-dialog', 'overlay-drawer', 'overlay-sheet', 'overlay-popovers', 'overlay-hover', 'overlay-tooltip', 'overlay-notifications', 'overlay-user-menu', 'overlay-menus', 'overlay-notices', 'blocks-site', 'blocks-marketing', 'blocks-contact', 'blocks-band', 'blocks-content', 'blocks-compare', 'blocks-app', 'blocks-auth'];

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
  arc: { source: AppSource.Folder, at: 'libraries/arc', pages: ARC_PAGES }
};

export type CapturedPage = { label: string; url: string; tree: PageTree; uses: ComponentUse[] };

export type CapturedApp = { pages: CapturedPage[]; names: string[] };

export const CODE_FIDELITY_DIR = join(homedir(), 'Documents/feega-videos/code-import/round2');

export const codeCapturedIn = (label: string) => join(CODE_FIDELITY_DIR, 'captures', label);

export const codeScoredIn = (label: string) => join(CODE_FIDELITY_DIR, 'runs', label);
