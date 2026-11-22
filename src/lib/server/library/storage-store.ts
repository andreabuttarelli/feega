import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { IndexEntry, ItemFile, LibraryStore } from './library';

const USE_PATH = 'src/lib/server/library/storage-store.ts';
const BUCKET = 'library-pro';
const INDEX_PATH = 'index.json';

function client(): SupabaseClient {
  const use = SERVICE_ROLE_USES.find((candidate) => candidate.path.startsWith(USE_PATH));
  if (!use) {
    throw new Error('library storage service role use not declared');
  }

  return createServiceRoleDb(use) as unknown as SupabaseClient;
}

async function readJson<T>(path: string): Promise<T | null> {
  const { data } = await client().storage.from(BUCKET).download(path);
  if (!data) {
    return null;
  }

  return JSON.parse(await data.text()) as T;
}

export function storageStore(): LibraryStore {
  return {
    async index() {
      return (await readJson<IndexEntry[]>(INDEX_PATH)) ?? [];
    },
    async files(id, framework) {
      const item = await readJson<{ files: ItemFile[] }>(`items/${id}/${framework}.json`);

      return item?.files ?? null;
    }
  };
}
