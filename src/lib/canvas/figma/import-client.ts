const HTTP_NO_TOKEN = 409;
const UNAVAILABLE = 'unavailable';

export enum FigmaAsk {
  Done = 'done',
  NoToken = 'no_token',
  Refused = 'refused'
}

export type FigmaFrame = { id: string; name: string; page: string; width: number; height: number };

type Refusal = { ask: FigmaAsk.NoToken } | { ask: FigmaAsk.Refused; error: string };
type Point = { x: number; y: number };

const post = (path: string, body: unknown, fetchFn: typeof fetch) =>
  fetchFn(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);

async function refusal(res: Response | null): Promise<Refusal> {
  if (res?.status === HTTP_NO_TOKEN) {
    return { ask: FigmaAsk.NoToken };
  }
  const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
  return { ask: FigmaAsk.Refused, error: body?.error ?? UNAVAILABLE };
}

export async function findFrames(ask: { projectId: string; url: string }, fetchFn: typeof fetch = fetch): Promise<Refusal | { ask: FigmaAsk.Done; frames: FigmaFrame[]; selected: string | null }> {
  const res = await post(`/api/v1/projects/${ask.projectId}/figma/frames`, { url: ask.url }, fetchFn);
  if (!res?.ok) {
    return refusal(res);
  }
  const body = (await res.json()) as { frames: FigmaFrame[]; selected: string | null };
  return { ask: FigmaAsk.Done, frames: body.frames, selected: body.selected };
}

export async function importFrames(
  ask: { projectId: string; canvasId: string; url: string; frameIds: string[]; at: Point },
  fetchFn: typeof fetch = fetch
): Promise<Refusal | { ask: FigmaAsk.Done; nodes: unknown[]; undo: unknown[]; skipped: string[] }> {
  const res = await post(`/api/v1/projects/${ask.projectId}/figma/import`, { canvasId: ask.canvasId, url: ask.url, frameIds: ask.frameIds, x: ask.at.x, y: ask.at.y }, fetchFn);
  if (!res?.ok) {
    return refusal(res);
  }
  const body = (await res.json()) as { nodes: unknown[]; undo: unknown[]; skipped: string[] };
  return { ask: FigmaAsk.Done, ...body };
}
