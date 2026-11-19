import { appState } from '$lib/cli-client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
};

export type CloudAccount = { email: string; name: string | null };

export type CloudDeps = {
  home: string;
  fetch: typeof fetch;
  cloudUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
  timeoutMs: number;
};

const CLOUD_URL = 'https://oh.feega.app';
const SUPABASE_URL = 'https://klnswzhhgrqvbfjzioul.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4TwkYt0gDk2VeF57n_npzw_cFO5FMyR';
const CONNECT_TIMEOUT_MS = 5 * 60 * 1000;
const EXPIRY_MARGIN_S = 30;
const DEFAULT_TTL_S = 3600;
const LOOPBACK = '127.0.0.1';
const OK = 200;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const BAD_GATEWAY = 502;

export function cloudDeps(env: NodeJS.ProcessEnv = process.env): CloudDeps {
  return {
    home: homedir(),
    fetch: globalThis.fetch,
    cloudUrl: (env.FEEGA_CLOUD_URL || CLOUD_URL).replace(/\/$/, ''),
    supabaseUrl: env.FEEGA_CLOUD_SUPABASE_URL || SUPABASE_URL,
    supabaseKey: env.FEEGA_CLOUD_SUPABASE_KEY || SUPABASE_PUBLISHABLE_KEY,
    timeoutMs: CONNECT_TIMEOUT_MS
  };
}

const sessionFile = (home: string) => join(home, '.config', 'feega', 'session.json');

const nowS = () => Math.floor(Date.now() / 1000);

async function readSession(deps: CloudDeps): Promise<StoredSession | null> {
  try {
    const stored = JSON.parse(await readFile(sessionFile(deps.home), 'utf8')) as StoredSession;
    return stored.refresh_token ? stored : null;
  } catch {
    return null;
  }
}

async function saveSession(deps: CloudDeps, session: StoredSession): Promise<void> {
  const file = sessionFile(deps.home);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(session, null, 2));
}

async function refreshed(deps: CloudDeps, stored: StoredSession): Promise<StoredSession | null> {
  const res = await deps.fetch(`${deps.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: deps.supabaseKey, 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: stored.refresh_token })
  });
  if (!res.ok) {
    return null;
  }

  const body = (await res.json()) as { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email: string } };
  const session = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at ?? nowS() + DEFAULT_TTL_S,
    user: { id: body.user.id, email: body.user.email }
  };
  await saveSession(deps, session);
  return session;
}

async function liveSession(deps: CloudDeps): Promise<StoredSession | null> {
  const stored = await readSession(deps);
  if (!stored) {
    return null;
  }
  if (nowS() < stored.expires_at - EXPIRY_MARGIN_S) {
    return stored;
  }
  return refreshed(deps, stored);
}

export async function cloudCall(path: string, init: RequestInit = {}, deps = cloudDeps()): Promise<Response | null> {
  const session = await liveSession(deps);
  if (!session) {
    return null;
  }

  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${session.access_token}`);
  return deps.fetch(`${deps.cloudUrl}${path}`, { ...init, headers });
}

async function cloudName(deps: CloudDeps): Promise<string | null> {
  try {
    const res = await cloudCall('/api/v1/me/profile', {}, deps);
    if (!res?.ok) {
      return null;
    }
    const body = (await res.json()) as { name?: unknown };
    return typeof body.name === 'string' ? body.name : null;
  } catch {
    return null;
  }
}

export async function account(deps = cloudDeps()): Promise<CloudAccount | null> {
  const stored = await readSession(deps);
  if (!stored) {
    return null;
  }
  return { email: stored.user.email, name: await cloudName(deps) };
}

type Grant = { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email: string } };

export async function signIn(email: string, password: string, deps = cloudDeps()): Promise<{ email: string } | null> {
  const res = await deps.fetch(`${deps.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: deps.supabaseKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    return null;
  }

  const grant = (await res.json()) as Grant;
  await saveSession(deps, {
    access_token: grant.access_token,
    refresh_token: grant.refresh_token,
    expires_at: grant.expires_at ?? nowS() + DEFAULT_TTL_S,
    user: { id: grant.user.id, email: grant.user.email }
  });
  return { email: grant.user.email };
}

type Callback = { access_token: string; refresh_token: string; expires_at?: number; state: string };

async function jsonBody(req: IncomingMessage): Promise<Callback> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Callback;
}

async function callbackUser(deps: CloudDeps, accessToken: string): Promise<{ id: string; email: string } | null> {
  const res = await deps.fetch(`${deps.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: deps.supabaseKey, authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    return null;
  }
  const user = (await res.json()) as { id: string; email: string };
  return { id: user.id, email: user.email };
}

export async function connect(deps = cloudDeps()): Promise<{ url: string }> {
  const state = appState(crypto.randomUUID());
  const cors = {
    'access-control-allow-origin': new URL(deps.cloudUrl).origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type'
  };

  const reply = (res: ServerResponse, status: number) => {
    res.writeHead(status, cors);
    res.end();
  };

  const accept = async (req: IncomingMessage): Promise<number> => {
    const body = await jsonBody(req);
    if (body.state !== state) {
      return BAD_REQUEST;
    }
    const user = await callbackUser(deps, body.access_token);
    if (!user) {
      return BAD_GATEWAY;
    }
    await saveSession(deps, {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: body.expires_at || nowS() + DEFAULT_TTL_S,
      user
    });
    return OK;
  };

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      reply(res, NO_CONTENT);
      return;
    }
    if (req.method !== 'POST' || req.url !== '/session') {
      reply(res, NOT_FOUND);
      return;
    }

    const status = await accept(req).catch(() => BAD_REQUEST);
    reply(res, status);
    if (status === OK) {
      server.close();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, LOOPBACK, () => resolve());
  });

  const timer = setTimeout(() => server.close(), deps.timeoutMs);
  timer.unref();
  server.once('close', () => clearTimeout(timer));

  const port = (server.address() as AddressInfo).port;
  return { url: `${deps.cloudUrl}/login?cli_port=${port}&cli_state=${state}` };
}

const CONFLICT = 409;

export async function forwardPut(path: string, request: Request, deps = cloudDeps()): Promise<Response> {
  const body = await request.text();
  const res = await cloudCall(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body }, deps);
  if (!res) {
    return Response.json({ error: 'not_connected' }, { status: CONFLICT });
  }
  return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
}
