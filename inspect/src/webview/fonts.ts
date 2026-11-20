export enum FontCategory {
  Sans = 'sans-serif',
  Serif = 'serif',
  Mono = 'monospace',
  Display = 'display',
  Handwriting = 'handwriting'
}

export type GoogleFont = { family: string; category: FontCategory };

const sans = (family: string) => ({ family, category: FontCategory.Sans });
const serif = (family: string) => ({ family, category: FontCategory.Serif });
const mono = (family: string) => ({ family, category: FontCategory.Mono });
const display = (family: string) => ({ family, category: FontCategory.Display });
const hand = (family: string) => ({ family, category: FontCategory.Handwriting });

export const GOOGLE_FONTS: GoogleFont[] = [
  ...['Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins', 'Lato', 'Nunito', 'Work Sans', 'DM Sans', 'Manrope', 'Space Grotesk', 'Plus Jakarta Sans', 'Outfit', 'Sora', 'Figtree', 'Geist', 'Rubik', 'Raleway', 'Source Sans 3', 'IBM Plex Sans', 'Karla', 'Mulish', 'Urbanist', 'Lexend', 'Onest', 'Schibsted Grotesk', 'Bricolage Grotesque', 'Instrument Sans', 'Hanken Grotesk', 'Archivo'].map(sans),
  ...['Playfair Display', 'Merriweather', 'Lora', 'EB Garamond', 'Cormorant Garamond', 'Libre Baskerville', 'Source Serif 4', 'Crimson Pro', 'DM Serif Display', 'Fraunces', 'Instrument Serif', 'Newsreader', 'Spectral', 'Bodoni Moda'].map(serif),
  ...['JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Space Mono', 'Roboto Mono', 'Source Code Pro', 'Geist Mono', 'DM Mono'].map(mono),
  ...['Bebas Neue', 'Anton', 'Oswald', 'Abril Fatface', 'Syne', 'Unbounded', 'Righteous', 'Archivo Black'].map(display),
  ...['Caveat', 'Dancing Script', 'Pacifico', 'Kalam', 'Shadows Into Light'].map(hand)
];

export const fallbackOf = (category: FontCategory) => (category === FontCategory.Serif ? 'serif' : category === FontCategory.Mono ? 'monospace' : 'sans-serif');

export function fontCss(family: string): string {
  const google = GOOGLE_FONTS.find((f) => f.family === family);
  return `'${family}', ${fallbackOf(google?.category ?? FontCategory.Sans)}`;
}

export const previewUrl = (families: string[]) => `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/\s+/g, '+')}`).join('&')}&display=swap&text=${encodeURIComponent('AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz 0123456789')}`;
