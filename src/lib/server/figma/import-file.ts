import type { ProviderCall, ProviderCaller } from '$lib/server/connections/account-links';
import { FIGMA_API, FILE_KEY, FigmaOutcome, HTTP_OK, failedOutcome } from './import-images';
import type { RestNode } from './rest-message';

export const MAX_FRAMES = 20;

const NODE_ID = /^[0-9]+:[0-9]+$/;
const HTTP_NOT_FOUND = 404;
const FRAME_TYPES = new Set(['FRAME', 'SECTION', 'COMPONENT', 'COMPONENT_SET']);

export type FrameListing = { id: string; name: string; page: string; width: number; height: number };

type Box = { width: number; height: number };
type Listed = { id: string; name: string; type: string; absoluteBoundingBox?: Box };
type Page = { name: string; children?: Listed[] };

type Refused = { outcome: Exclude<FigmaOutcome, FigmaOutcome.Ok> };

const refused = (outcome: Refused['outcome']): Refused => ({ outcome });

const FAILURE: Record<number, Refused['outcome']> = { [HTTP_NOT_FOUND]: FigmaOutcome.NotFound };

const failureOf = (status: number): Refused => refused(FAILURE[status] ?? failedOutcome(status));

async function ask(call: ProviderCaller, request: ProviderCall): Promise<{ body: unknown } | Refused> {
  const res = await call(request);
  return res.status === HTTP_OK ? { body: res.data ?? {} } : failureOf(res.status);
}

export async function listFigmaFrames(input: { fileKey: string }, call: ProviderCaller): Promise<Refused | { outcome: FigmaOutcome.Ok; frames: FrameListing[] }> {
  if (!FILE_KEY.test(input.fileKey)) {
    return refused(FigmaOutcome.Invalid);
  }

  const got = await ask(call, { endpoint: `${FIGMA_API}/files/${input.fileKey}`, query: { depth: '2' } });
  if ('outcome' in got) {
    return got;
  }

  const pages = ((got.body as { document?: { children?: Page[] } }).document?.children ?? []) as Page[];
  const frames = pages.flatMap((page) =>
    (page.children ?? [])
      .filter((c) => FRAME_TYPES.has(c.type))
      .map((c) => ({ id: c.id, name: c.name, page: page.name, width: Math.round(c.absoluteBoundingBox?.width ?? 0), height: Math.round(c.absoluteBoundingBox?.height ?? 0) }))
  );
  return { outcome: FigmaOutcome.Ok, frames };
}

export async function fetchFigmaFrames(input: { fileKey: string; nodeIds: string[] }, call: ProviderCaller): Promise<Refused | { outcome: FigmaOutcome.Ok; frames: RestNode[] }> {
  const valid = FILE_KEY.test(input.fileKey) && input.nodeIds.length > 0 && input.nodeIds.length <= MAX_FRAMES && input.nodeIds.every((id) => NODE_ID.test(id));
  if (!valid) {
    return refused(FigmaOutcome.Invalid);
  }

  const got = await ask(call, { endpoint: `${FIGMA_API}/files/${input.fileKey}/nodes`, query: { ids: input.nodeIds.join(','), geometry: 'paths' } });
  if ('outcome' in got) {
    return got;
  }

  const nodes = (got.body as { nodes?: Record<string, { document?: RestNode } | null> }).nodes ?? {};
  return { outcome: FigmaOutcome.Ok, frames: input.nodeIds.flatMap((id) => nodes[id]?.document ?? []) };
}
