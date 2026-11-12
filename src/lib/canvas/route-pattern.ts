export enum ParamKind {
  One = 'one',
  Rest = 'rest',
  Optional = 'optional',
  OptionalRest = 'optional-rest'
}

const PARAM = /\[\[\.\.\.([^\]]+)\]\]|\[\[([^\]]+)\]\]|\[\.\.\.([^\]]+)\]|\[([^\]]+)\]/g;
const KINDS = [ParamKind.OptionalRest, ParamKind.Optional, ParamKind.Rest, ParamKind.One];

const SEGMENT_PATTERN: Record<ParamKind, string> = {
  [ParamKind.One]: '[^/]+',
  [ParamKind.Rest]: '.+',
  [ParamKind.Optional]: '[^/]+',
  [ParamKind.OptionalRest]: '.+'
};

export type PatternParam = { name: string; kind: ParamKind; token: string };

export const paramsOf = (pattern: string): PatternParam[] =>
  [...pattern.matchAll(PARAM)].map((m) => {
    const at = m.slice(1).findIndex((g) => g !== undefined);
    return { name: m[at + 1], kind: KINDS[at], token: m[0] };
  });

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function segmentSource(segment: string): string {
  const whole = paramsOf(segment);
  const optional = whole.length === 1 && whole[0].token === segment && (whole[0].kind === ParamKind.Optional || whole[0].kind === ParamKind.OptionalRest);
  if (optional) {
    return `(?:/${SEGMENT_PATTERN[whole[0].kind]})?`;
  }
  const parts = segment.split(PARAM);
  let source = '';
  for (let i = 0; i < parts.length; i += 5) {
    source += escaped(parts[i]);
    const at = parts.slice(i + 1, i + 5).findIndex((g) => g !== undefined);
    source += at >= 0 ? SEGMENT_PATTERN[KINDS[at]] : '';
  }
  return `/${source}`;
}

export function matcherOf(pattern: string): RegExp {
  const segments = pattern.split('/').filter(Boolean);
  return new RegExp(`^${segments.map(segmentSource).join('')}$`);
}

export const pathKey = (path: string) => (path === '/' ? '' : path.replace(/\/+$/, ''));

export const routeMatches = (pattern: string, path: string) => matcherOf(pattern).test(pathKey(path));
