import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { Switch } from '$lib/canvas/gpu/renderer-flag';

const FLAG = 'canvas-force-dom';
const CORE_OFF_FLAG = 'canvas-core-off';
const FLAGS_URL = 'https://eu.i.posthog.com/flags?v=2';
const DISTINCT_ID = 'canvas-renderer-switch';
const CACHE_MS = 60_000;
const TIMEOUT_MS = 800;
const FORCED = '1';

type Deps = { forceDom: string | undefined; coreOff: string | undefined; posthogKey: string | undefined; fetch: typeof fetch; now: () => number };

async function flagsOn(deps: Deps): Promise<Record<string, { enabled?: boolean }>> {
  if (!deps.posthogKey) {
    return {};
  }
  try {
    const res = await deps.fetch(FLAGS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: deps.posthogKey, distinct_id: DISTINCT_ID }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const body = (await res.json()) as { flags?: Record<string, { enabled?: boolean }> };
    return body.flags ?? {};
  } catch {
    return {};
  }
}

export function createRendererSwitch(deps: Deps): () => Promise<Switch> {
  let cached: { at: number; value: Switch } | null = null;
  return async () => {
    if (deps.forceDom === FORCED) {
      return Switch.ForceDom;
    }
    if (cached && deps.now() - cached.at < CACHE_MS) {
      return cached.value;
    }
    const on = await flagsOn(deps);
    const value = on[FLAG]?.enabled ? Switch.ForceDom : on[CORE_OFF_FLAG]?.enabled || deps.coreOff === FORCED ? Switch.CoreOff : Switch.Open;
    cached = { at: deps.now(), value };
    return value;
  };
}

let shared: (() => Promise<Switch>) | null = null;

export function rendererSwitch(): Promise<Switch> {
  shared ??= createRendererSwitch({ forceDom: env.CANVAS_FORCE_DOM, coreOff: env.CANVAS_CORE_OFF, posthogKey: publicEnv.PUBLIC_POSTHOG_KEY, fetch, now: Date.now });
  return shared();
}
