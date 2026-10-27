const FIGMA_API = 'https://api.figma.com/v1';
const TOKEN_HEADER = 'X-Figma-Token';
const FILE_KEY = /^[A-Za-z0-9_-]{6,64}$/;
const IMAGE_HASH = /^[0-9a-f]{8,64}$/;
const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const MISSING_SCOPE = /scope/i;

export const MAX_HASHES = 40;

export enum FigmaOutcome {
  Ok = 'ok',
  Invalid = 'invalid',
  Rejected = 'token_rejected',
  Unavailable = 'unavailable'
}

type FetchFn = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

export type ImportDeps = { fetchFn: FetchFn; importUrl: (url: string) => Promise<string | null> };
export type ImportAsk = { token: string; fileKey: string; hashes: string[] };
export type ImportResult = { outcome: FigmaOutcome; assets: Record<string, string> };

const asked = (token: string) => ({ headers: { [TOKEN_HEADER]: token } });

export async function figmaMe(fetchFn: FetchFn, token: string): Promise<{ ok: true; handle: string | null } | { ok: false }> {
  const res = await fetchFn(`${FIGMA_API}/me`, asked(token)).catch(() => null);
  const body = (await res?.json().catch(() => ({}))) as { handle?: string; err?: string } | undefined;
  if (res?.status === HTTP_OK) {
    return { ok: true, handle: body?.handle ?? '' };
  }
  return res?.status === HTTP_FORBIDDEN && MISSING_SCOPE.test(body?.err ?? '') ? { ok: true, handle: null } : { ok: false };
}

const refused = (outcome: FigmaOutcome): ImportResult => ({ outcome, assets: {} });

export async function importFigmaImages(ask: ImportAsk, deps: ImportDeps): Promise<ImportResult> {
  if (!FILE_KEY.test(ask.fileKey) || ask.hashes.length > MAX_HASHES || !ask.hashes.every((h) => IMAGE_HASH.test(h))) {
    return refused(FigmaOutcome.Invalid);
  }

  const res = await deps.fetchFn(`${FIGMA_API}/files/${ask.fileKey}/images`, asked(ask.token)).catch(() => null);
  if (!res) {
    return refused(FigmaOutcome.Unavailable);
  }
  if (res.status !== HTTP_OK) {
    return refused(res.status >= 500 ? FigmaOutcome.Unavailable : FigmaOutcome.Rejected);
  }

  const body = (await res.json().catch(() => ({}))) as { meta?: { images?: Record<string, string> } };
  const urls = body.meta?.images ?? {};
  const stored = await Promise.all(
    ask.hashes.map(async (hash) => {
      const url = urls[hash];
      const assetId = url ? await deps.importUrl(url).catch(() => null) : null;
      return assetId ? ([hash, assetId] as const) : null;
    })
  );

  return { outcome: FigmaOutcome.Ok, assets: Object.fromEntries(stored.filter((s) => s !== null)) };
}
