import { env } from '$env/dynamic/private';
import { farmAccess, vercelFarm } from './vercel-farm';
import type { RenderFarm } from './render-farm';

export function motionRenderFarm(source: Record<string, string | undefined> = env): RenderFarm | null {
  const access = farmAccess(source);
  return access ? vercelFarm(access) : null;
}
