type Rgba = { r: number; g: number; b: number; a: number };

enum ColourFormat {
  Hex = 'hex',
  Rgb = 'rgb',
  Hsl = 'hsl',
  BareHsl = 'bare-hsl',
  Oklch = 'oklch',
  Named = 'named'
}

const NUMBER = String.raw`-?\d*\.?\d+(?:e-?\d+)?`;
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION = /^(rgba?|hsla?|oklch)\(\s*([^)]*)\)$/i;
const BARE_HSL = new RegExp(`^(${NUMBER})(?:deg)?\\s+(${NUMBER})%\\s+(${NUMBER})%$`);
const PART = new RegExp(`^(${NUMBER})(%|deg)?$`);
const BYTE = 255;
const PERCENT = 100;
const DEGREES = 360;
const HUE_SECTOR = 60;
const HUE_STEP = 30;
const HUE_TURN = 12;
const OPAQUE = 1;

const NAMED: Record<string, Rgba> = {
  white: { r: BYTE, g: BYTE, b: BYTE, a: OPAQUE },
  black: { r: 0, g: 0, b: 0, a: OPAQUE },
  transparent: { r: 0, g: 0, b: 0, a: 0 }
};

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
const byte = (n: number) => Math.round(clamp(n, BYTE));
const hex2 = (n: number) => byte(n).toString(16).padStart(2, '0');
const trimmed = (n: number, places: number) => String(Number(n.toFixed(places)));

