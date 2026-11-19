import type { ProviderCaller } from '$lib/server/connections/account-links';

export const FIGMA_API = 'https://api.figma.com/v1';
export const FILE_KEY = /^[A-Za-z0-9_-]{6,64}$/;
const IMAGE_HASH = /^[0-9a-f]{8,64}$/;
const HTTP_UNREACHED = 0;
const HTTP_SERVER_ERROR = 500;
export const HTTP_OK = 200;

export const MAX_HASHES = 40;

export enum FigmaOutcome {
  Ok = 'ok',
  Invalid = 'invalid',
  Rejected = 'token_rejected',
  NotFound = 'not_found',
  Unavailable = 'unavailable',
  NoToken = 'no_token',
  BadLink = 'bad_link',
  NoFrames = 'no_frames',
  Unreadable = 'unreadable',
  RateLimited = 'rate_limited'
}

export const FIGMA_STATUS: Record<Exclude<FigmaOutcome, FigmaOutcome.Ok>, number> = {
  [FigmaOutcome.Invalid]: 400,
  [FigmaOutcome.BadLink]: 400,
  [FigmaOutcome.NoFrames]: 400,
  [FigmaOutcome.Unreadable]: 422,
  [FigmaOutcome.Rejected]: 422,
  [FigmaOutcome.NotFound]: 404,
  [FigmaOutcome.NoToken]: 409,
  [FigmaOutcome.RateLimited]: 429,
  [FigmaOutcome.Unavailable]: 502
};

export type ImportDeps = { call: ProviderCaller; importUrl: (url: string) => Promise<string | null> };
export type ImportAsk = { fileKey: string; hashes: string[] };
export type ImportResult = { outcome: FigmaOutcome; assets: Record<string, string> };

export const failedOutcome = (status: number) => (status === HTTP_UNREACHED || status >= HTTP_SERVER_ERROR ? FigmaOutcome.Unavailable : FigmaOutcome.Rejected);

const refused = (outcome: FigmaOutcome): ImportResult => ({ outcome, assets: {} });

export async function importFigmaImages(ask: ImportAsk, deps: ImportDeps): Promise<ImportResult> {
  if (!FILE_KEY.test(ask.fileKey) || ask.hashes.length > MAX_HASHES || !ask.hashes.every((h) => IMAGE_HASH.test(h))) {
    return refused(FigmaOutcome.Invalid);
  }

  const res = await deps.call({ endpoint: `${FIGMA_API}/files/${ask.fileKey}/images` });
  if (res.status !== HTTP_OK) {
    return refused(failedOutcome(res.status));
  }

  const urls = (res.data as { meta?: { images?: Record<string, string> } } | null)?.meta?.images ?? {};
  const stored = await Promise.all(
    ask.hashes.map(async (hash) => {
      const url = urls[hash];
      const assetId = url ? await deps.importUrl(url).catch(() => null) : null;
      return assetId ? ([hash, assetId] as const) : null;
    })
  );

  return { outcome: FigmaOutcome.Ok, assets: Object.fromEntries(stored.filter((s) => s !== null)) };
}
