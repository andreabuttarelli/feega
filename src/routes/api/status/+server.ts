import { json } from '@sveltejs/kit';
import { createAdminClient } from '$lib/server/supabase-admin';
import type { RequestHandler } from './$types';

interface ServiceCheck {
  name: string;
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}

async function timed(name: string, fn: () => Promise<void>): Promise<ServiceCheck> {
  const start = performance.now();
  try {
    await fn();
    return { name, status: 'ok', latencyMs: Math.round(performance.now() - start) };
  } catch (e) {
    return {
      name,
      status: 'error',
      latencyMs: Math.round(performance.now() - start),
      error: e instanceof Error ? e.message : String(e)
    };
  }
}

// Service names are deliberately generic (role, not vendor): this endpoint and /status are public,
// and which provider sits behind each role is not something we advertise.
async function checkSupabase(): Promise<ServiceCheck> {
  return timed('database', async () => {
    const client = createAdminClient();
    const { error } = await client.from('orgs').select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
  });
}

export const GET: RequestHandler = async ({ url }) => {
  const origin = url.origin;
  const endpointChecks = [
    timed('api:version', async () => {
      const res = await fetch(`${origin}/api/v1/version`, { method: 'GET', signal: AbortSignal.timeout(10_000) });
      if (res.status >= 500) throw new Error(`Returned ${res.status}`);
    }),
  ];

  const services = await Promise.all([checkSupabase(), ...endpointChecks]);
  const errorCount = services.filter((s) => s.status === 'error').length;
  const status = errorCount === 0 ? 'ok' : errorCount >= 2 ? 'critical' : 'degraded';

  return json(
    {
      status,
      timestamp: new Date().toISOString(),
      services
    },
    { status: errorCount >= 2 ? 503 : 200 }
  );
};
