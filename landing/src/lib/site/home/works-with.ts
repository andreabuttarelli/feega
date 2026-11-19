import { EDITOR_ICONS } from '../editor-icons';

export interface WorksWithItem {
  readonly name: string;
  readonly href?: string;
  readonly icon: string;
}

const SVG_OPEN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">';

const svg = (path: string): string => `${SVG_OPEN}${path}</svg>`;

export const EDITORS: readonly WorksWithItem[] = [
  { name: 'vs code', href: '/integrations/vscode', icon: EDITOR_ICONS['VS Code'] },
  { name: 'cursor', href: '/integrations/cursor', icon: EDITOR_ICONS['Cursor'] },
  { name: 'windsurf', href: '/integrations/windsurf', icon: EDITOR_ICONS['Windsurf'] },
  { name: 'vscodium', href: '/integrations/vscodium', icon: EDITOR_ICONS['VSCodium / Open VSX'] },
  { name: 'npx feega', icon: EDITOR_ICONS['Terminal'] }
];

export const FRAMEWORKS: readonly WorksWithItem[] = [
  {
    name: 'sveltekit',
    href: '/for/sveltekit',
    icon: svg('<path d="M20.2 4.2c-2-2.9-6-3.7-8.9-1.9L6.2 5.6a5.7 5.7 0 0 0-2.6 3.8 6 6 0 0 0 .6 3.8 5.700 5.700 0 0 0-.9 2.200 6.100 6.100 0 0 0 1 4.500c2 2.900 6 3.700 8.900 1.900l5.100-3.300a5.700 5.700 0 0 0 2.600-3.800 6 6 0 0 0-.6-3.800 5.700 5.700 0 0 0 .9-2.200 6.100 6.100 0 0 0-1-4.500zM10.300 20.300a4.100 4.100 0 0 1-4.400-1.600 3.800 3.800 0 0 1-.7-2.900l.1-.5.100-.3.300.2c.7.500 1.500.900 2.300 1.100l.2.100v.2a1.300 1.300 0 0 0 .2 1 1.400 1.400 0 0 0 1.500.6 1.300 1.300 0 0 0 .4-.2l5.100-3.200a1.200 1.200 0 0 0 .6-.9 1.300 1.300 0 0 0-.2-1 1.400 1.400 0 0 0-1.500-.6 1.300 1.300 0 0 0-.4.200l-2 1.200a3.700 3.700 0 0 1-1 .4 4.100 4.100 0 0 1-4.400-1.600 3.800 3.800 0 0 1-.7-2.900 3.600 3.600 0 0 1 1.700-2.500l5.100-3.200a3.700 3.700 0 0 1 1-.4 4.100 4.100 0 0 1 4.400 1.600 3.800 3.800 0 0 1 .7 2.900l-.1.500-.1.300-.3-.2c-.7-.5-1.500-.9-2.300-1.100l-.2-.1v-.2a1.300 1.300 0 0 0-.2-1 1.400 1.400 0 0 0-1.500-.6 1.300 1.300 0 0 0-.4.200l-5.100 3.200a1.200 1.200 0 0 0-.6.900 1.300 1.300 0 0 0 .2 1 1.400 1.400 0 0 0 1.500.6 1.300 1.300 0 0 0 .4-.2l2-1.200a3.700 3.700 0 0 1 1-.4 4.100 4.100 0 0 1 4.400 1.600 3.800 3.800 0 0 1 .7 2.900 3.600 3.600 0 0 1-1.700 2.500l-5.100 3.200a3.700 3.700 0 0 1-1 .4z"/>')
  },
  {
    name: 'react',
    href: '/for/react',
    icon: svg('<circle cx="12" cy="12" r="2"/><g fill="none" stroke="currentColor" stroke-width="1.1"><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/></g>')
  },
  {
    name: 'next.js',
    href: '/for/nextjs',
    icon: svg('<path fill-rule="evenodd" d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm4.800 16.500-5.600-7.300v7.300H9.700V7h1.400l5.200 6.800V7h1.500v10.500z"/>')
  },
  {
    name: 'vue',
    href: '/for/vue',
    icon: svg('<path d="M2 3h4.200L12 13 17.800 3H22L12 20.500z"/>')
  },
  {
    name: 'tailwind',
    href: '/for/tailwind',
    icon: svg('<path d="M12 6c-2.700 0-4.400 1.300-5 4 1-1.300 2.200-1.800 3.500-1.500.8.200 1.300.700 1.900 1.300 1 1 2.100 2.200 4.600 2.200 2.700 0 4.400-1.300 5-4-1 1.300-2.200 1.800-3.500 1.500-.8-.2-1.300-.7-1.900-1.300C15.600 7.200 14.500 6 12 6zM7 12c-2.700 0-4.400 1.300-5 4 1-1.300 2.200-1.800 3.500-1.500.8.200 1.300.700 1.900 1.300 1 1 2.100 2.200 4.600 2.200 2.700 0 4.400-1.300 5-4-1 1.300-2.200 1.800-3.500 1.500-.8-.2-1.300-.7-1.900-1.300C10.600 13.200 9.500 12 7 12z"/>')
  }
];

export const WORKS_WITH_LABEL = 'works with';
export const WORKS_WITH_CLOSING = 'or any Vite app';
