const ROUTE_FILES = [
  /(?:^|\/)src\/routes\/(.*?)\+page\.svelte$/,
  /(?:^|\/)(?:src\/)?app\/(.*?)page\.(?:tsx|jsx|ts|js|mdx)$/,
  /(?:^|\/)(?:src\/)?pages\/(.*?)(?:index)?\.(?:tsx|jsx|ts|js|vue)$/
];

const GROUP = /^\(.*\)$/;
const SKIPPED_SEGMENT = /^[_@]|\[|^api$|^\d+$/;
const VUE_ROUTER_PATH = /\bpath:\s*(['"])(\/[^'"]*)\1/g;
const DYNAMIC_PATH = /[:*]/;

function routeOf(file: string): string | null {
  for (const pattern of ROUTE_FILES) {
    const dir = file.match(pattern)?.[1];
    if (dir === undefined) {
      continue;
    }
    const segments = dir.split('/').filter(Boolean);
    if (segments.some((s) => SKIPPED_SEGMENT.test(s))) {
      return null;
    }
    return `/${segments.filter((s) => !GROUP.test(s)).join('/')}`;
  }
  return null;
}

export function routesOf(files: string[]): string[] {
  const routes = files.map(routeOf).filter((r): r is string => r !== null);
  return [...new Set(routes)].sort();
}

export function vueRouterPaths(text: string): string[] {
  const paths = [...text.matchAll(VUE_ROUTER_PATH)].map((m) => m[2]).filter((p) => !DYNAMIC_PATH.test(p));
  return [...new Set(paths)];
}
