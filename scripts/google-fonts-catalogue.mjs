import { writeFileSync } from 'node:fs';

const METADATA_URL = 'https://fonts.google.com/metadata/fonts';
const OUT = new URL('../src/lib/motion/fonts/google-catalogue.json', import.meta.url);

const CATEGORY = { 'Sans Serif': 'sans', Serif: 'serif', Display: 'display', Handwriting: 'handwriting', Monospace: 'mono' };

const response = await fetch(METADATA_URL);
if (!response.ok) {
  throw new Error(`Google Fonts metadata: HTTP ${response.status}`);
}
const text = await response.text();
const { familyMetadataList } = JSON.parse(text.replace(/^\)\]\}'/, ''));

const families = familyMetadataList
  .filter((f) => f.isOpenSource !== false)
  .sort((a, b) => a.popularity - b.popularity)
  .map((f) => {
    const styles = Object.keys(f.fonts);
    const weights = [...new Set(styles.map((s) => Number.parseInt(s, 10)))].sort((a, b) => a - b);
    const axes = (f.axes ?? []).map((a) => [a.tag, a.min, a.max]);
    return { f: f.family, c: CATEGORY[f.category] ?? 'display', w: weights, i: styles.some((s) => s.endsWith('i')) ? 1 : 0, ...(axes.length ? { a: axes } : {}) };
  });

writeFileSync(OUT, JSON.stringify(families));
console.log(`${families.length} families → ${OUT.pathname}`);
