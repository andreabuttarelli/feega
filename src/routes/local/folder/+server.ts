import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { Keep } from '@feega/canvas-folder';
import { localStore } from '$lib/server/local/local-mode';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;

const resolution = z.object({
  conflict: z.object({ collection: z.string(), id: z.string(), field: z.string(), base: z.unknown(), ours: z.unknown(), theirs: z.unknown() }),
  keep: z.enum(Keep)
});

function folderStore() {
  const store = localStore();
  if (!store?.folderStatus()) {
    error(NOT_FOUND);
  }

  return store;
}

export const GET = async () => json(folderStore().folderStatus());

export const POST = async ({ request }: { request: Request }) => {
  const store = folderStore();
  const parsed = resolution.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    error(BAD_REQUEST, 'conflict and keep (mine or theirs) are required');
  }

  await store.resolveConflict(parsed.data.conflict, parsed.data.keep);
  return json(store.folderStatus());
};
