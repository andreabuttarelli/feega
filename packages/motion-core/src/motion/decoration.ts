export const DECORATIONS = ['none', 'underline', 'strikethrough'] as const;
export type Decoration = (typeof DECORATIONS)[number];

export const DECORATION_STYLES = ['solid', 'double', 'dotted', 'dashed', 'wavy'] as const;
export type DecorationStyle = (typeof DECORATION_STYLES)[number];

export const RULE = {
  thickness: { min: 0.01, max: 0.3, step: 0.005, fallback: 0.06 },
  offset: { min: -0.5, max: 1, step: 0.01, fallback: 0.1 },
  strike: -0.3
} as const;

export const FEATURES = /^('[a-z0-9]{4}' [01])(, '[a-z0-9]{4}' [01])*$|^$/;

const FEATURE = /'([a-z0-9]{4})' ([01])/g;

export const featuresOf = (value: unknown): Record<string, boolean> => Object.fromEntries([...String(value ?? '').matchAll(FEATURE)].map((m) => [m[1], m[2] === '1']));

export const SMALL_CAPS = { smcp: true } as const;

export const featureCss = (features: Record<string, boolean>): string | undefined => {
  const entries = Object.entries(features);
  return entries.length ? entries.map(([tag, on]) => `'${tag}' ${on ? 1 : 0}`).join(', ') : undefined;
};

type Decorated = Record<string, unknown> & { decoration?: unknown; decorationStyle?: unknown; decorationThickness?: unknown; decorationOffset?: unknown; decorationColor?: unknown; skipInk?: unknown; features?: unknown; textCase?: unknown };

export const featuresFor = (p: Decorated): Record<string, boolean> => ({ ...featuresOf(p.features), ...(p.textCase === 'small-caps' ? SMALL_CAPS : {}) });

const CSS_LINE: Record<Decoration, string | undefined> = { none: undefined, underline: 'underline', strikethrough: 'line-through' };

export function decorationCss(p: Decorated, colour: (v: string) => string): Record<string, string | undefined> {
  const line = CSS_LINE[(p.decoration as Decoration | undefined) ?? 'none'];
  const features = featureCss(featuresFor(p));
  if (!line) {
    return { fontFeatureSettings: features };
  }
  return {
    textDecorationLine: line,
    textDecorationStyle: String(p.decorationStyle ?? 'solid'),
    textDecorationThickness: `${Number(p.decorationThickness ?? RULE.thickness.fallback)}em`,
    textUnderlineOffset: `${Number(p.decorationOffset ?? RULE.offset.fallback)}em`,
    textDecorationColor: p.decorationColor ? colour(String(p.decorationColor)) : undefined,
    textDecorationSkipInk: p.skipInk === false ? 'none' : 'auto',
    fontFeatureSettings: features
  };
}
