import type { SessionCookie } from '$lib/server/web/browser';

export const IMPORT_KEY_COOKIE = 'feega_import_key';

export function importKeyCookie(app: { url: string; key: string }): SessionCookie {
  return { name: IMPORT_KEY_COOKIE, value: app.key, domain: new URL(app.url).hostname, path: '/', expires: -1, httpOnly: true, secure: true };
}

export const ORIGIN_PROXY = String.raw`
const http = require('http');
const net = require('net');
const [listen, target] = process.argv.slice(2, 4).map(Number);
const key = process.argv[4] || '';
const KEY_COOKIE = '${IMPORT_KEY_COOKIE}';
const local = 'localhost:' + target;
const cookiesOf = (header) => String(header || '').split(';').map((c) => c.trim()).filter(Boolean);
const keyed = (req) => key !== '' && cookiesOf(req.headers.cookie).includes(KEY_COOKIE + '=' + key);
const withoutKey = (header) => cookiesOf(header).filter((c) => !c.startsWith(KEY_COOKIE + '=')).join('; ');
const own = (url) => String(url).replace(/^https?:\/\/[^/]+/, 'http://' + local);
const rewritten = (headers) => {
  const out = { ...headers, host: local };
  const cookie = withoutKey(out.cookie);
  if (cookie) out.cookie = cookie; else delete out.cookie;
  if (out.origin && out.origin !== 'null') out.origin = 'http://' + local;
  if (out.referer) out.referer = own(out.referer);
  return out;
};
const server = http.createServer((req, res) => {
  if (!keyed(req)) { res.writeHead(403); res.end(); return; }
  const upstream = http.request({ host: '127.0.0.1', port: target, method: req.method, path: req.url, headers: rewritten(req.headers) }, (answer) => {
    res.writeHead(answer.statusCode || 502, answer.headers);
    answer.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(upstream);
});
server.on('upgrade', (req, socket, head) => {
  if (!keyed(req)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
  const upstream = net.connect(target, '127.0.0.1', () => {
    const lines = Object.entries(rewritten(req.headers)).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v));
    upstream.write(req.method + ' ' + req.url + ' HTTP/1.1\r\n' + lines.join('\r\n') + '\r\n\r\n');
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});
server.listen(listen, '0.0.0.0');
`;
