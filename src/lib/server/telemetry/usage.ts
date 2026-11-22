import { z } from 'zod';

export const MAX_EVENTS = 50;
export const MAX_BODY_BYTES = 16 * 1024;
const QUOTA_PER_WINDOW = 30;
const WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 5_000;
const MAX_TEXT = 64;
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EDITS = 1_000_000;

const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const PAYLOAD_TOO_LARGE = 413;
const TOO_MANY_REQUESTS = 429;

const EVENTS = ['session_start', 'edit', 'session_end'] as const;
const EDITORS = ['vscode', 'cursor', 'windsurf', 'vscodium', 'npx'] as const;
const DEVICES = ['desktop', 'web', 'cli'] as const;

const text = z.string().min(1).max(MAX_TEXT);

const eventSchema = z.object({
  event: z.enum(EVENTS),
  install_id: z.uuid(),
  session_id: z.uuid(),
  ext_version: text,
  editor: z.enum(EDITORS),
  os: text,
  arch: text,
  device: z.enum(DEVICES),
  edit_count: z.number().int().min(0).max(MAX_EDITS).optional(),
  duration_ms: z.number().int().min(0).max(MAX_DURATION_MS).optional()
});

const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(MAX_EVENTS) });

export type UsageRow = Omit<z.infer<typeof eventSchema>, 'edit_count' | 'duration_ms'> & {
  edit_count: number | null;
  duration_ms: number | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

export type UsageSink = (rows: UsageRow[]) => Promise<unknown>;

type Window = { startedAt: number; count: number };

const windows = new Map<string, Window>();

function overQuota(client: string, now: number): boolean {
  const current = windows.get(client);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    if (windows.size >= MAX_TRACKED_CLIENTS) {
      windows.clear();
    }
    windows.set(client, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > QUOTA_PER_WINDOW;
}

function decoded(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value).slice(0, MAX_TEXT);
  } catch {
    return null;
  }
}

function locationOf(headers: Headers) {
  return {
    country: decoded(headers.get('x-vercel-ip-country')),
    region: decoded(headers.get('x-vercel-ip-country-region')),
    city: decoded(headers.get('x-vercel-ip-city'))
  };
}

async function parseBody(request: Request): Promise<unknown | typeof PAYLOAD_TOO_LARGE | typeof BAD_REQUEST> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return PAYLOAD_TOO_LARGE;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return BAD_REQUEST;
  }
}

export async function handleUsage(request: Request, client: string, sink: UsageSink, now = Date.now()): Promise<Response> {
  if (overQuota(client, now)) {
    return new Response(null, { status: TOO_MANY_REQUESTS });
  }

  const body = await parseBody(request);
  if (body === PAYLOAD_TOO_LARGE || body === BAD_REQUEST) {
    return new Response(null, { status: body as number });
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(null, { status: BAD_REQUEST });
  }

  const location = locationOf(request.headers);
  const rows: UsageRow[] = parsed.data.events.map((e) => ({ ...e, edit_count: e.edit_count ?? null, duration_ms: e.duration_ms ?? null, ...location }));

  try {
    await sink(rows);
  } catch (e) {
    console.warn('[usage] not recorded', e);
  }

  return new Response(null, { status: NO_CONTENT });
}
