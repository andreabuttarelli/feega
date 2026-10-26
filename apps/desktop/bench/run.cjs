const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DESKTOP = path.join(__dirname, '..');
const BUILD = path.join(__dirname, '.build');
const SAMPLE_MS = 500;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg' };

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const mode = option('mode') ?? 'native';
const sceneDir = option('scene') ?? process.env.SCENE_DIR;
const label = option('label') ?? mode;

if (!sceneDir) {
  console.error('usage: node bench/run.cjs --scene=<dir with scene.json and images> [--mode=native|web] [--label=name]');
  process.exit(1);
}

const stubVirtual = {
  name: 'stub-virtual',
  setup(build) {
    build.onResolve({ filter: /^virtual:/ }, (args) => ({ path: args.path, namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default {};', loader: 'js' }));
  }
};

function bundle() {
  const esbuild = require(path.join(ROOT, 'node_modules', 'esbuild'));
  return esbuild.build({ entryPoints: [path.join(__dirname, 'entry.ts')], bundle: true, format: 'esm', outfile: path.join(BUILD, 'engine.js'), logLevel: 'warning', plugins: [stubVirtual] });
}

function tree(rootPid) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,%cpu=']).toString().trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  const kids = new Map();
  rows.forEach(([pid, ppid]) => kids.set(ppid, [...(kids.get(ppid) ?? []), pid]));
  const members = new Set([rootPid]);
  [...members].forEach((pid) => (kids.get(pid) ?? []).forEach((k) => members.add(k)));
  const mine = rows.filter(([pid]) => members.has(pid));
  return { rssMB: mine.reduce((a, r) => a + r[2], 0) / 1024, cpu: mine.reduce((a, r) => a + r[3], 0) };
}

function serve(onResult, onMark) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/result') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        onResult(JSON.parse(body));
        res.end('ok');
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/shot') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        fs.writeFileSync(path.join(option('shots'), `${url.searchParams.get('name')}.png`), Buffer.concat(chunks));
        res.end('ok');
      });
      return;
    }
    if (url.pathname === '/mark') {
      onMark(url.searchParams.get('name'), url.searchParams.get('what'));
      return res.end('ok');
    }
    const file = url.pathname === '/' ? path.join(__dirname, 'index.html')
      : url.pathname === '/bench.js' ? path.join(__dirname, 'bench.js')
      : url.pathname === '/engine.js' ? path.join(BUILD, 'engine.js')
      : url.pathname.startsWith('/scene/') ? path.join(sceneDir, url.pathname.slice(7))
      : url.pathname.startsWith('/gpu-core/') ? path.join(ROOT, 'static', url.pathname.slice(1))
      : null;
    fs.readFile(file ?? '', (err, data) => {
      if (err) {
        res.statusCode = 404;
        return res.end();
      }
      res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
      res.end(data);
    });
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function main() {
  await bundle();
  const marks = [];
  const samples = [];
  let result = null;
  const server = await serve((r) => (result = r), (name, what) => marks.push({ name, what, t: Date.now() }));
  const electron = process.env.ELECTRON_BIN ?? require(path.join(DESKTOP, 'node_modules', 'electron'));
  const env = { ...process.env, FEEGA_URL: `http://127.0.0.1:${server.address().port}/?label=${label}${option('shots') ? `&shots=${option('shots')}` : ''}` };
  if (mode === 'native') {
    env.FEEGA_NATIVE_CANVAS = '1';
    env.FEEGA_NATIVE_DEBUG = '1';
  } else {
    delete env.FEEGA_NATIVE_CANVAS;
  }
  const profile = `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), 'feega-bench-'))}`;
  const uncapped = flag('uncapped') ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [];
  if (flag('uncapped')) {
    env.FEEGA_NATIVE_UNCAPPED = '1';
  }
  const child = spawn(electron, [DESKTOP, profile, ...uncapped], { env, stdio: flag('verbose') ? 'inherit' : 'ignore' });
  const sampler = setInterval(() => samples.push({ t: Date.now(), ...tree(child.pid) }), SAMPLE_MS);

  while (!result) {
    await new Promise((ok) => setTimeout(ok, 500));
    if (child.exitCode !== null) {
      break;
    }
  }
  clearInterval(sampler);
  child.kill();
  server.close();
  if (!result) {
    console.error('the app exited before reporting');
    process.exit(1);
  }

  for (const phase of result.phases) {
    const start = marks.find((m) => m.name === phase.name && m.what === 'start')?.t ?? 0;
    const end = marks.find((m) => m.name === phase.name && m.what === 'end')?.t ?? Infinity;
    const inside = samples.filter((s) => s.t >= start && s.t <= end);
    const avg = (key) => +(inside.reduce((a, s) => a + s[key], 0) / Math.max(1, inside.length)).toFixed(1);
    Object.assign(phase, { cpuPct: avg('cpu'), rssMB: avg('rssMB') });
  }
  fs.mkdirSync(path.join(BUILD, 'results'), { recursive: true });
  fs.writeFileSync(path.join(BUILD, 'results', `${label}.json`), JSON.stringify(result, null, 2));
  if (!result.phases.length) {
    return;
  }
  console.log(`${label} (${result.mode}) viewport ${result.viewport.join('x')} first frame ${Math.round(result.firstFrameMs)} ms`);
  console.table(result.phases);
}

main();
