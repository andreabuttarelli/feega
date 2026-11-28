type Convention = { pattern: RegExp; index: RegExp | null };

export type PageRoute = { route: string; dynamic: boolean; sourced?: string[] };

const CONVENTIONS: Convention[] = [
  { pattern: /^(?:src\/)?routes\/(.*?)\/?\+page\.svelte$/, index: null },
  { pattern: /^(?:src\/)?app\/(.*?)\/?page\.[jt]sx?$/, index: null },
  { pattern: /^(?:src\/)?pages\/(.*)\.(?:[jt]sx?|vue|astro|svelte)$/, index: /(^|\/)index$/ },
  { pattern: /^(?:public\/)?(.*\.html)$/, index: /(^|\/)index\.html$/ }
];

const GROUP = /\([^/]*\)\/?/g;
const PRIVATE = /^_|\/_/;
const DYNAMIC = /\[/;

export function pageOfFile(file: string): PageRoute | null {
  for (const { pattern, index } of CONVENTIONS) {
    const found = file.match(pattern);
    if (!found) {
      continue;
    }
    const path = (index ? found[1].replace(index, '') : found[1]).replace(GROUP, '').replace(/\/$/, '');
    return PRIVATE.test(path) ? null : { route: `/${path}`, dynamic: DYNAMIC.test(path) };
  }
  return null;
}

export function routeOfFile(file: string): string | null {
  const page = pageOfFile(file);
  return page && !page.dynamic ? page.route : null;
}
