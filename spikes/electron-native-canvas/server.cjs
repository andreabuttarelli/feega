// ponytail: tiny static server so Chrome (web baseline) and Electron load the same page and files.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const BENCH = process.env.NATIVE_BENCH || '/private/tmp/claude-501/-Users-andreabuttarelli-Documents-GitHub-feega/18e16770-79c3-4b9b-94f4-32331c0bf042/scratchpad/native-bench';
const UI = path.join(__dirname, 'ui');
const WASM = process.env.GPU_CORE_WASM || path.join(__dirname, 'gpu-core-wasm');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg', '.css': 'text/css' };

function layers() {
  const scene = JSON.parse(fs.readFileSync(path.join(BENCH, 'scene.json'), 'utf8'));
  const sizes = Object.fromEntries(Object.entries(scene.groups).map(([k, g]) => [k, [g.width, g.height, g.items.length]]));
  return scene.uses.filter((u) => !u.group.includes('_s')).map((u) => ({ name: u.group, x: u.matrix[4], y: u.matrix[5], w: sizes[u.group][0], h: sizes[u.group][1], items: sizes[u.group][2] }));
}

function start(port = 0) {
  let cachedLayers = null;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/result') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        fs.mkdirSync(path.join(BENCH, 'electron'), { recursive: true });
        fs.writeFileSync(path.join(BENCH, 'electron', `result-${url.searchParams.get('name')}.json`), body);
        res.end('ok');
      });
      return;
    }
    if (url.pathname === '/layers.json') {
      cachedLayers ??= JSON.stringify(layers());
      res.setHeader('content-type', 'application/json');
      return res.end(cachedLayers);
    }
    const file = url.pathname.startsWith('/bench/') ? path.join(BENCH, url.pathname.slice(7)) : url.pathname.startsWith('/gpu-core/') ? path.join(WASM, url.pathname.slice(10)) : path.join(UI, url.pathname === '/' ? 'index.html' : url.pathname);
    fs.readFile(file, (err, data) => {
      if (err) {
        res.statusCode = 404;
        return res.end();
      }
      res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
      res.end(data);
    });
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({ server, port: server.address().port, bench: BENCH })));
}

module.exports = { start, BENCH };
if (require.main === module) {
  start(Number(process.env.PORT || 5199)).then(({ port }) => console.log(`http://127.0.0.1:${port}/?mode=web`));
}
