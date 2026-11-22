import { EDITOR_ICONS } from '../editor-icons';
import { LOGO_PATHS, type Logo } from '../codebase/logos';

export interface WorksWithItem {
  readonly name: string;
  readonly href?: string;
  readonly icon: string;
}

const SVG_OPEN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">';

const svg = (path: string): string => `${SVG_OPEN}${path}</svg>`;

const logo = (name: Logo): string => svg(`<path d="${LOGO_PATHS[name]}"/>`);

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
  { name: 'nuxt', icon: logo('Nuxt') },
  { name: 'react router', icon: logo('ReactRouter') },
  { name: 'astro', icon: logo('Astro') },
  { name: 'vite', icon: logo('Vite') },
  {
    name: 'tailwind',
    href: '/for/tailwind',
    icon: svg('<path d="M12 6c-2.700 0-4.400 1.300-5 4 1-1.300 2.200-1.800 3.500-1.500.8.200 1.300.700 1.900 1.300 1 1 2.100 2.200 4.600 2.200 2.700 0 4.400-1.300 5-4-1 1.300-2.200 1.800-3.500 1.500-.8-.2-1.300-.7-1.900-1.300C15.600 7.200 14.500 6 12 6zM7 12c-2.700 0-4.400 1.300-5 4 1-1.300 2.200-1.800 3.500-1.500.8.200 1.300.700 1.900 1.300 1 1 2.100 2.200 4.600 2.200 2.700 0 4.400-1.300 5-4-1 1.300-2.200 1.800-3.500 1.500-.8-.2-1.300-.7-1.900-1.300C10.600 13.200 9.500 12 7 12z"/>')
  }
];

export const WORKS_WITH_LABEL = 'works with';
export const WORKS_WITH_CLOSING = 'or any Vite app';

export interface LeadChip {
  readonly name: string;
  readonly item: WorksWithItem;
}

const byName = (items: readonly WorksWithItem[], name: string): WorksWithItem => items.find((item) => item.name === name)!;

export const LEAD_EDITORS: readonly LeadChip[] = [
  { name: 'VS Code', item: byName(EDITORS, 'vs code') },
  { name: 'Cursor', item: byName(EDITORS, 'cursor') },
  { name: 'Windsurf', item: byName(EDITORS, 'windsurf') }
];

const agentIcon = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${body}</svg>`;

export interface AgentChip {
  readonly name: string;
  readonly icon: string;
}

export const LEAD_AGENTS: readonly AgentChip[] = [
  {
    name: 'ChatGPT',
    icon: agentIcon('<path fill="#fff" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.910 6.046 6.046 0 0 0-6.510-2.900A6.065 6.065 0 0 0 4.981 4.180a5.985 5.985 0 0 0-3.998 2.900 6.046 6.046 0 0 0 .743 7.097 5.980 5.980 0 0 0 .510 4.911 6.051 6.051 0 0 0 6.515 2.900A5.985 5.985 0 0 0 13.260 24a6.056 6.056 0 0 0 5.772-4.206 5.990 5.990 0 0 0 3.997-2.900 6.056 6.056 0 0 0-.747-7.073zM13.260 22.430a4.476 4.476 0 0 1-2.876-1.040l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.020 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.600 18.304a4.470 4.470 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .780 0l5.843-3.369v2.332a.080.080 0 0 1-.033.062L9.740 19.950a4.500 4.500 0 0 1-6.140-1.646zM2.340 7.896a4.485 4.485 0 0 1 2.366-1.973V11.600a.766.766 0 0 0 .388.677l5.815 3.354-2.020 1.168a.076.076 0 0 1-.071 0l-4.830-2.790A4.504 4.504 0 0 1 2.340 7.872zm16.597 3.855l-5.833-3.387L15.119 7.200a.076.076 0 0 1 .071 0l4.830 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.790.790 0 0 0-.407-.667zm2.010-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.230V6.897a.066.066 0 0 1 .028-.061l4.830-2.787a4.500 4.500 0 0 1 6.680 4.660zm-12.640 4.135l-2.020-1.164a.080.080 0 0 1-.038-.057V6.075a4.500 4.500 0 0 1 7.375-3.453l-.142.080L8.704 5.460a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.500 2.607 1.500v2.999l-2.597 1.500-2.607-1.500z"/>')
  },
  {
    name: 'Claude',
    icon: agentIcon('<g stroke="#D97757" stroke-width="2.4" stroke-linecap="round"><path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3L5.3 18.7"/></g>')
  },
  {
    name: 'Gemini',
    icon: agentIcon('<defs><linearGradient id="gem" x1="4" y1="20" x2="20" y2="4"><stop offset="0" stop-color="#4285F4"/><stop offset=".55" stop-color="#9B72CB"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs><path fill="url(#gem)" d="M12 2C12.600 7.600 16.400 11.400 22 12 16.400 12.600 12.600 16.400 12 22 11.400 16.400 7.600 12.600 2 12 7.600 11.400 11.400 7.600 12 2z"/>')
  },
  {
    name: 'OpenCode',
    icon: agentIcon('<path fill="#fff" fill-rule="evenodd" d="M4 2h16v20H4zm4 5v10h8V7z"/>')
  }
];
