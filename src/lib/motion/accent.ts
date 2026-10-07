export enum AccentSource {
  Logo = 'logo',
  Favicon = 'favicon',
  Theme = 'theme-color',
  Buttons = 'buttons',
  Css = 'css',
  None = 'none'
}

export type NeutralPalette = { ink: string; paper: string; muted: string; line: string };

export const NEUTRAL_PALETTE: NeutralPalette = { ink: '#0A0A0A', paper: '#FAFAF9', muted: '#8A8A8A', line: '#E5E5E3' };

export type Accent = { hex: string; source: AccentSource; neutral: null } | { hex: null; source: AccentSource.None; neutral: NeutralPalette };

export type AccentCandidates = Partial<Record<Exclude<AccentSource, AccentSource.None>, readonly string[]>>;

export const ACCENT_ORDER: readonly Exclude<AccentSource, AccentSource.None>[] = [AccentSource.Logo, AccentSource.Favicon, AccentSource.Theme, AccentSource.Buttons, AccentSource.Css];

const MIN_CHROMA = 0.18;
const CHANNEL_MAX = 255;

function chroma(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (Math.max(...channels) - Math.min(...channels)) / CHANNEL_MAX;
}

const isAccent = (hex: string) => /^#[0-9a-fA-F]{6}$/.test(hex) && chroma(hex) >= MIN_CHROMA;

export function pickAccent(candidates: AccentCandidates): Accent {
  for (const source of ACCENT_ORDER) {
    const hex = (candidates[source] ?? []).find(isAccent);
    if (hex) {
      return { hex: hex.toUpperCase(), source, neutral: null };
    }
  }
  return { hex: null, source: AccentSource.None, neutral: NEUTRAL_PALETTE };
}
