import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import type { ProLatest, ProStore } from './pro-library';

const USE_PATH = 'src/lib/server/library/storage-store.ts';
const BUCKET = 'library-pro';

function bucket() {
  const use = SERVICE_ROLE_USES.find((candidate) => candidate.path.startsWith(USE_PATH));
  if (!use) {
    throw new Error('library storage service role use not declared');
  }

  return (createServiceRoleDb(use) as unknown as SupabaseClient).storage.from(BUCKET);
}

async function download(path: string): Promise<string | null> {
  const { data } = await bucket().download(path);

  return data ? data.text() : null;
}

export function storageStore(): ProStore {
  return {
    async latest(id) {
      const text = await download(`${id}/latest.json`);

      return text ? (JSON.parse(text) as ProLatest) : null;
    },
    file(id, version, framework, path) {
      return download(`${id}/${version}/${framework}/${path}`);
    }
  };
}
