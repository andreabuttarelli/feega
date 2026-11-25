import { readFile } from 'node:fs/promises';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { connect } from 'node:net';
import { join } from 'node:path';
import bridgeFiles from './bridge-files.json';
import { FeegaServer, feegaHeaders } from './feega-server';

export const BRIDGE_PATH = '/__feega/';

const HOST = '127.0.0.1';
const HTML = /text\/html/;
const BRIDGE_FILES = new Set<string>(bridgeFiles);
const SCRIPT = `<script type="module" src="${BRIDGE_PATH}bridge.js"></script>`;
const DROPPED = ['content-length', 'content-encoding', 'transfer-encoding'];

export function withBridge(html: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${SCRIPT}</head>`);
  }
  return html.replace(/<body([^>]*)>/, `<body$1>${SCRIPT}`);
}

const bridgeFileOf = (url: string | undefined): string | null => {
  const name = url?.startsWith(BRIDGE_PATH) ? url.slice(BRIDGE_PATH.length).split('?')[0] : '';
  return BRIDGE_FILES.has(name) ? name : null;
};

async function serveBridge(dir: string, name: string, res: ServerResponse) {
  const body = await readFile(join(dir, name)).catch(() => null);
  if (!body) {
    res.writeHead(404, feegaHeaders(FeegaServer.Proxy)).end();
    return;
  }
  res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store', ...feegaHeaders(FeegaServer.Proxy) }).end(body);
}

function forward(target: URL, req: IncomingMessage, res: ServerResponse) {
  const headers = { ...req.headers, host: target.host, 'accept-encoding': 'identity' };
  const upstream = request({ host: target.hostname, port: target.port, path: req.url, method: req.method, headers }, (reply) => {
    if (!HTML.test(String(reply.headers['content-type'] ?? ''))) {
      res.writeHead(reply.statusCode ?? 502, { ...reply.headers, ...feegaHeaders(FeegaServer.Proxy) });
      reply.pipe(res);
      return;
    }
    const chunks: Buffer[] = [];
    reply.on('data', (c: Buffer) => chunks.push(c));
    reply.on('end', () => {
      const headers = { ...Object.fromEntries(Object.entries(reply.headers).filter(([k]) => !DROPPED.includes(k))), ...feegaHeaders(FeegaServer.Proxy) };
      res.writeHead(reply.statusCode ?? 200, headers).end(withBridge(Buffer.concat(chunks).toString('utf8')));
    });
  });
  upstream.on('error', () => res.writeHead(502, feegaHeaders(FeegaServer.Proxy)).end());
  req.pipe(upstream);
}

export async function devProxy(targetUrl: string, bridgeDir: string): Promise<{ url: string; close: () => void }> {
  const target = new URL(targetUrl);
  const server = createServer((req, res) => {
    const bridgeFile = bridgeFileOf(req.url);
    if (bridgeFile) {
      serveBridge(bridgeDir, bridgeFile, res);
      return;
    }
    forward(target, req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    const upstream = connect(Number(target.port), target.hostname, () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`, ...Object.entries(req.headers).map(([k, v]) => `${k}: ${k === 'host' ? target.host : v}`)];
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });

  await new Promise<void>((resolve) => server.listen(0, HOST, resolve));
  const { port } = server.address() as { port: number };
  return { url: `http://${HOST}:${port}/`, close: () => (server.closeAllConnections(), server.close()) };
}
