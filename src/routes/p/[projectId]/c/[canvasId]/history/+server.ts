import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { historyScope } from '$lib/server/canvas/history-scope';
import { readHistory } from '$lib/server/canvas/history';
import { HistoryFilter, isHistoryFilter } from '$lib/canvas/history/timeline';

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const scope = await historyScope(locals, params);
  const author = url.searchParams.get('author') ?? '';
  const filter = isHistoryFilter(author) ? author : HistoryFilter.All;
  return json(await readHistory(scope.db, { orgId: scope.orgId, canvasId: scope.canvasId, filter, frameId: url.searchParams.get('frame') }));
};
