import type { ImageAssets } from './images';

const HTTP_NO_TOKEN = 409;

export enum ImagesOutcome {
  Filled = 'filled',
  NoToken = 'no_token',
  Failed = 'failed'
}

type Ask = { projectId: string; fileKey: string; hashes: string[] };
type Answer = { outcome: ImagesOutcome; assets: ImageAssets };

export async function figmaImageAssets(ask: Ask, fetchFn: typeof fetch = fetch): Promise<Answer> {
  const res = await fetchFn(`/api/v1/projects/${ask.projectId}/figma-images`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fileKey: ask.fileKey, hashes: [...new Set(ask.hashes)] })
  }).catch(() => null);

  if (res?.status === HTTP_NO_TOKEN) {
    return { outcome: ImagesOutcome.NoToken, assets: {} };
  }
  if (!res?.ok) {
    return { outcome: ImagesOutcome.Failed, assets: {} };
  }
  const body = (await res.json().catch(() => ({}))) as { assets?: ImageAssets };
  return { outcome: ImagesOutcome.Filled, assets: body.assets ?? {} };
}
