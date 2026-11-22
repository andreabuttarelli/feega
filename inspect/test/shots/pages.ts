export enum Stack {
  Html = 'html',
  React = 'react',
  Vue = 'vue',
  SvelteKit = 'sveltekit',
  Nuxt = 'nuxt'
}

export enum Scheme {
  Light = 'light',
  Dark = 'dark'
}

export type Palette = {
  readonly scheme: Scheme;
  readonly bg: string;
  readonly surface: string;
  readonly raised: string;
  readonly fg: string;
  readonly muted: string;
  readonly subtle: string;
  readonly line: string;
  readonly lineStrong: string;
  readonly accent: string;
  readonly accentHover: string;
  readonly accentFg: string;
  readonly accentSoft: string;
  readonly accentText: string;
};

export type Page = {
  readonly id: string;
  readonly title: string;
  readonly stack: Stack;
  readonly items: readonly string[];
  readonly palette: Palette;
  readonly shots: readonly string[];
  readonly alt: string;
};

export const PAGES: readonly Page[] = [
  {
    id: 'saas',
    title: 'Lumen',
    stack: Stack.Html,
    items: ['navbar', 'hero-product', 'bento-grid', 'pricing'],
    palette: { scheme: Scheme.Light, bg: '#f6f7fb', surface: '#eceefa', raised: '#ffffff', fg: '#111327', muted: '#4b4f6b', subtle: '#5d6180', line: '#dfe2f2', lineStrong: '#c5c9e4', accent: '#4f46e5', accentHover: '#6258f0', accentFg: '#ffffff', accentSoft: '#e4e2ff', accentText: '#3730a3' },
    shots: ['overview'],
    alt: 'a SaaS landing page with a product hero, a bento grid and pricing'
  },
  {
    id: 'portfolio',
    title: 'Mara Quill',
    stack: Stack.Html,
    items: ['navbar-minimal', 'hero-minimal', 'gallery'],
    palette: { scheme: Scheme.Light, bg: '#f3f3ee', surface: '#e8e8df', raised: '#ffffff', fg: '#10110c', muted: '#47493c', subtle: '#5a5c4c', line: '#dddcd0', lineStrong: '#c3c2b3', accent: '#c6f432', accentHover: '#d4fa55', accentFg: '#10110c', accentSoft: '#ecfbb8', accentText: '#40560a' },
    shots: ['selected'],
    alt: 'a photographer portfolio with a minimal hero and a gallery'
  },
  {
    id: 'shop',
    title: 'Pebble Goods',
    stack: Stack.Html,
    items: ['announcement-bar', 'navbar-centered', 'hero-split', 'gallery'],
    palette: { scheme: Scheme.Light, bg: '#fbf4f4', surface: '#f5e6e7', raised: '#ffffff', fg: '#2a1215', muted: '#6b3f45', subtle: '#7a4c52', line: '#efd9db', lineStrong: '#dfbcc0', accent: '#e11d48', accentHover: '#f23b62', accentFg: '#ffffff', accentSoft: '#fde1e7', accentText: '#9f1239' },
    shots: ['changes'],
    alt: 'a home goods shop with an announcement bar, a split hero and a product gallery'
  },
  {
    id: 'dashboard',
    title: 'Tidepool',
    stack: Stack.Html,
    items: ['sidebar-layout', 'stats-cards', 'data-table'],
    palette: { scheme: Scheme.Dark, bg: '#0a1214', surface: '#101d20', raised: '#14262a', fg: '#e6f4f2', muted: '#9bb8b4', subtle: '#82a29d', line: '#1c3135', lineStrong: '#2a474c', accent: '#2dd4bf', accentHover: '#52e0cf', accentFg: '#04201c', accentSoft: '#0b2d2a', accentText: '#5eead4' },
    shots: ['layers-menu'],
    alt: 'an analytics dashboard with a sidebar, stat cards and a data table'
  },
  {
    id: 'blog',
    title: 'Field Notes',
    stack: Stack.Html,
    items: ['navbar-minimal', 'hero-centered', 'blog-cards', 'newsletter'],
    palette: { scheme: Scheme.Light, bg: '#f2f7f1', surface: '#e4eee2', raised: '#ffffff', fg: '#0f2415', muted: '#3f5a46', subtle: '#52705a', line: '#d6e5d3', lineStrong: '#b9d0b5', accent: '#15803d', accentHover: '#1a9a49', accentFg: '#ffffff', accentSoft: '#d7f0de', accentText: '#14532d' },
    shots: ['tablet'],
    alt: 'a blog home with a centered hero, article cards and a newsletter form'
  },
  {
    id: 'login',
    title: 'Orbit',
    stack: Stack.Html,
    items: ['login-form'],
    palette: { scheme: Scheme.Dark, bg: '#0a0f1f', surface: '#121a33', raised: '#18223f', fg: '#e8edff', muted: '#a0acd6', subtle: '#8794c2', line: '#222d52', lineStrong: '#33427a', accent: '#3b82f6', accentHover: '#5c97f8', accentFg: '#ffffff', accentSoft: '#12255a', accentText: '#8db7ff' },
    shots: ['phone'],
    alt: 'a mobile app sign-in screen'
  },
  {
    id: 'agency',
    title: 'Brightside Studio',
    stack: Stack.React,
    items: ['navbar', 'hero-bento', 'team-grid', 'cta-band'],
    palette: { scheme: Scheme.Dark, bg: '#0e0d0a', surface: '#1a1913', raised: '#23211a', fg: '#f6f2e4', muted: '#bdb7a0', subtle: '#a39d86', line: '#2e2c22', lineStrong: '#47432f', accent: '#facc15', accentHover: '#fcd93f', accentFg: '#1a1500', accentSoft: '#2e2705', accentText: '#fde047' },
    shots: ['react'],
    alt: 'a creative agency page with a bento hero, a team grid and a call to action'
  },
  {
    id: 'docs',
    title: 'Fathom Docs',
    stack: Stack.Vue,
    items: ['navbar-app', 'tabs', 'steps', 'changelog', 'faq-two-column'],
    palette: { scheme: Scheme.Light, bg: '#f7fbfa', surface: '#e7f3f0', raised: '#ffffff', fg: '#0c2420', muted: '#3d5f59', subtle: '#4f7169', line: '#d5e8e3', lineStrong: '#b4d3cc', accent: '#0d9488', accentHover: '#12ad9f', accentFg: '#ffffff', accentSoft: '#d3f1ec', accentText: '#0f5f57' },
    shots: ['vue'],
    alt: 'a documentation site with an app bar, tabs, a changelog and a FAQ'
  },
  {
    id: 'event',
    title: 'Parallax Conf',
    stack: Stack.SvelteKit,
    items: ['announcement-bar', 'hero-media', 'stats-band', 'faq'],
    palette: { scheme: Scheme.Dark, bg: '#12060e', surface: '#1f0d19', raised: '#2a1322', fg: '#fbe9f3', muted: '#d2a6bf', subtle: '#b98ba5', line: '#3a1a2d', lineStrong: '#572843', accent: '#e11d74', accentHover: '#f23d8a', accentFg: '#ffffff', accentSoft: '#3d0c26', accentText: '#ff7ab4' },
    shots: ['sveltekit'],
    alt: 'a conference page with a media hero, stats and a FAQ'
  },
  {
    id: 'cafe',
    title: 'Ember Roasters',
    stack: Stack.Nuxt,
    items: ['navbar-centered', 'feature-image', 'testimonials-grid', 'footer-minimal'],
    palette: { scheme: Scheme.Light, bg: '#f6efe4', surface: '#ecdfcc', raised: '#fffaf0', fg: '#2b160a', muted: '#6a4a33', subtle: '#7d5c44', line: '#e6d6bd', lineStrong: '#d1ba98', accent: '#b45309', accentHover: '#cc6414', accentFg: '#ffffff', accentSoft: '#f7e0c2', accentText: '#7c3a06' },
    shots: ['nuxt'],
    alt: 'a coffee roaster page with a feature panel and customer reviews'
  }
];
