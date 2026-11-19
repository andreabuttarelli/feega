import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createServer } from 'node:net';
import { FolderImport, ImportStep, appDir, readyProbe, served, boundUrl, freePort, bundleSource, cachedVersions, exitOf, folderApp, importAsk, discoverAsk, routePlan, importReport, importStep, isCached, latestAppVersion, markCached, mcpEnv, parseArgs, pickVersion, placeOf, untilReady, warmStart, newerRelease, depsDir, installAtomic, extract, loadingServer, compileCache } from './launcher.mjs';

const tarball = () => {
  const src = mkdtempSync(join(tmpdir(), 'feega-src-'));
  writeFileSync(join(src, 'package.json'), '{}');
  const archive = join(mkdtempSync(join(tmpdir(), 'feega-tgz-')), 'b.tar.gz');
  spawnSync('tar', ['-czf', archive, '-C', src, '.']);
  return archive;
};

const listening = async (handler) => {
  const server = createHttpServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/b.tar.gz` };
};

describe('partenza a caldo', () => {
  it('con una versione in cache parte subito da quella, senza chiedere alla rete', () => {
    expect(warmStart(['0.1.36', '0.1.35'])).toEqual({ version: '0.1.36', action: 'cache' });
  });

  it('senza cache deve chiedere alla rete', () => {
    expect(warmStart([])).toEqual({ action: 'check' });
  });

  it('scarica per la prossima volta solo una release più nuova di quella in cache', () => {
    expect(newerRelease('0.1.37', ['0.1.36'])).toBe('0.1.37');
    expect(newerRelease('0.1.36', ['0.1.36'])).toBeNull();
    expect(newerRelease('0.1.35', ['0.1.36'])).toBeNull();
    expect(newerRelease(null, ['0.1.36'])).toBeNull();
  });
});

describe('compileCache', () => {
  it('il server riusa il codice già compilato da V8 tra un avvio e l’altro, sotto ~/.feega', () => {
    expect(compileCache('/h', {})).toEqual({ NODE_COMPILE_CACHE: '/h/.feega/compile-cache' });
  });

  it('una cache scelta da chi lancia vince', () => {
    expect(compileCache('/h', { NODE_COMPILE_CACHE: '/x' })).toEqual({ NODE_COMPILE_CACHE: '/x' });
  });
});

describe('dipendenze condivise', () => {
  it('due versioni con lo stesso lockfile condividono la cartella delle dipendenze, un lockfile diverso no', () => {
    expect(depsDir('/h', '{"a":1}')).toBe(depsDir('/h', '{"a":1}'));
    expect(depsDir('/h', '{"a":1}')).not.toBe(depsDir('/h', '{"a":2}'));
    expect(depsDir('/h', '{"a":1}').startsWith('/h/.feega/deps/')).toBe(true);
  });
});

describe('installAtomic', () => {
  it('la cartella compare solo completa, con il marcatore', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'feega-')), '1.0.0');
    await installAtomic(target, async (tmp) => writeFileSync(join(tmp, 'x'), 'y'));
    expect(isCached(target)).toBe(true);
    expect(existsSync(join(target, 'x'))).toBe(true);
  });

  it('un lavoro fallito non lascia né la cartella né quella temporanea', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-'));
    const boom = async () => {
      throw new Error('boom');
    };
    await expect(installAtomic(join(root, '1.0.0'), boom)).rejects.toThrow('boom');
    expect(readdirSync(root)).toEqual([]);
  });

  it('una cartella a metà lasciata da un launcher vecchio interrotto viene sostituita', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'feega-')), '1.0.0');
    mkdirSync(target);
    writeFileSync(join(target, 'partial'), '');
    await installAtomic(target, async (tmp) => writeFileSync(join(tmp, 'x'), 'y'));
    expect(isCached(target)).toBe(true);
    expect(readdirSync(target).sort()).toEqual(['.complete', 'x']);
  });

  it('due installazioni in parallelo della stessa versione: vince una, l’altra non rompe niente', async () => {
    const target = join(mkdtempSync(join(tmpdir(), 'feega-')), '1.0.0');
    const slow = (tmp) => new Promise((done) => setTimeout(() => done(writeFileSync(join(tmp, 'x'), tmp)), 5));
    await Promise.all([installAtomic(target, slow), installAtomic(target, slow)]);
    expect(isCached(target)).toBe(true);
    expect(readdirSync(dirname(target))).toEqual(['1.0.0']);
  });
});

describe('extract', () => {
  it('estrae il bundle mentre arriva dalla rete, senza file intermedio', async () => {
    const archive = tarball();
    const { server, url } = await listening((_, res) => createReadStream(archive).pipe(res));
    const out = mkdtempSync(join(tmpdir(), 'feega-out-'));

    await extract(url, out);
    server.close();
    expect(existsSync(join(out, 'package.json'))).toBe(true);
  });

  it('un percorso locale si estrae uguale', async () => {
    const out = mkdtempSync(join(tmpdir(), 'feega-out-'));
    await extract(tarball(), out);
    expect(existsSync(join(out, 'package.json'))).toBe(true);
  });

  it('un download che fallisce lo dice', async () => {
    const { server, url } = await listening((_, res) => res.writeHead(404).end());
    await expect(extract(url, mkdtempSync(join(tmpdir(), 'feega-out-')))).rejects.toThrow(/download failed \(404\)/);
    server.close();
  });
});

describe('pagina di attesa', () => {
  const status = (loading) => fetch(new URL('/status', loading.url)).then((r) => r.json());

  it('il browser si apre subito su una pagina del launcher, che segue i passi e passa all’app appena risponde', async () => {
    const loading = await loadingServer();
    expect(await fetch(loading.url).then((r) => r.text())).toMatch(/feega/);
    expect(await status(loading)).toEqual({ step: 'start' });

    loading.set({ step: 'download' });
    expect(await status(loading)).toEqual({ step: 'download' });

    loading.set({ url: 'http://127.0.0.1:1234' });
    expect(await status(loading)).toEqual({ url: 'http://127.0.0.1:1234' });
    loading.close();
  });
});

describe('untilReady', () => {
  it('fails loudly when the server exits before it serves', async () => {
    await expect(untilReady(async () => false, Promise.resolve(0), 1)).rejects.toThrow('the app server exited (code 0) before it started');
  });

  it('resolves once the probe answers', async () => {
    let calls = 0;
    await expect(untilReady(async () => ++calls > 2, new Promise(() => {}), 1)).resolves.toBeUndefined();
  });
});

describe('mcp', () => {
  it('mcp avvia il server MCP sulla porta 5173 di default', () => {
    expect(parseArgs(['mcp'], '/')).toEqual({ command: 'mcp', port: 5173 });
  });

  it('mcp --port punta a un altro server locale', () => {
    expect(parseArgs(['mcp', '--port', '61234'], '/').port).toBe(61234);
    expect(parseArgs(['mcp', '--port=8080'], '/').port).toBe(8080);
  });

  it('mcp rifiuta opzioni che non conosce', () => {
    expect(() => parseArgs(['mcp', '--no-open'], '/')).toThrow(/unknown option/);
  });

  it('il server MCP parla con il server locale sul loopback', () => {
    expect(mcpEnv(61234, { HOME: '/h' })).toEqual({ HOME: '/h', PUBLIC_APP_URL: 'http://127.0.0.1:61234' });
  });
});

describe('parseArgs', () => {
  it('risolve il file contro la cartella di chi lancia, non quella del pacchetto', () => {
    expect(parseArgs(['work/a.feega'], '/home/u').file).toBe('/home/u/work/a.feega');
  });

  it('senza file usa canvas.feega nella cartella corrente', () => {
    expect(parseArgs([], '/home/u').file).toBe('/home/u/canvas.feega');
  });

  it('tiene un percorso assoluto così com’è', () => {
    expect(parseArgs(['/tmp/x.feega'], '/home/u').file).toBe('/tmp/x.feega');
  });

  it('porta 0 di default, scelta dal sistema, --port nelle due forme', () => {
    expect(parseArgs([], '/').port).toBe(0);
    expect(parseArgs(['--port=8080'], '/').port).toBe(8080);
    expect(parseArgs(['--port', '9000', 'b.feega'], '/h')).toMatchObject({ port: 9000, file: '/h/b.feega' });
  });

  it('--no-open non apre il browser', () => {
    expect(parseArgs([], '/').browser).toBe('open');
    expect(parseArgs(['--no-open'], '/').browser).toBe('skip');
  });

  it('--help, -h e --version non diventano un file', () => {
    expect(parseArgs(['--help'], '/').command).toBe('help');
    expect(parseArgs(['-h'], '/').command).toBe('help');
    expect(parseArgs(['--version'], '/').command).toBe('version');
  });

  it('rifiuta ogni altra opzione che inizia con un trattino', () => {
    expect(() => parseArgs(['--hepl'], '/')).toThrow(/unknown option/);
    expect(() => parseArgs(['-x'], '/')).toThrow(/unknown option/);
  });

  it('rifiuta una porta che non è un numero', () => {
    expect(() => parseArgs(['--port=abc'], '/')).toThrow(/port/);
  });
});

describe('cache', () => {
  it('una versione ha la sua cartella sotto ~/.feega/app', () => {
    expect(appDir('/home/u', '1.2.3')).toBe('/home/u/.feega/app/1.2.3');
  });

  it('una cartella senza marcatore non è in cache: un download interrotto si rifà', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'feega-')), '1.0.0');
    expect(isCached(dir)).toBe(false);

    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'partial'), '');
    expect(isCached(dir)).toBe(false);

    markCached(dir);
    expect(isCached(dir)).toBe(true);
  });

  it('una versione nuova non trova la cache della vecchia', () => {
    const home = mkdtempSync(join(tmpdir(), 'feega-'));
    markCached(appDir(home, '1.0.0'));
    expect(isCached(appDir(home, '1.0.1'))).toBe(false);
  });
});

describe('bundleSource', () => {
  it('scarica dalla release app-v<versione>', () => {
    expect(bundleSource('1.2.3', {})).toBe(
      'https://github.com/andreabuttarelli/feega/releases/download/app-v1.2.3/feega-app.tar.gz'
    );
  });

  it('FEEGA_APP_BUNDLE sostituisce la release, per provare senza pubblicare', () => {
    expect(bundleSource('1.2.3', { FEEGA_APP_BUNDLE: '/tmp/b.tar.gz' })).toBe('/tmp/b.tar.gz');
  });
});

describe('latestAppVersion', () => {
  it('prende la release app-v più recente, saltando quelle della CLI e le bozze', () => {
    const releases = [
      { tag_name: 'cli-v2.0.0' },
      { tag_name: 'app-v0.1.9', draft: true },
      { tag_name: 'app-v0.1.4' },
      { tag_name: 'app-v0.1.10' }
    ];
    expect(latestAppVersion(releases)).toBe('0.1.10');
  });

  it('nessuna release app: null', () => {
    expect(latestAppVersion([{ tag_name: 'cli-v1.0.0' }])).toBeNull();
  });
});

describe('cachedVersions', () => {
  it('elenca solo le versioni complete, dalla più nuova', () => {
    const home = mkdtempSync(join(tmpdir(), 'feega-'));
    markCached(appDir(home, '0.1.2'));
    markCached(appDir(home, '0.1.10'));
    mkdirSync(appDir(home, '0.2.0'), { recursive: true });
    expect(cachedVersions(home)).toEqual(['0.1.10', '0.1.2']);
  });

  it('senza cartella di cache: lista vuota', () => {
    expect(cachedVersions(mkdtempSync(join(tmpdir(), 'feega-')))).toEqual([]);
  });
});

describe('pickVersion', () => {
  it('una release più nuova della cache si scarica', () => {
    expect(pickVersion('0.1.3', ['0.1.2'])).toEqual({ version: '0.1.3', action: 'download' });
  });

  it('la release già in cache parte dalla cache', () => {
    expect(pickVersion('0.1.3', ['0.1.3', '0.1.2'])).toEqual({ version: '0.1.3', action: 'cache' });
  });

  it('offline usa la versione in cache più nuova', () => {
    expect(pickVersion(null, ['0.1.3', '0.1.2'])).toEqual({ version: '0.1.3', action: 'cache' });
  });

  it('offline e senza cache non può partire', () => {
    expect(() => pickVersion(null, [])).toThrow(/offline/);
  });
});

describe('freePort', () => {
  it("l'URL aperto è l'indirizzo su cui il server si lega, anche con 5173 occupata su ::1", async () => {
    const taken = createServer();
    await new Promise((r) => taken.listen(5173, '::1', r).on('error', r));
    const port = await freePort(0);
    const server = createServer();
    await new Promise((r) => server.listen(port, '127.0.0.1', r));
    const { address, port: bound } = server.address();

    expect(boundUrl(port)).toBe(`http://${address}:${bound}`);
    server.close();
    taken.close();
  });
});

