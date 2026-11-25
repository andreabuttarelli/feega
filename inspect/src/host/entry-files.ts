export enum FileRole {
  Page = 'page',
  Entry = 'entry'
}

type Row = { framework: string; role: FileRole; pattern: RegExp };

const SCRIPT = '[jt]sx?';

export const ENTRY_FILES: Row[] = [
  { framework: 'next', role: FileRole.Page, pattern: new RegExp(`(^|/)app/(.*/)?(page|layout|template|loading|error|not-found|global-error|default)\\.${SCRIPT}$`) },
  { framework: 'next', role: FileRole.Page, pattern: new RegExp(`(^|/)pages/.*\\.${SCRIPT}$`) },
  { framework: 'nuxt', role: FileRole.Page, pattern: /(^|\/)(pages|layouts)\/.*\.vue$|(^|\/)app\.vue$/ },
  { framework: 'astro', role: FileRole.Page, pattern: /(^|\/)src\/pages\/.*\.astro$/ },
  { framework: 'sveltekit', role: FileRole.Page, pattern: /(^|\/)\+(page|layout|error)(\.[\w-]+)?\.svelte$/ },
  { framework: 'react-router', role: FileRole.Page, pattern: new RegExp(`(^|/)app/(root|routes)(/.*)?\\.${SCRIPT}$`) },
  { framework: 'react-router', role: FileRole.Page, pattern: new RegExp(`(^|/)routes/.*\\.${SCRIPT}$`) },
  { framework: 'spa', role: FileRole.Entry, pattern: new RegExp(`^(src/)?(main|index)\\.${SCRIPT}$`) },
  { framework: 'spa', role: FileRole.Entry, pattern: new RegExp(`(^|/)(router|routes|routing)\\.${SCRIPT}$`) }
];

const hasRole = (file: string, role: FileRole) => ENTRY_FILES.some((row) => row.role === role && row.pattern.test(file));

export const isPage = (file: string) => hasRole(file, FileRole.Page);

export const isEntry = (file: string) => hasRole(file, FileRole.Entry);
