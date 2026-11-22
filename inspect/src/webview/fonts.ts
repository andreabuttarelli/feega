import catalogue from './google-fonts.json';

export enum FontCategory {
  Sans = 'sans-serif',
  Serif = 'serif',
  Mono = 'monospace',
  Display = 'display',
  Handwriting = 'handwriting'
}

export type GoogleFont = { family: string; category: FontCategory };

export const GOOGLE_FONTS: GoogleFont[] = (catalogue as [string, FontCategory][]).map(([family, category]) => ({ family, category }));

export const fallbackOf = (category: FontCategory) => (category === FontCategory.Serif ? 'serif' : category === FontCategory.Mono ? 'monospace' : 'sans-serif');

export function fontCss(family: string): string {
  const google = GOOGLE_FONTS.find((f) => f.family === family);
  return `'${family}', ${fallbackOf(google?.category ?? FontCategory.Sans)}`;
}

export const previewUrl = (families: string[]) => `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/\s+/g, '+')}`).join('&')}&display=swap&text=${encodeURIComponent('AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz 0123456789')}`;
