const COMPONENT = /^[A-Z][A-Za-z0-9]*$/;
const KEBAB_BOUNDARY = /([a-z0-9])([A-Z])/g;
const LIBRARY_AFFIX = /^icon-|-icon$/g;
const NOT_FOUND = -1;

export function iconNameOf(component: string): string | null {
  if (!COMPONENT.test(component)) {
    return null;
  }
  return component.replace(KEBAB_BOUNDARY, '$1-$2').toLowerCase().replace(LIBRARY_AFFIX, '');
}

export const maskOf = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

export function nextTile(key: string, from: number, count: number, columns: number): number {
  const last = count - 1;
  const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
  if (!(key in step)) {
    return from;
  }
  const to = from + step[key];
  if (to < 0) {
    return key === 'ArrowUp' ? NOT_FOUND : 0;
  }
  return Math.min(to, last);
}
