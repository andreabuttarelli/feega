import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const IMAGES_DIR = 'images';
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'];

const EXTENSIONS = new Set(IMAGE_EXTENSIONS.map((e) => `.${e}`));
const EXISTS = 'EEXIST';
const FALLBACK_STEM = 'image';

export type Copied = { ok: true; url: string } | { ok: false; reason: string };

enum PublicDir {
  Static = 'static',
  Public = 'public'
}

async function publicDirOf(appRoot: string): Promise<PublicDir> {
  const text = await readFile(join(appRoot, 'package.json'), 'utf8').catch(() => '{}');
  const manifest = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
  const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  return names.includes('@sveltejs/kit') ? PublicDir.Static : PublicDir.Public;
}

function stemOf(file: string): string {
  const stem = basename(file, extname(file)).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return stem || FALLBACK_STEM;
}

async function written(dir: string, stem: string, extension: string, bytes: Uint8Array): Promise<string> {
  for (let n = 1; ; n++) {
    const name = `${stem}${n === 1 ? '' : `-${n}`}${extension}`;
    try {
      await writeFile(join(dir, name), bytes, { flag: 'wx' });
      return name;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== EXISTS) {
        throw error;
      }
    }
  }
}

export async function copyImage(appRoot: string, fileName: string, bytes: Uint8Array): Promise<Copied> {
  const extension = extname(fileName).toLowerCase();
  if (!EXTENSIONS.has(extension)) {
    return { ok: false, reason: `${basename(fileName)} is not an image Feega can use` };
  }
  const dir = join(appRoot, await publicDirOf(appRoot), IMAGES_DIR);
  await mkdir(dir, { recursive: true });
  const name = await written(dir, stemOf(fileName), extension, bytes);
  return { ok: true, url: `/${IMAGES_DIR}/${name}` };
}
