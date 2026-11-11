import { Scheme } from '$lib/server/web/colour-scheme';

export { Scheme };

export type RenderConditions = { scheme: Scheme; width: number };

export const BASE_CONDITIONS: RenderConditions = { scheme: Scheme.Light, width: 1280 };

export const WIDTHS = { Desktop: 1280, Tablet: 768, Phone: 390 } as const;

export const MAX_CONDITIONS = 6;

const MIN_WIDTH = 240;
const MAX_WIDTH = 3840;
const KEY_SEPARATOR = '@';

const isBase = (c: RenderConditions) => c.scheme === BASE_CONDITIONS.scheme && c.width === BASE_CONDITIONS.width;

export const conditionKey = (c: RenderConditions): string | undefined => (isBase(c) ? undefined : `${c.scheme}${KEY_SEPARATOR}${c.width}`);

export function parseKey(key: string | undefined): RenderConditions {
  const [scheme, width] = (key ?? '').split(KEY_SEPARATOR);
  const parsed = conditionsOf([{ scheme, width: Number(width) }]);
  return key ? parsed[0] : BASE_CONDITIONS;
}

const SCHEMES = new Set<string>(Object.values(Scheme));

function valid(raw: unknown): RenderConditions | null {
  const c = raw as { scheme?: unknown; width?: unknown } | null;
  const width = Number(c?.width);
  const ok = typeof c === 'object' && c !== null && SCHEMES.has(String(c.scheme)) && Number.isInteger(width) && width >= MIN_WIDTH && width <= MAX_WIDTH;
  return ok ? { scheme: c!.scheme as Scheme, width } : null;
}

export function conditionsOf(raw: unknown): RenderConditions[] {
  const list = Array.isArray(raw) ? raw.flatMap((r) => valid(r) ?? []) : [];
  const unique = new Map(list.map((c) => [`${c.scheme}${KEY_SEPARATOR}${c.width}`, c]));
  return unique.size ? [...unique.values()].slice(0, MAX_CONDITIONS) : [BASE_CONDITIONS];
}

export function labelOf(route: string, c: RenderConditions): string {
  const parts = [c.scheme === BASE_CONDITIONS.scheme ? null : c.scheme, c.width === BASE_CONDITIONS.width ? null : `${c.width}px`];
  return [route, ...parts.filter(Boolean)].join(' · ');
}

export type Variant = { route: string; label: string; conditions: RenderConditions };

export const variantsOf = (routes: string[], conditions: RenderConditions[]): Variant[] => routes.flatMap((route) => conditions.map((c) => ({ route, label: labelOf(route, c), conditions: c })));

export enum AxisSupport {
  Switchable = 'switchable',
  Applied = 'applied',
  Unsupported = 'unsupported'
}

export type Axis = { id: string; label: string; support: AxisSupport; reason: string };

export const CONDITION_AXES: Axis[] = [
  { id: 'theme', label: 'Theme (light, dark)', support: AxisSupport.Switchable, reason: 'The page opens with prefers-color-scheme, color-scheme and the stored theme key set to the chosen scheme, so class, data-attribute and media-query themes follow. Custom named themes are not enumerated.' },
  { id: 'viewport', label: 'Viewport and breakpoints', support: AxisSupport.Switchable, reason: 'The page opens at the chosen width, so media and container queries resolve for it.' },
  { id: 'tokens', label: 'Design tokens and CSS variables', support: AxisSupport.Applied, reason: 'The browser resolves them to values before capture. They are not linked to feega variables, so an edit writes the element, not the token.' },
  { id: 'styles', label: 'Global styles, resets, layouts, providers', support: AxisSupport.Applied, reason: 'The real route is rendered with its stylesheets and wrappers.' },
  { id: 'fonts', label: 'Font loading', support: AxisSupport.Applied, reason: 'Loaded faces are read from the page and from its stylesheets.' },
  { id: 'motion', label: 'Reduced motion, contrast', support: AxisSupport.Applied, reason: 'Frames are captured at rest, with the browser defaults for both.' },
  { id: 'variants', label: 'Component variants', support: AxisSupport.Applied, reason: 'Every variant the route renders becomes a component variant. A variant the route does not render is not imported.' },
  { id: 'locale', label: 'Locale and text direction', support: AxisSupport.Unsupported, reason: 'The browser language is fixed, so the default catalog is shown. Right-to-left is not simulated.' },
  { id: 'state', label: 'Auth, feature flags, env vars, loading, empty and error states', support: AxisSupport.Unsupported, reason: 'The dev server renders what its own configuration and data give. States are not forced.' }
];
