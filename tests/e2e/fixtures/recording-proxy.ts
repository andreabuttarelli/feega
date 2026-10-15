import { createServer, type Server } from 'node:http';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const RECORDING_PROXY_PORT = 4497;
export const RECORDING_PROXY_URL = `http://localhost:${RECORDING_PROXY_PORT}`;
export const PROVIDER_LOG = 'tests/e2e/.paid/provider-requests.jsonl';

const UPSTREAM = 'https://openrouter.ai/api/v1';
const DROPPED_HEADERS = new Set(['host', 'connection', 'content-length', 'accept-encoding']);
const DROPPED_RESPONSE_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection']);

export type RecordedRequest = { at: string; method: string; path: string; body: unknown };

export type RecordingProxy = { url: string; close: () => Promise<void> };

function bodyOf(raw: Buffer): unknown {
  if (!raw.length) {
    return null;
  }
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return `<${raw.length} bytes>`;
  }
}

function forwardedHeaders(headers: NodeJS.Dict<string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (DROPPED_HEADERS.has(name) || value === undefined) {
      continue;
    }
    out[name] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}

export async function startRecordingProxy(): Promise<RecordingProxy> {
  mkdirSync(dirname(PROVIDER_LOG), { recursive: true });
  writeFileSync(PROVIDER_LOG, '');

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks);
      const path = req.url ?? '/';
      const entry: RecordedRequest = { at: new Date().toISOString(), method: req.method ?? 'GET', path, body: bodyOf(raw) };
      appendFileSync(PROVIDER_LOG, `${JSON.stringify(entry)}\n`);

      try {
        const upstream = await fetch(`${UPSTREAM}${path}`, {
          method: req.method,
          headers: forwardedHeaders(req.headers),
          body: raw.length ? raw : undefined
        });
        const headers: Record<string, string> = {};
        upstream.headers.forEach((value, name) => {
          if (!DROPPED_RESPONSE_HEADERS.has(name)) {
            headers[name] = value;
          }
        });
        res.writeHead(upstream.status, headers);
        res.end(Buffer.from(await upstream.arrayBuffer()));
      } catch (error) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `recording proxy: ${String(error)}` } }));
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(RECORDING_PROXY_PORT, resolve));
  return {
    url: RECORDING_PROXY_URL,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}
