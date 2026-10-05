import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';
import { uploadLimit } from '$lib/server/storage-limit';
import { farmAccess, vercelFarm } from './vercel-farm';
import type { RenderFarm } from './render-farm';
import type { RenderStorage } from './render-run';

export function motionRenderFarm(source: Record<string, string | undefined> = env): RenderFarm | null {
  const access = farmAccess(source);
  return access ? vercelFarm(access) : null;
}

export function motionRenderStorage(): RenderStorage {
  const url = publicEnv.PUBLIC_SUPABASE_URL ?? '';
  return { host: new URL(url).host, limit: () => uploadLimit({ url, apiKey: publicEnv.PUBLIC_SUPABASE_ANON_KEY ?? '', bucket: CANVAS_ASSET_BUCKET }) };
}