describe('import della cartella', () => {
  const app = (scripts) => {
    const dir = mkdtempSync(join(tmpdir(), 'feega-app-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'my-app', scripts }));
    return dir;
  };

  it('di default chiede, --import importa senza chiedere, --no-import salta', () => {
    expect(parseArgs([], '/').folderImport).toBe(FolderImport.Ask);
    expect(parseArgs(['--import'], '/').folderImport).toBe(FolderImport.Yes);
    expect(parseArgs(['--no-import'], '/').folderImport).toBe(FolderImport.No);
  });

  it('una cartella con uno script dev è un progetto da importare', () => {
    const dir = app({ dev: 'vite' });
    expect(folderApp(dir)).toBe(dir);
  });

  it('senza script dev o senza package.json non c’è niente da importare', () => {
    expect(folderApp(app({ build: 'vite build' }))).toBeNull();
    expect(folderApp(mkdtempSync(join(tmpdir(), 'feega-empty-')))).toBeNull();
  });

  it('chiede solo la prima volta, in un terminale, dentro un progetto', () => {
    const fresh = { mode: FolderImport.Ask, app: '/a', fileExists: false, tty: true };
    expect(importStep(fresh)).toBe(ImportStep.Ask);
    expect(importStep({ ...fresh, fileExists: true })).toBe(ImportStep.Skip);
    expect(importStep({ ...fresh, tty: false })).toBe(ImportStep.Skip);
    expect(importStep({ ...fresh, app: null })).toBe(ImportStep.Skip);
  });

  it('--import importa anche senza terminale e su un file esistente; --no-import mai', () => {
    const forced = { mode: FolderImport.Yes, app: '/a', fileExists: true, tty: false };
    expect(importStep(forced)).toBe(ImportStep.Import);
    expect(importStep({ ...forced, app: null })).toBe(ImportStep.NoApp);
    expect(importStep({ ...forced, mode: FolderImport.No })).toBe(ImportStep.Skip);
  });

  it('legge progetto e tela dal redirect della home locale', () => {
    expect(placeOf('/p/proj-1/c/canvas-2')).toEqual({ projectId: 'proj-1', canvasId: 'canvas-2' });
    expect(placeOf('http://127.0.0.1:5173/p/a/c/b')).toEqual({ projectId: 'a', canvasId: 'b' });
    expect(placeOf('/login')).toBeNull();
  });

  it('importa le rotte scelte della cartella nella tela locale', () => {
    expect(importAsk({ projectId: 'a', canvasId: 'b' }, '/code/my-app', { routes: ['/', '/about'] })).toEqual({
      path: '/api/v1/projects/a/code-import',
      body: { canvasId: 'b', folder: '/code/my-app', routes: ['/', '/about'], x: 0, y: 0 }
    });
  });

  it('porta l’app scelta in un monorepo, nella scoperta e nell’import', () => {
    expect(importAsk({ projectId: 'a', canvasId: 'b' }, '/m', { routes: ['/'], app: 'apps/web' }).body.app).toBe('apps/web');
    expect(discoverAsk({ projectId: 'a' }, '/m', 'apps/web')).toBe('/api/v1/projects/a/code-import/routes?folder=%2Fm&app=apps%2Fweb');
    expect(discoverAsk({ projectId: 'a' }, '/m')).toBe('/api/v1/projects/a/code-import/routes?folder=%2Fm');
  });

  it('--routes e --app, nelle due forme', () => {
    expect(parseArgs(['--routes', 'all', '--app', 'apps/web'], '/')).toMatchObject({ routes: 'all', app: 'apps/web' });
    expect(parseArgs(['--routes=/,/about', '--app=x'], '/')).toMatchObject({ routes: ['/', '/about'], app: 'x' });
    expect(parseArgs([], '/')).toMatchObject({ routes: undefined, app: undefined });
  });

  it('--routes senza valore è un errore', () => {
    expect(() => parseArgs(['--routes'], '/')).toThrow(/--routes/);
    expect(() => parseArgs(['--app'], '/')).toThrow(/--app/);
  });
});

describe('routePlan', () => {
  const found = (routes, max = 20) => ({ ok: true, max, routes });
  const page = (path, kind = 'static') => ({ path, kind, selected: kind === 'static' });

  it('senza --routes importa tutte le statiche e lascia fuori le dinamiche dicendo perché', () => {
    const plan = routePlan(found([page('/'), page('/about'), page('/blog/[slug]', 'dynamic')]), undefined);
    expect(plan).toEqual({ routes: ['/', '/about'], leftOut: [{ path: '/blog/[slug]', reason: 'needs a value' }], fallback: false });
  });

  it('oltre il tetto importa le prime e riporta le altre', () => {
    const plan = routePlan(found([page('/a'), page('/b'), page('/c')], 2), 'all');
    expect(plan.routes).toEqual(['/a', '/b']);
    expect(plan.leftOut).toEqual([{ path: '/c', reason: 'over the 2-page limit' }]);
  });

  it('una lista esplicita passa così com’è, anche con valori per le dinamiche', () => {
    const plan = routePlan(found([page('/'), page('/blog/[slug]', 'dynamic')]), ['/blog/hello']);
    expect(plan).toEqual({ routes: ['/blog/hello'], leftOut: [], fallback: false });
  });

  it('senza router trovato ricade sulla sola home', () => {
    expect(routePlan({ ok: false }, undefined)).toEqual({ routes: ['/'], leftOut: [], fallback: true });
    expect(routePlan({ ok: false }, ['/x']).routes).toEqual(['/x']);
  });
});

describe('importReport', () => {
  it('conta le pagine importate e quelle che servono di un valore', () => {
    const plan = { routes: ['/', '/about'], leftOut: [{ path: '/blog/[slug]', reason: 'needs a value' }, { path: '/c', reason: 'over the 20-page limit' }], fallback: false };
    const report = importReport(plan, { pages: ['/', '/about'], routes: { leftOut: [{ path: '/x', reason: 'not_opened' }] } });
    expect(report.imported).toEqual(['/', '/about']);
    expect(report.needsValue).toBe(1);
    expect(report.leftOut).toEqual([
      { path: '/blog/[slug]', reason: 'needs a value' },
      { path: '/c', reason: 'over the 20-page limit' },
      { path: '/x', reason: 'did not open' }
    ]);
    expect(report.lines).toEqual(['feega: imported 2 pages: /, /about', 'feega: left out 3: /blog/[slug] (needs a value), /c (over the 20-page limit), /x (did not open)']);
  });

  it('una pagina sola e niente di escluso', () => {
    const report = importReport({ routes: ['/'], leftOut: [], fallback: true }, { pages: ['/'] });
    expect(report.lines).toEqual(['feega: imported 1 page: /']);
  });
});

describe('server pronto', () => {
  it('sonda la home senza seguire il redirect: la pagina della tela ha header troppo grandi per fetch', () => {
    expect(readyProbe).toEqual({ redirect: 'manual' });
  });

  it('il redirect della home e una pagina servita contano come pronto, un errore no', () => {
    expect(served(303)).toBe(true);
    expect(served(200)).toBe(true);
    expect(served(502)).toBe(false);
  });
});

describe('exitOf', () => {
  it('un server ucciso da un segnale lo dice e non esce con 0, così chi lo lancia non lo scambia per una chiusura voluta', () => {
    expect(exitOf(null, 'SIGTERM')).toEqual({ code: 1, line: 'feega: the app server was stopped by SIGTERM' });
  });

  it('un codice di uscita passa com è', () => {
    expect(exitOf(0, null)).toEqual({ code: 0, line: null });
    expect(exitOf(3, null)).toEqual({ code: 3, line: 'feega: the app server exited with code 3' });
  });
});

