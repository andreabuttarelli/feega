import { GITHUB_URL, MARKETPLACE_URL, OPEN_VSX_URL } from '../links';
import type { Source } from './topic';

export const CHECKED = '2026-11-19';

export const FEEGA_SOURCE: Source = { label: 'Feega source code on GitHub (Apache-2.0)', href: GITHUB_URL };
export const MARKETPLACE: Source = { label: 'Feega on the Visual Studio Marketplace', href: MARKETPLACE_URL };
export const OPEN_VSX: Source = { label: 'Feega on Open VSX', href: OPEN_VSX_URL };
export const DOCS: Source = { label: 'Feega docs: the inspect extension', href: 'https://docs.feega.app/integrations/inspect/' };

export const img = (section: string, name: string) => `/img/${section}/${name}.webp`;
