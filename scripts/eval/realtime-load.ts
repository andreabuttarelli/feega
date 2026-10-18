import { randomUUID } from 'node:crypto';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../_shims/env-private';
import { Plan, budgetOf, fitsPlan } from '$lib/realtime/broadcast-budget';

const EVENT = 'tick';
const JOIN_TIMEOUT_MS = 15_000;
const DRAIN_MS = 2_000;
const MS_PER_SECOND = 1000;

const arg = (name: string, fallback: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const peers = arg('peers', 10);
const hz = arg('hz', 20);
const seconds = arg('seconds', 20);

const email = env.E2E_TEST_EMAIL;
const password = env.E2E_TEST_PASSWORD;
if (!email || !password) {
  throw new Error('realtime load test runs as the test account: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const topic = `loadtest:${randomUUID()}`;
const latencies: number[] = [];
const statuses: string[] = [];
let received = 0;

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? NaN;
}

async function join(client: SupabaseClient, index: number): Promise<RealtimeChannel> {
  const channel = client.channel(topic, { config: { broadcast: { self: false, ack: false } } });
  channel.on('broadcast', { event: EVENT }, ({ payload }) => {
    received += 1;
    latencies.push(Date.now() - (payload as { at: number }).at);
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`peer ${index} join timeout`)), JOIN_TIMEOUT_MS);
    channel.subscribe((status) => {
      statuses.push(status);
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return channel;
}

const login = createClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, options);
const { data, error } = await login.auth.signInWithPassword({ email, password });
if (error || !data.session) {
  throw new Error(`test account sign-in failed: ${error?.message ?? 'no session'}`);
}

const clients = Array.from({ length: peers }, () => createClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, options));
try {
  for (const client of clients) {
    await client.realtime.setAuth(data.session.access_token);
  }
  const channels = await Promise.all(clients.map(join));

  let sent = 0;
  let refused = 0;
  const started = Date.now();
  const timers = channels.map((channel) => setInterval(() => {
    sent += 1;
    void channel.send({ type: 'broadcast', event: EVENT, payload: { at: Date.now(), x: Math.random(), y: Math.random() } })
      .then((result) => { if (result !== 'ok') { refused += 1; } });
  }, MS_PER_SECOND / hz));
  await new Promise((resolve) => setTimeout(resolve, seconds * MS_PER_SECOND));
  timers.forEach(clearInterval);
  await new Promise((resolve) => setTimeout(resolve, DRAIN_MS));

  const elapsed = (Date.now() - started - DRAIN_MS) / MS_PER_SECOND;
  const expected = sent * (peers - 1);
  const budget = budgetOf({ peers, hz, draggers: 0, dragHz: 0 });
  console.log(JSON.stringify({
    peers, hz, seconds: elapsed,
    sent, refused, received, expected,
    lossPct: expected ? Number((100 * (1 - received / expected)).toFixed(2)) : 0,
    latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), p99: percentile(latencies, 0.99) },
    budgetPerSecond: budget,
    fits: Object.fromEntries(Object.values(Plan).map((plan) => [plan, fitsPlan(budget, plan)])),
    channelStatuses: [...new Set(statuses)]
  }, null, 2));
} finally {
  await Promise.all(clients.map((client) => client.removeAllChannels()));
}
