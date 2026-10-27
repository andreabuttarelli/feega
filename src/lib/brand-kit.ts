import { z } from 'zod';

export const LOGO_VARIANTS = ['primary', 'light', 'dark', 'mark'] as const;
export const FONT_ROLES = ['heading', 'body', 'accent'] as const;

const MAX_SWATCHES = 24;
const MAX_LOGOS = 8;
const MAX_RULES = 20;
const MAX_RULE_CHARS = 200;
const MAX_TONE_CHARS = 500;
const MAX_NAME_CHARS = 40;

export const HEX = /^#[0-9A-Fa-f]{6}$/;

export const paletteSchema = z
  .array(z.object({ hex: z.string().regex(HEX), name: z.string().max(MAX_NAME_CHARS).optional() }).strict())
  .max(MAX_SWATCHES);

const rules = z.array(z.string().max(MAX_RULE_CHARS)).max(MAX_RULES);

export const voiceSchema = z.object({ tone: z.string().max(MAX_TONE_CHARS).optional(), do: rules.optional(), dont: rules.optional() }).strict();

export const logosSchema = z
  .array(z.object({ variant: z.enum(LOGO_VARIANTS), url: z.string().url() }).strict())
  .max(MAX_LOGOS);

export type Palette = z.infer<typeof paletteSchema>;
export type Voice = z.infer<typeof voiceSchema>;
export type Logos = z.infer<typeof logosSchema>;
export type FontRole = (typeof FONT_ROLES)[number];

export type LogoVariant = (typeof LOGO_VARIANTS)[number];

const lines = (value: FormDataEntryValue | null): string[] =>
  String(value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export function kitFromForm(fd: FormData): { ok: true; palette: Palette; voice: Voice } | { ok: false; error: string } {
  const palette: Palette = [];
  for (const line of lines(fd.get('palette'))) {
    const [hex, ...name] = line.split(/\s+/);
    if (!HEX.test(hex)) {
      return { ok: false, error: `Not a colour: ${line}` };
    }
    palette.push(name.length ? { hex: hex.toUpperCase(), name: name.join(' ') } : { hex: hex.toUpperCase() });
  }

  const tone = String(fd.get('tone') ?? '').trim();
  const voice: Voice = {
    ...(tone ? { tone } : {}),
    ...(lines(fd.get('do')).length ? { do: lines(fd.get('do')) } : {}),
    ...(lines(fd.get('dont')).length ? { dont: lines(fd.get('dont')) } : {})
  };

  const checked = paletteSchema.safeParse(palette).success && voiceSchema.safeParse(voice).success;
  return checked ? { ok: true, palette, voice } : { ok: false, error: 'Palette or voice is too long' };
}

export function kitToForm(kit: { palette: Palette; voice: Voice }): Record<'palette' | 'tone' | 'do' | 'dont', string> {
  return {
    palette: kit.palette.map((s) => (s.name ? `${s.hex} ${s.name}` : s.hex)).join('\n'),
    tone: kit.voice.tone ?? '',
    do: (kit.voice.do ?? []).join('\n'),
    dont: (kit.voice.dont ?? []).join('\n')
  };
}

export function setLogoVariant(logos: Logos, variant: LogoVariant, url: string | null): Logos {
  const at = logos.findIndex((l) => l.variant === variant);
  if (!url) {
    return logos.filter((l) => l.variant !== variant);
  }
  if (at === -1) {
    return [...logos, { variant, url }];
  }
  return logos.map((l, i) => (i === at ? { variant, url } : l));
}

export type BrandFontChoice = { role: FontRole; org_font_id: string | null; google_family: string | null };

export function fontsFromForm(fd: FormData): BrandFontChoice[] {
  return FONT_ROLES.map((role) => {
    const orgFont = String(fd.get(`org_font_${role}`) ?? '').trim();
    const google = String(fd.get(`font_${role}`) ?? '').trim();
    return { role, org_font_id: orgFont || null, google_family: orgFont ? null : google || null };
  });
}
