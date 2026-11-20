type Convention = { pattern: RegExp; index: RegExp | null };

const CONVENTIONS: Convention[] = [
  { pattern: /^(?:src\/)?routes\/(.*?)\/?\+page\.svelte$/, index: null },
  { pattern: /^(?:src\/)?app\/(.*?)\/?page\.[jt]sx?$/, index: null },
  { pattern: /^(?:src\/)?pages\/(.*)\.(?:[jt]sx?|vue|astro|svelte)$/, index: /(^|\/)index$/ },
  { pattern: /^(?:public\/)?(.*\.html)$/, index: /(^|\/)index\.html$/ }
];

const GROUP = /\([^/]*\)\/?/g;
const DYNAMIC = /\[|^_|\/_/;

export function routeOfFile(file: string): string | null {
  for (const { pattern, index } of CONVENTIONS) {
    const found = file.match(pattern);
    if (!found) {
      continue;
    }
    const path = (index ? found[1].replace(index, '') : found[1]).replace(GROUP, '').replace(/\/$/, '');
    return DYNAMIC.test(path) ? null : `/${path}`;
  }
  return null;
}
