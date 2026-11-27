enum Kind {
  Static = 'static',
  Param = 'param',
  Optional = 'optional',
  CatchAll = 'catch-all',
  OptionalCatchAll = 'optional-catch-all'
}

type Segment = { kind: Kind; name: string };

export type RouteParam = { name: string; required: boolean };

const QUERY_OR_HASH = /[?#].*$/;
const GROUP = /^\([^)]*\)$/;

const SYNTAX: { kind: Kind; pattern: RegExp }[] = [
  { kind: Kind.OptionalCatchAll, pattern: /^\[\[\.\.\.([^\]]+)\]\]$/ },
  { kind: Kind.CatchAll, pattern: /^\[\.\.\.([^\]]+)\]$/ },
  { kind: Kind.Optional, pattern: /^\[\[([^\]=]+)(?:=[^\]]+)?\]\]$/ },
  { kind: Kind.Param, pattern: /^\[([^\].=]+)(?:=[^\]]+)?\]$/ }
];

const SPECIFICITY: Record<Kind, number> = {
  [Kind.Static]: 4,
  [Kind.Param]: 3,
  [Kind.Optional]: 2,
  [Kind.CatchAll]: 1,
  [Kind.OptionalCatchAll]: 0
};

const REQUIRED = new Set([Kind.Param, Kind.CatchAll]);
const MULTI = new Set([Kind.CatchAll, Kind.OptionalCatchAll]);
const SKIPPABLE = new Set([Kind.Optional, Kind.OptionalCatchAll]);

const partsOf = (path: string) => path.replace(QUERY_OR_HASH, '').split('/').filter(Boolean);

function segmentOf(part: string): Segment {
  for (const { kind, pattern } of SYNTAX) {
    const found = part.match(pattern);
    if (found) {
      return { kind, name: found[1] };
    }
  }

  return { kind: Kind.Static, name: part };
}

const segmentsOf = (pattern: string): Segment[] =>
  partsOf(pattern)
    .filter((part) => !GROUP.test(part))
    .map(segmentOf);

function consume(segments: Segment[], parts: string[], values: Record<string, string>): Record<string, string> | null {
  const [segment, ...rest] = segments;
  if (!segment) {
    return parts.length === 0 ? values : null;
  }

  if (segment.kind === Kind.Static) {
    return parts[0] === segment.name ? consume(rest, parts.slice(1), values) : null;
  }

  if (MULTI.has(segment.kind)) {
    if (parts.length === 0) {
      return SKIPPABLE.has(segment.kind) ? consume(rest, parts, values) : null;
    }
    return consume(rest, [], { ...values, [segment.name]: parts.join('/') });
  }

  const withValue = parts.length > 0 ? consume(rest, parts.slice(1), { ...values, [segment.name]: parts[0] }) : null;
  if (withValue || !SKIPPABLE.has(segment.kind)) {
    return withValue;
  }

  return consume(rest, parts, values);
}

export const matchRoute = (pattern: string, path: string) => consume(segmentsOf(pattern), partsOf(path), {});

export const paramsOf = (pattern: string): RouteParam[] =>
  segmentsOf(pattern)
    .filter((s) => s.kind !== Kind.Static)
    .map((s) => ({ name: s.name, required: REQUIRED.has(s.kind) }));

export function fillRoute(pattern: string, values: Record<string, string>): string | null {
  const parts: string[] = [];

  for (const segment of segmentsOf(pattern)) {
    if (segment.kind === Kind.Static) {
      parts.push(segment.name);
      continue;
    }

    const value = (values[segment.name] ?? '').trim().replace(/^\/+|\/+$/g, '');
    if (value === '' && SKIPPABLE.has(segment.kind)) {
      continue;
    }
    if (value === '' || (!MULTI.has(segment.kind) && value.includes('/'))) {
      return null;
    }
    parts.push(value);
  }

  return `/${parts.join('/')}`;
}

export function labelOf(pattern: string, path: string): string {
  const values = Object.values(matchRoute(pattern, path) ?? {});

  return values.length === 0 ? path : values.join(' / ');
}

function moreSpecific(a: string, b: string): boolean {
  const left = segmentsOf(a);
  const right = segmentsOf(b);

  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const diff = SPECIFICITY[left[i].kind] - SPECIFICITY[right[i].kind];
    if (diff !== 0) {
      return diff > 0;
    }
  }

  return left.length > right.length;
}

function bestOf(patterns: string[], path: string): string | null {
  let best: string | null = null;

  for (const pattern of patterns) {
    if (matchRoute(pattern, path) && (best === null || moreSpecific(pattern, best))) {
      best = pattern;
    }
  }

  return best;
}

export function assignExamples(patterns: string[], paths: string[]): Record<string, string[]> {
  const examples = Object.fromEntries(patterns.map((pattern) => [pattern, [] as string[]]));

  for (const raw of paths) {
    const path = `/${partsOf(raw).join('/')}`;
    const pattern = bestOf(patterns, path);
    if (pattern && !examples[pattern].includes(path)) {
      examples[pattern].push(path);
    }
  }

  return examples;
}
