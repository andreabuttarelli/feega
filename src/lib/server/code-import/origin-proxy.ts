export const ORIGIN_PROXY = String.raw`
const http = require('http');
const net = require('net');
const [listen, target] = process.argv.slice(2).map(Number);
const local = 'localhost:' + target;
const own = (url) => String(url).replace(/^https?:\/\/[^/]+/, 'http://' + local);
const rewritten = (headers) => {
  const out = { ...headers, host: local };
  if (out.origin && out.origin !== 'null') out.origin = 'http://' + local;
  if (out.referer) out.referer = own(out.referer);
  return out;
};
const server = http.createServer((req, res) => {
  const upstream = http.request({ host: '127.0.0.1', port: target, method: req.method, path: req.url, headers: rewritten(req.headers) }, (answer) => {
    res.writeHead(answer.statusCode || 502, answer.headers);
    answer.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(upstream);
});
server.on('upgrade', (req, socket, head) => {
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
