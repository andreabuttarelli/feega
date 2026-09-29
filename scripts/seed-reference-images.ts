import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { REFERENCE_IMAGES_BUCKET } from '$lib/server/repos/reference-images';

const SOURCE_DIR = resolve(process.cwd(), 'imgs');
const CATALOGUE_PREFIX = 'catalogue';
const DRY_RUN = process.argv.includes('--dry-run');

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

const HOME_FILE_PREFIX = 'home-';

export function isHomeFile(file: string): boolean {
  return file.startsWith(HOME_FILE_PREFIX);
}

export function displayName(file: string): string {
  const stem = file.slice(0, file.length - extname(file).length);
  const words = stem.replace(/^(model-)?\d+-/, '').split('-').filter(Boolean);
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function seedUse() {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path === 'scripts/seed-reference-images.ts');
  if (!use) {
    throw new Error('seed-reference-images: missing entry in service-role-uses.ts');
  }
  return use;
}

async function main() {
  const files = (await readdir(SOURCE_DIR))
    .filter((f) => MIME_BY_EXTENSION[extname(f).toLowerCase()])
    .filter((f) => !isHomeFile(f))
    .sort();
  console.log(`${files.length} images in ${SOURCE_DIR}`);
  if (DRY_RUN) {
    files.forEach((f, i) => console.log(`${i}\t${CATALOGUE_PREFIX}/${f}\t${displayName(f)}`));
    return;
  }

  const db = createServiceRoleDb(seedUse());
  for (const [index, file] of files.entries()) {
    const path = `${CATALOGUE_PREFIX}/${file}`;
    const mimeType = MIME_BY_EXTENSION[extname(file).toLowerCase()];
    const bytes = await readFile(join(SOURCE_DIR, file));

    const upload = await db.storage.from(REFERENCE_IMAGES_BUCKET).upload(path, bytes, { contentType: mimeType, upsert: true });
    if (upload.error) {
      throw upload.error;
    }

    const { error } = await (db as unknown as import('@supabase/supabase-js').SupabaseClient)
      .from('reference_images')
      .upsert({ org_id: null, name: displayName(file), storage_path: path, mime_type: mimeType, sort_order: index }, { onConflict: 'storage_path' });
    if (error) {
      throw error;
    }
    console.log(`ok ${path}`);
  }
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
