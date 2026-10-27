import { ConnectionError } from '../connection-messages';
import type { ImageAssets } from './images';

const HTTP_NO_TOKEN = 409;

export enum ImagesOutcome {
  Filled = 'filled',
  NoToken = 'no_token',
  Failed = 'failed'
}

type Ask = { projectId: string; fileKey: string; hashes: string[] };
export type ImagesAnswer = { outcome: ImagesOutcome; error: ConnectionError | null; assets: ImageAssets };

const SERVER_ERRORS = new Set<string>([ConnectionError.TokenRejected, ConnectionError.RateLimited, ConnectionError.Unavailable, ConnectionError.Invalid]);

export async function figmaImageAssets(ask: Ask, fetchFn: typeof fetch = fetch): Promise<ImagesAnswer> {
  const res = await fetchFn(`/api/v1/projects/${ask.projectId}/figma-images`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileKey: ask.fileKey, hashes: [...new Set(ask.hashes)] })
  }).catch(() => null);

  if (res?.status === HTTP_NO_TOKEN) {
    return { outcome: ImagesOutcome.NoToken, error: ConnectionError.NoToken, assets: {} };
  }
  if (!res) {
    return { outcome: ImagesOutcome.Failed, error: ConnectionError.Unavailable, assets: {} };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const error = body.error && SERVER_ERRORS.has(body.error) ? (body.error as ConnectionError) : ConnectionError.Unavailable;
    return { outcome: ImagesOutcome.Failed, error, assets: {} };
  }
  const body = (await res.json().catch(() => ({}))) as { assets?: ImageAssets };
  return { outcome: ImagesOutcome.Filled, error: null, assets: body.assets ?? {} };
}
