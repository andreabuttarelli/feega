export enum Kind {
  Linear = 'linear',
  Radial = 'radial',
  Conic = 'conic'
}

export type Preset = { id: string; name: string; css: string };

export const PRESETS: readonly Preset[] = [
  { id: 'dawn', name: 'Dawn', css: 'linear-gradient(135deg, #fde7d9 0%, #f8c9d4 100%)' },
  { id: 'mist', name: 'Mist', css: 'linear-gradient(160deg, #eef2f7 0%, #d5dfeb 100%)' },
  { id: 'sage', name: 'Sage', css: 'linear-gradient(135deg, #e6efe3 0%, #bfd6c4 100%)' },
  { id: 'sand', name: 'Sand', css: 'linear-gradient(135deg, #f6efe4 0%, #e8d5b9 100%)' },
  { id: 'lavender', name: 'Lavender', css: 'linear-gradient(135deg, #ece8fb 0%, #cfc6f2 100%)' },
  { id: 'sky', name: 'Sky', css: 'linear-gradient(180deg, #e3f1fb 0%, #b9dbf3 100%)' },
  { id: 'peach', name: 'Peach', css: 'linear-gradient(135deg, #ffe9d6 0%, #ffc9a8 100%)' },
  { id: 'ink', name: 'Ink', css: 'linear-gradient(160deg, #1c1f2a 0%, #0b0c10 100%)' },
  { id: 'midnight', name: 'Midnight', css: 'linear-gradient(135deg, #1b2440 0%, #0d1224 100%)' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(135deg, #1f3a32 0%, #0f1f1b 100%)' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%)' },
  { id: 'aurora', name: 'Aurora', css: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)' },
  { id: 'ember', name: 'Ember', css: 'linear-gradient(135deg, #ff7a3d 0%, #d6336c 100%)' },
  { id: 'mint', name: 'Mint', css: 'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)' },
  { id: 'dusk', name: 'Dusk', css: 'linear-gradient(180deg, #4c3a73 0%, #c06c84 100%)' },
  { id: 'halo', name: 'Halo', css: 'radial-gradient(circle at 50% 0%, #e0e7ff 0%, #ffffff 70%)' },
  { id: 'glow', name: 'Glow', css: 'radial-gradient(circle at 50% 100%, #fde2e4 0%, #ffffff 70%)' },
  { id: 'spotlight', name: 'Spotlight', css: 'radial-gradient(circle at 50% 30%, #3a3f55 0%, #0b0c10 70%)' },
  { id: 'nebula', name: 'Nebula', css: 'radial-gradient(circle at 30% 20%, #6d5dfc 0%, #1a1446 70%)' },
  { id: 'ember-glow', name: 'Ember glow', css: 'radial-gradient(circle at 70% 80%, #ff8a5b 0%, #2a0f0a 75%)' },
  { id: 'lagoon', name: 'Lagoon', css: 'radial-gradient(circle at 20% 80%, #5ee7df 0%, #1d3b5a 80%)' },
  { id: 'blush', name: 'Blush', css: 'radial-gradient(circle at 80% 20%, #ffd1dc 0%, #fff5f7 70%)' },
  { id: 'pearl', name: 'Pearl', css: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #e8ebf0 100%)' },
  { id: 'moss', name: 'Moss', css: 'radial-gradient(circle at 30% 70%, #9bc5a0 0%, #1e3a2c 90%)' },
  { id: 'citrus', name: 'Citrus', css: 'radial-gradient(circle at 50% 50%, #ffe082 0%, #ffb74d 100%)' },
  { id: 'deep-space', name: 'Deep space', css: 'radial-gradient(ellipse at 50% 120%, #243b6b 0%, #05070f 70%)' },
  { id: 'prism', name: 'Prism', css: 'conic-gradient(from 0deg at 50% 50%, #fbd3e9, #bb91f5, #8ec5fc, #bff3e4, #fbd3e9)' },
  { id: 'sheen', name: 'Sheen', css: 'conic-gradient(from 45deg at 50% 50%, #f5f5f7, #d9dce3, #f5f5f7, #cfd3dc, #f5f5f7)' },
  { id: 'dusk-spin', name: 'Dusk spin', css: 'conic-gradient(from 180deg at 50% 50%, #3b2f63, #c06c84, #f6b093, #3b2f63)' },
  { id: 'ocean-spin', name: 'Ocean spin', css: 'conic-gradient(from 90deg at 50% 50%, #0f2a4a, #2b6cb0, #7fd1ea, #0f2a4a)' },
  { id: 'metal', name: 'Metal', css: 'conic-gradient(from 0deg at 50% 50%, #2a2d34, #4a4f5a, #2a2d34, #5b6170, #2a2d34)' },
  { id: 'warm-wheel', name: 'Warm wheel', css: 'conic-gradient(from 0deg at 50% 50%, #ffd6a5, #ffadad, #ffc6ff, #ffd6a5)' },
  { id: 'cool-wheel', name: 'Cool wheel', css: 'conic-gradient(from 0deg at 50% 50%, #bde0fe, #a2d2ff, #cdb4db, #bde0fe)' },
  { id: 'corner-glow', name: 'Corner glow', css: 'conic-gradient(from 225deg at 0% 0%, #ffffff, #dbe4ff, #ffffff)' },
  { id: 'forest-wheel', name: 'Forest wheel', css: 'conic-gradient(from 0deg at 50% 50%, #1e3a2c, #3f7d5b, #a8d5ba, #1e3a2c)' }
];

export const kindOf = (preset: Preset): Kind => preset.css.split('-gradient')[0] as Kind;
