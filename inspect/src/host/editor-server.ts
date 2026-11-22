import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage } from 'node:http';
import { join } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { SOCKET_PATH, type HostMessage, type ViewMessage } from '../messages';
import type { Transport } from './platform';
import { FeegaServer, feegaHeaders } from './feega-server';
import { panelHtml, type PanelTheme } from './panel-html';

const HOST = '127.0.0.1';
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const ASSETS: Record<string, string> = { '/panel.js': 'text/javascript', '/panel.css': 'text/css' };

const DARK: PanelTheme = {
  bodyClass: 'vscode-dark',
  variables: {
    '--vscode-editor-background': '#1e1e1e',
    '--vscode-sideBar-background': '#181818',
    '--vscode-foreground': '#cccccc',
    '--vscode-panel-border': '#2b2b2b',
    '--vscode-font-family': 'system-ui, -apple-system, sans-serif'
  }
};

export type EditorServer = { url: string; transport: Transport; close: () => Promise<void> };

const ownOrigin = (port: number) => (request: IncomingMessage) => [`http://${HOST}:${port}`, `http://localhost:${port}`].includes(request.headers.origin ?? '');

export async function editorServer(webview: string, port: number): Promise<EditorServer> {
  const sockets = new Set<WebSocket>();
  const handlers: ((message: HostMessage) => unknown)[] = [];

  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://x').pathname;
    const type = ASSETS[path];
    if (type) {
      response.writeHead(HTTP_OK, { 'content-type': type, 'cache-control': 'no-store', ...feegaHeaders(FeegaServer.Editor) });
      response.end(await readFile(join(webview, path)));
      return;
    }
    if (path !== '/') {
      response.writeHead(HTTP_NOT_FOUND, feegaHeaders(FeegaServer.Editor)).end();
      return;
    }
    const html = panelHtml({ script: '/panel.js', style: '/panel.css', cspSource: "'self'", nonce: randomBytes(16).toString('base64'), theme: DARK });
    response.writeHead(HTTP_OK, { 'content-type': 'text/html; charset=utf-8', ...feegaHeaders(FeegaServer.Editor) }).end(html);
  });

  await new Promise<void>((resolve, reject) => server.once('error', reject).listen(port, HOST, resolve));
  const bound = (server.address() as { port: number }).port;
  const allowed = ownOrigin(bound);

  const wss = new WebSocketServer({ server, path: SOCKET_PATH, verifyClient: ({ req }: { req: IncomingMessage }) => allowed(req) });
  wss.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('message', (data) => handlers.forEach((handle) => handle(JSON.parse(String(data)) as HostMessage)));
  });

  const transport: Transport = {
    send: (message: ViewMessage) => sockets.forEach((socket) => socket.send(JSON.stringify(message))),
    receive: (handle) => void handlers.push(handle)
  };

  const close = () =>
    new Promise<void>((resolve) => {
      sockets.forEach((socket) => socket.terminate());
      wss.close();
      server.close(() => resolve());
      server.closeAllConnections();
    });

  return { url: `http://${HOST}:${bound}/`, transport, close };
}
