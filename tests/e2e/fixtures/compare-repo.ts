import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const FEATURE_BRANCH = 'feature/cta';

const SERVER = `import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const page = () => readFileSync(new URL('./app/page.tsx', import.meta.url), 'utf8').match(/<main[\\s\\S]*<\\/main>/)[0].replaceAll('className=', 'class=');

createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:system-ui}main{padding:48px 56px;background:#f7f5f0;min-height:720px}nav{display:flex;justify-content:space-between;font-weight:600}.hero{margin-top:96px}h1{font-size:64px;letter-spacing:-0.04em;margin:0}p{font-size:20px;color:#555;max-width:520px}.cta{display:inline-block;margin-top:24px;padding:14px 22px;border-radius:999px;color:#fff;font-weight:600}footer{margin-top:120px;color:#888}</style></head><body>' + page() + '</body></html>');
}).listen(Number(process.env.PORT), process.env.HOST ?? '127.0.0.1');
`;

type Page = { title: string; lead: string; cta: string; ctaColour: string };

const PAGE = (p: Page) => `export default function Page() {
  return (
    <main>
      <nav><span>Lumen</span><span>Pricing  Docs  Sign in</span></nav>
      <section className="hero">
        <h1>${p.title}</h1>
        <p>${p.lead}</p>
        <a className="cta" style="background:${p.ctaColour}">${p.cta}</a>
      </section>
      <footer>Lumen Labs, 2026</footer>
    </main>
  );
}
`;

const FIRST: Page = { title: 'Light for every team', lead: 'Plan, ship and measure your launches in one calm workspace.', cta: 'Start free', ctaColour: '#1f6feb' };

export type CompareRepo = { dir: string; shas: { first: string; second: string; feature: string } };

const git = (dir: string, ...args: string[]) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();

function commit(dir: string, page: Page, message: string): string {
  writeFileSync(join(dir, 'app/page.tsx'), PAGE(page));
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', message);
  return git(dir, 'rev-parse', 'HEAD');
}

export function compareRepo(): CompareRepo {
  const dir = mkdtempSync(join(tmpdir(), 'feega-compare-'));
  mkdirSync(join(dir, 'app'));
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'lumen', private: true, type: 'module', scripts: { dev: 'node server.mjs' }, dependencies: { next: '15.0.0' } }, null, 2));
  writeFileSync(join(dir, 'server.mjs'), SERVER);
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'ada@lumen.dev');
  git(dir, 'config', 'user.name', 'Ada Lovelace');

  const first = commit(dir, FIRST, 'Lumen landing');
  git(dir, 'checkout', '-qb', FEATURE_BRANCH);
  const feature = commit(dir, { ...FIRST, cta: 'Book a demo', ctaColour: '#e5484d' }, 'Make the call to action a demo');
  git(dir, 'checkout', '-q', 'main');
  const second = commit(dir, { ...FIRST, lead: 'Plan, ship and measure every launch in one calm place.' }, 'Tighten the lead');
  return { dir, shas: { first, second, feature } };
}
