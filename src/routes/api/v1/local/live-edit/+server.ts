import { error, json } from '@sveltejs/kit';
import { localStore } from '$lib/server/local/local-mode';
import { devFolder } from '$lib/server/dev-server/local-dev-server';
import { liveChanges, liveEdit, liveUndo, type LiveEditAsk } from '$lib/server/live-edit/live-edit';
import { LiveProp, Side } from '$lib/canvas/live-fields';
import type { RequestHandler } from './$types';

const NOT_FOUND = 404;
const BAD_REQUEST = 400;
const CONFLICT = 409;

const PROPS = new Set<string>(Object.values(LiveProp));
const SIDES = new Set<string>(Object.values(Side));

function liveRoot(): string {
  const store = localStore();
  if (!store) {
    error(NOT_FOUND, 'Live edits run only in local mode');
  }
  return devFolder(store);
}

type Body = { family?: unknown; at?: unknown; prop?: unknown; value?: unknown; token?: unknown; side?: unknown; was?: unknown; rem?: unknown; viewport?: unknown; undo?: unknown };

const positive = (v: unknown) => (typeof v === 'number' && v > 0 ? v : undefined);

const text = (v: unknown) => (typeof v === 'string' ? v : undefined);

function askOf(body: Body): LiveEditAsk {
  if (typeof body.at !== 'string' || !PROPS.has(String(body.prop))) {
    error(BAD_REQUEST, `at must be file:line:col and prop one of ${[...PROPS].join(', ')}`);
  }
  if (body.side !== undefined && !SIDES.has(String(body.side))) {
    error(BAD_REQUEST, `side must be one of ${[...SIDES].join(', ')}`);
  }
  if (text(body.value) === undefined && text(body.token) === undefined) {
    error(BAD_REQUEST, 'value or token is required');
  }
  return { at: body.at, prop: body.prop as LiveProp, family: text(body.family), value: text(body.value), token: text(body.token), side: body.side as Side | undefined, was: text(body.was), rem: positive(body.rem), viewport: positive(body.viewport) };
}

export const GET: RequestHandler = async () => json(await liveChanges(liveRoot()));

export const POST: RequestHandler = async ({ request }) => {
  const root = liveRoot();
  const body = (await request.json()) as Body;
  const out = typeof body.undo === 'string' ? await liveUndo(root, body.undo) : await liveEdit(root, askOf(body));
  if (!out.ok) {
    error(CONFLICT, out.reason);
  }
  return json(out);
};
