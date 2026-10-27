import { loadSession } from '../lib/auth.ts';
import { fontsApi } from '../lib/fonts.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdFonts(opts: { org?: string }) {
  const { fonts } = await fontsApi.list(await token(), opts.org);
  if (!fonts.length) {
    console.log('No uploaded fonts. Add one with: feega fonts upload <file>');
    return;
  }
  for (const font of fonts) {
    console.log(`${font.family}\t${font.weight}${font.italic ? ' italic' : ''}\t${font.assetId}`);
  }
}

export async function cmdFontsUpload(file: string, opts: { org?: string }) {
  const { font } = await fontsApi.upload(await token(), file, opts.org);
  console.log(`Uploaded ${font.family} ${font.weight}${font.italic ? ' italic' : ''}`);
}

export async function cmdFontsDelete(family: string, opts: { org?: string }) {
  await fontsApi.remove(await token(), family, opts.org);
  console.log(`Deleted ${family}`);
}
