import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toolScope } from '$lib/server/dashboard/tool-scope';
import { listBatches } from '$lib/server/repos/product-batches';

export const GET: RequestHandler = async (event) => {
  const { db, orgId, projectId } = await toolScope(event);
  const batches = await listBatches(db, { orgId, projectId });
  return json(batches.map((b) => ({ id: b.id, name: b.name, status: b.status })));
};
