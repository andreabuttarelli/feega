import { FEEGA_TOKENS, resolveColor, type BrandTokens } from '../brand';
import { BRAND_COLORS, type BrandColor } from '../components';
import { kebab, NameBook } from './naming';
import { TokenKind, type Ref, type Token } from './ir';

export enum ColourRole {
  Page = 'page',
  Text = 'text',
  Fill = 'fill',
  Stroke = 'stroke'
}

const ROLE_NAMES: Record<ColourRole, readonly string[]> = {
  [ColourRole.Page]: ['background'],
  [ColourRole.Text]: ['foreground', 'muted', 'subtle'],
  [ColourRole.Fill]: ['surface', 'surface-alt'],
  [ColourRole.Stroke]: ['border']
};

const ROLE_ORDER: readonly ColourRole[] = [ColourRole.Page, ColourRole.Text, ColourRole.Fill, ColourRole.Stroke];

const RADIUS_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'] as const;
const FULL_RADIUS = 999;
const ACCENT_SATURATION = 0.35;
const ACCENT_NAME = 'accent';
const PLAIN_NAMES: Record<string, string> = { '#ffffff': 'white', '#000000': 'black' };
const FONT_FALLBACK = 'ui-sans-serif, system-ui, sans-serif';
const HEX = /^#[0-9a-f]{6}$/i;
const MIN_LIGHTNESS = 0.18;
const MAX_LIGHTNESS = 0.9;

type Use = { count: number; roles: Map<ColourRole, number>; name?: string };

const isBrand = (value: string): value is BrandColor => (BRAND_COLORS as readonly string[]).includes(value);

function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  if (max === min || light < MIN_LIGHTNESS || light > MAX_LIGHTNESS) {
    return 0;
  }
  return (max - min) / (1 - Math.abs(2 * light - 1));
}

const fontSlug = (family: string) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sans';

const byUse = ([a, ua]: [string, Use], [b, ub]: [string, Use]) => ub.count - ua.count || a.localeCompare(b);

export class TokenBook {
  private readonly colours = new Map<string, Use>();
  private readonly fonts = new Map<string, number>();
  private readonly spaces = new Set<number>();
  private readonly radii = new Set<number>();

  constructor(private readonly brand: BrandTokens | null) {}

  colour(raw: string, role: ColourRole, variable?: string, weight = 1): Ref | string {
    const value = isBrand(raw) ? raw : raw.toLowerCase();
    if (!isBrand(value) && !HEX.test(value)) {
      return value;
    }
    const use: Use = this.colours.get(value) ?? { count: 0, roles: new Map() };
    use.count += 1;
    use.roles.set(role, (use.roles.get(role) ?? 0) + weight);
    use.name ??= variable ? kebab(variable) : isBrand(value) ? kebab(value) : PLAIN_NAMES[value];
    this.colours.set(value, use);
    return { token: TokenKind.Colour, raw: value };
  }

  font(family: string): Ref {
    this.fonts.set(family, (this.fonts.get(family) ?? 0) + 1);
    return { token: TokenKind.Font, raw: family };
  }

  space(px: number): Ref {
    this.spaces.add(px);
    return { token: TokenKind.Space, raw: `${px}px` };
  }

  radius(px: number): Ref | string {
    if (px >= FULL_RADIUS) {
      return '9999px';
    }
    this.radii.add(px);
    return { token: TokenKind.Radius, raw: `${px}px` };
  }

  tokens(): Token[] {
    return [...this.colourTokens(), ...this.fontTokens(), ...this.spaceTokens(), ...this.radiusTokens()];
  }

  private colourValue(raw: string): string {
    return isBrand(raw) ? resolveColor(raw, this.brand ?? FEEGA_TOKENS) : raw;
  }

  private colourTokens(): Token[] {
    const names = new NameBook();
    const named = new Map<string, string>();
    const ranked = [...this.colours.entries()].sort(byUse);
    for (const [raw, use] of ranked) {
      if (use.name) {
        named.set(raw, names.unique(use.name));
      }
    }
    const accent = ranked.filter(([raw]) => !named.has(raw) && HEX.test(raw) && saturation(raw) >= ACCENT_SATURATION).at(0);
    if (accent) {
      named.set(accent[0], names.unique(ACCENT_NAME));
    }
    for (const role of ROLE_ORDER) {
      const pool = [...ROLE_NAMES[role]];
      const byRole = ranked.filter(([raw, use]) => !named.has(raw) && use.roles.has(role)).sort(([a, ua], [b, ub]) => (ub.roles.get(role) ?? 0) - (ua.roles.get(role) ?? 0) || a.localeCompare(b));
      for (const [raw] of byRole.slice(0, pool.length)) {
        named.set(raw, names.unique(pool.shift() as string));
      }
    }
    let other = 1;
    for (const [raw] of ranked) {
      if (!named.has(raw)) {
        named.set(raw, names.unique(`${saturation(raw) >= ACCENT_SATURATION ? 'color' : 'neutral'}-${other++}`));
      }
    }
    return ranked.map(([raw]) => ({ kind: TokenKind.Colour, name: named.get(raw) as string, raw, value: this.colourValue(raw) }));
  }

  private fontTokens(): Token[] {
    const names = new NameBook();
    return [...this.fonts.entries()]
      .sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b))
      .map(([family]) => ({ kind: TokenKind.Font, name: names.unique(fontSlug(family)), raw: family, value: `"${family}", ${FONT_FALLBACK}` }));
  }

  private spaceTokens(): Token[] {
    return [...this.spaces].sort((a, b) => a - b).map((px, i) => ({ kind: TokenKind.Space, name: String(i + 1), raw: `${px}px`, value: `${px}px` }));
  }

  private radiusTokens(): Token[] {
    return [...this.radii].sort((a, b) => a - b).map((px, i) => ({ kind: TokenKind.Radius, name: RADIUS_NAMES[i] ?? `r${i + 1}`, raw: `${px}px`, value: `${px}px` }));
  }
}

export const tokenKey = (kind: TokenKind, raw: string) => `${kind}:${raw}`;

export const tokenIndex = (tokens: readonly Token[]): Map<string, Token> => new Map(tokens.map((t) => [tokenKey(t.kind, t.raw), t]));
