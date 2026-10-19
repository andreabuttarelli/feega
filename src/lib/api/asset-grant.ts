import { apiCall } from './client';
import { useAssetGrant } from '$lib/canvas/asset-url';

const GRANT_API = '/api/v1/me/asset-grant';
const REFRESH_LEAD_MS = 5 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const OK = 200;

type Grant = { grant: string; expiresAt: number };

let timer: ReturnType<typeof setTimeout> | null = null;

export async function keepAssetGrant(apiBase: string): Promise<void> {
  if (timer) {
    clearTimeout(timer);
  }
  const { status, body } = await apiCall<Grant>(GRANT_API);
  if (status !== OK) {
    useAssetGrant(null);
    return;
  }

  useAssetGrant({ apiBase, grant: body.grant });
  const refreshIn = Math.max(body.expiresAt - Date.now() - REFRESH_LEAD_MS, RETRY_MS);
  timer = setTimeout(() => void keepAssetGrant(apiBase), refreshIn);
}