const hexOf = (c: Rgba) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a < OPAQUE ? hex2(c.a * BYTE) : ''}`;

function fromHex(raw: string): Rgba {
  const digits = raw.slice(1);
  const full = digits.length <= 4 ? [...digits].map((d) => d + d).join('') : digits;
  const at = (i: number) => parseInt(full.slice(i * 2, i * 2 + 2), 16);
  return { r: at(0), g: at(1), b: at(2), a: full.length === 8 ? at(3) / BYTE : OPAQUE };
}

type Part = { value: number; unit: string };

function partsOf(body: string): { parts: Part[]; alpha: number } | null {
  const [main, slash] = body.split('/');
  const pieces = main.split(/[\s,]+/).filter(Boolean);
  const alphaRaw = slash?.trim() ?? (pieces.length === 4 ? pieces.pop() : undefined);
  const parts = pieces.map((p) => PART.exec(p)).map((m) => (m ? { value: Number(m[1]), unit: m[2] ?? '' } : null));
  if (parts.length !== 3 || parts.some((p) => !p)) {
    return null;
  }
  const alphaPart = alphaRaw === undefined ? null : PART.exec(alphaRaw);
  if (alphaRaw !== undefined && !alphaPart) {
    return null;
  }
  const alpha = alphaPart ? Number(alphaPart[1]) / (alphaPart[2] === '%' ? PERCENT : 1) : OPAQUE;
  return { parts: parts as Part[], alpha };
}

function fromHsl(h: number, s: number, l: number, a: number): Rgba {
  const light = l / PERCENT;
  const reach = (s / PERCENT) * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / HUE_STEP) % HUE_TURN;
    return (light - reach * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * BYTE;
  };
  return { r: channel(0), g: channel(8), b: channel(4), a };
}

function toHsl(c: Rgba): [number, number, number] {
  const [r, g, b] = [c.r / BYTE, c.g / BYTE, c.b / BYTE];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) {
    return [0, 0, light * PERCENT];
  }
  const sat = delta / (1 - Math.abs(2 * light - 1));
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [(hue * HUE_SECTOR + DEGREES) % DEGREES, sat * PERCENT, light * PERCENT];
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function fromOklch(lightness: number, chroma: number, hue: number, a: number): Rgba {
  const rad = (hue * Math.PI) / (DEGREES / 2);
  const [L, A, B] = [lightness, chroma * Math.cos(rad), chroma * Math.sin(rad)];
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const linear = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const [r, g, b] = linear.map((v) => toGamma(clamp(v, 1)) * BYTE);
  return { r, g, b, a };
}

function toOklch(c: Rgba): [number, number, number] {
  const [r, g, b] = [c.r, c.g, c.b].map((v) => toLinear(v / BYTE));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(A, B);
  const hue = chroma < 1e-4 ? 0 : ((Math.atan2(B, A) * (DEGREES / 2)) / Math.PI + DEGREES) % DEGREES;
  return [L, chroma < 1e-4 ? 0 : chroma, hue];
}

type Read = { format: ColourFormat; rgba: Rgba };

const FUNCTIONS: Record<string, (p: Part[], alpha: number) => Read> = {
  rgb: (p, a) => ({ format: ColourFormat.Rgb, rgba: { r: p[0].unit === '%' ? (p[0].value * BYTE) / PERCENT : p[0].value, g: p[1].unit === '%' ? (p[1].value * BYTE) / PERCENT : p[1].value, b: p[2].unit === '%' ? (p[2].value * BYTE) / PERCENT : p[2].value, a } }),
  hsl: (p, a) => ({ format: ColourFormat.Hsl, rgba: fromHsl(p[0].value, p[1].value, p[2].value, a) }),
  oklch: (p, a) => ({ format: ColourFormat.Oklch, rgba: fromOklch(p[0].unit === '%' ? p[0].value / PERCENT : p[0].value, p[1].value, p[2].value, a) })
};

function read(raw: string): Read | null {
  const text = raw.trim().toLowerCase();
  if (HEX.test(text)) {
    return { format: ColourFormat.Hex, rgba: fromHex(text) };
  }
  if (NAMED[text]) {
    return { format: ColourFormat.Named, rgba: NAMED[text] };
  }
  const bare = BARE_HSL.exec(text);
  if (bare) {
    return { format: ColourFormat.BareHsl, rgba: fromHsl(Number(bare[1]), Number(bare[2]), Number(bare[3]), OPAQUE) };
  }
  const fn = FUNCTION.exec(text);
  const parsed = fn ? partsOf(fn[2]) : null;
  return fn && parsed ? FUNCTIONS[fn[1].replace(/a$/, '')](parsed.parts, parsed.alpha) : null;
}

export const colourOf = (raw: string): string | null => {
  const got = read(raw);
  return got ? hexOf(got.rgba) : null;
};

const alphaSuffix = (a: number) => (a < OPAQUE ? ` / ${trimmed(a, 3)}` : '');

const WRITERS: Record<ColourFormat, (c: Rgba, raw: string) => string> = {
  [ColourFormat.Hex]: (c) => hexOf(c),
  [ColourFormat.Named]: (c) => hexOf(c),
  [ColourFormat.Rgb]: (c, raw) => (raw.includes(',') ? `rgb(${byte(c.r)}, ${byte(c.g)}, ${byte(c.b)}${c.a < OPAQUE ? `, ${trimmed(c.a, 3)}` : ''})` : `rgb(${byte(c.r)} ${byte(c.g)} ${byte(c.b)}${alphaSuffix(c.a)})`),
  [ColourFormat.Hsl]: (c) => {
    const [h, s, l] = toHsl(c);
    return `hsl(${trimmed(h, 2)} ${trimmed(s, 2)}% ${trimmed(l, 2)}%${alphaSuffix(c.a)})`;
  },
  [ColourFormat.BareHsl]: (c) => {
    const [h, s, l] = toHsl(c);
    return `${trimmed(h, 2)} ${trimmed(s, 2)}% ${trimmed(l, 2)}%`;
  },
  [ColourFormat.Oklch]: (c, raw) => {
    const [l, chroma, h] = toOklch(c);
    const lightness = /oklch\(\s*[\d.]+%/i.test(raw) ? `${trimmed(l * PERCENT, 2)}%` : trimmed(l, 4);
    return `oklch(${lightness} ${trimmed(chroma, 4)} ${trimmed(h, 3)}${alphaSuffix(c.a)})`;
  }
};

export function writtenLike(raw: string, hex: string): string {
  const target = read(hex);
  const like = read(raw);
  if (!target) {
    return hex;
  }
  return WRITERS[like?.format ?? ColourFormat.Hex](target.rgba, raw);
}
