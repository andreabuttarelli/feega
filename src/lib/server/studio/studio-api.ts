import { json } from '@sveltejs/kit';
import { bearerEvent, bearerOf } from '$lib/server/api/bearer-page';
import { toolScope, type ToolScope } from '$lib/server/dashboard/tool-scope';
import { studioOptions } from './studio-options';
import { quoteSelection, selectionSchema, type Quote, type Selection } from './studio-batch';

export const HTTP_BAD_REQUEST = 400;
export const HTTP_CONFLICT = 409;
export const HTTP_UNPROCESSABLE = 422;

export type StudioRequest = { scope: ToolScope; selection: Selection; quote: Quote; body: Record<string, unknown> };

export async function studioRequest(request: Request, url: URL): Promise<StudioRequest | Response> {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = selectionSchema.safeParse(body?.selection);
  if (!body || !parsed.success) {
    return json({ error: 'invalid_selection' }, { status: HTTP_BAD_REQUEST });
  }

  const scope = await toolScope(bearerEvent(bearer, request, url, '/app/studio') as never);
  const quote = quoteSelection(parsed.data, await studioOptions(scope.db, scope));
  if ('error' in quote) {
    return json({ error: quote.error }, { status: HTTP_UNPROCESSABLE });
  }
  return { scope, selection: parsed.data, quote, body };
}

