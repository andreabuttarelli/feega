import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

export const SDK_FILE = here('sdk/feega-plugin-sdk.js');

export async function sdkSource() {
  const { outputFiles } = await build({ absWorkingDir: here('.'), entryPoints: ['src/client.ts'], bundle: true, write: false, format: 'esm', target: 'es2022', outfile: SDK_FILE, legalComments: 'none' });
  return outputFiles[0].text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(SDK_FILE, await sdkSource());
}
