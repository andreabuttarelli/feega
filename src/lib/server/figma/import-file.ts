import { FIGMA_API, FILE_KEY, FigmaOutcome, HTTP_OK, TOKEN_HEADER, type FetchFn } from './import-images';
import type { RestNode } from './rest-message';

export const MAX_FRAMES = 20;

const NODE_ID = /^[0-9]+:[0-9]+$/;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;
const FRAME_TYPES = new Set(['FRAME', 'SECTION', 'COMPONENT', 'COMPONENT_SET']);

export type FrameListing = { id: string; name: string; page: string; width: number; height: number };

type Box = { width: number; height: number };
type Listed = { id: string; name: string; type: string; absoluteBoundingBox?: Box };
type Page = { name: string; children?: Listed[] };

type Refused = { outcome: Exclude<FigmaOutcome, FigmaOutcome.Ok> };

const refused = (outcome: Refused['outcome']): Refused => ({ outcome });

const FAILURE: Record<number, Refused['outcome']> = { [HTTP_NOT_FOUND]: FigmaOutcome.NotFound };

const failureOf = (status: number): Refused => refused(FAILURE[status] ?? (status >= HTTP_SERVER_ERROR ? FigmaOutcome.Unavailable : FigmaOutcome.Rejected));

async function ask(fetchFn: FetchFn, url: string, token: string): Promise<{ body: unknown } | Refused> {
  const res = await fetchFn(url, { headers: { [TOKEN_HEADER]: token } }).catch(() => null);
  if (!res) {
    return refused(FigmaOutcome.Unavailable);
  }
  if (res.status !== HTTP_OK) {
    return failureOf(res.status);
  }
  return { body: await res.json().catch(() => ({})) };
}

export async function listFigmaFrames(input: { token: string; fileKey: string }, fetchFn: FetchFn): Promise<Refused | { outcome: FigmaOutcome.Ok; frames: FrameListing[] }> {
  if (!FILE_KEY.test(input.fileKey)) {
    return refused(FigmaOutcome.Invalid);
  }

  const got = await ask(fetchFn, `${FIGMA_API}/files/${input.fileKey}?depth=2`, input.token);
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

export async function fetchFigmaFrames(input: { token: string; fileKey: string; nodeIds: string[] }, fetchFn: FetchFn): Promise<Refused | { outcome: FigmaOutcome.Ok; frames: RestNode[] }> {
  const valid = FILE_KEY.test(input.fileKey) && input.nodeIds.length > 0 && input.nodeIds.length <= MAX_FRAMES && input.nodeIds.every((id) => NODE_ID.test(id));
  if (!valid) {
    return refused(FigmaOutcome.Invalid);
  }

  const ids = encodeURIComponent(input.nodeIds.join(','));
  const got = await ask(fetchFn, `${FIGMA_API}/files/${input.fileKey}/nodes?ids=${ids}&geometry=paths`, input.token);
  if ('outcome' in got) {
    return got;
  }

  const nodes = (got.body as { nodes?: Record<string, { document?: RestNode } | null> }).nodes ?? {};
  return { outcome: FigmaOutcome.Ok, frames: input.nodeIds.flatMap((id) => nodes[id]?.document ?? []) };
}
