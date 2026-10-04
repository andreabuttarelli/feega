import { esc } from './html';

export const FONT_CSS_ORIGIN = 'https://fonts.googleapis.com';
export const FONT_FILE_ORIGIN = 'https://fonts.gstatic.com';

export type CspInput = { scripts: string[]; assetUrls: string[] };

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function assetOrigins(urls: Iterable<string>): string[] {
  return [...new Set([...urls].map(originOf).filter((o): o is string => o !== null))].sort();
}

export function cspPolicy(input: CspInput): string {
  const media = assetOrigins(input.assetUrls).join(' ');
  const directives: Record<string, string> = {
    'default-src': "'none'",
    'script-src': `'unsafe-inline' ${input.scripts.join(' ')}`,
    'style-src': `'unsafe-inline' ${FONT_CSS_ORIGIN}`,
    'font-src': `${FONT_FILE_ORIGIN} data:`,
    'img-src': `'self' data: blob: ${media}`,
    'media-src': `'self' data: blob: ${media}`,
    'connect-src': `data: blob: ${FONT_CSS_ORIGIN} ${FONT_FILE_ORIGIN} ${media}`,
    'worker-src': "'none'",
    'frame-src': "'none'",
    'object-src': "'none'",
    'base-uri': "'none'",
    'form-action': "'none'"
  };
  return Object.entries(directives)
    .map(([name, value]) => `${name} ${value.trim()}`)
    .join('; ');
}

export function cspMeta(input: CspInput): string {
  return `<meta http-equiv="Content-Security-Policy" content="${esc(cspPolicy(input))}" />`;
}
