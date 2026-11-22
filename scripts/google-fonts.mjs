import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const METADATA_URL = 'https://fonts.google.com/metadata/fonts';
const OUTPUT = fileURLToPath(new URL('../inspect/src/webview/google-fonts.json', import.meta.url));
const XSSI_PREFIX = /^\)\]\}'/;

const CATEGORIES = {
  'Sans Serif': 'sans-serif',
  Serif: 'serif',
  Monospace: 'monospace',
  Display: 'display',
  Handwriting: 'handwriting'
};

export function parseMetadata(text) {
  const { familyMetadataList } = JSON.parse(text.replace(XSSI_PREFIX, ''));
  return familyMetadataList
    .filter((font) => CATEGORIES[font.category])
    .sort((a, b) => a.popularity - b.popularity)
    .map((font) => [font.family, CATEGORIES[font.category]]);
}

async function refresh() {
  const response = await fetch(METADATA_URL);
  if (!response.ok) {
    throw new Error(`${METADATA_URL} answered ${response.status}`);
  }
  const fonts = parseMetadata(await response.text());
  await writeFile(OUTPUT, `${JSON.stringify(fonts)}\n`);
  console.log(`${fonts.length} Google Fonts families written to ${OUTPUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await refresh();
}
