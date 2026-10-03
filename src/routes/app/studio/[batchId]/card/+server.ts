import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { batchScope } from '$lib/server/dashboard/tool-scope';
import { studioBatchCard } from '$lib/server/studio/studio-card';

export const GET: RequestHandler = async (event) => {
  const { db, batch } = await batchScope(event);
  return json(await studioBatchCard(db, batch));
};
