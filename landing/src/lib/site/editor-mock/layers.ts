import type { LayerGlyph } from './glyphs';

export type LayerRow = { depth: number; open?: boolean; icon: LayerGlyph; name: string; picked?: boolean; count?: string };

export const LAYERS: LayerRow[] = [
  { depth: 0, open: true, icon: 'block', name: 'html' },
  { depth: 1, open: true, icon: 'head', name: 'Head' },
  { depth: 2, icon: 'title', name: 'title' },
  { depth: 2, icon: 'meta', name: 'meta' },
  { depth: 1, open: true, icon: 'flexColumn', name: 'body' },
  { depth: 2, open: true, icon: 'header', name: 'header.bar' },
  { depth: 3, icon: 'flexRow', name: 'a.brand' },
  { depth: 3, open: true, icon: 'nav', name: 'nav' },
  { depth: 4, icon: 'link', name: 'a', count: '×4' },
  { depth: 3, icon: 'button', name: 'button.cta' },
  { depth: 2, open: true, icon: 'flexColumn', name: 'section.hero' },
  { depth: 3, icon: 'h1', name: 'h1.title' },
  { depth: 3, icon: 'text', name: 'p.lead', picked: true },
  { depth: 3, icon: 'flexRow', name: 'div.actions' },
  { depth: 2, open: true, icon: 'grid', name: 'section.features' },
  { depth: 3, icon: 'repeat', name: 'article.card', count: '×3' },
  { depth: 2, icon: 'footer', name: 'footer' }
];
