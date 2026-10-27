import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { appDir, bundleSource, cachedVersions, isCached, latestAppVersion, markCached, parseArgs, pickVersion } from './launcher.mjs';

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

  it('porta 5173 di default, --port nelle due forme', () => {
    expect(parseArgs([], '/').port).toBe(5173);
    expect(parseArgs(['--port=8080'], '/').port).toBe(8080);
    expect(parseArgs(['--port', '9000', 'b.feega'], '/h')).toMatchObject({ port: 9000, file: '/h/b.feega' });
  });

  it('--no-open non apre il browser', () => {
    expect(parseArgs([], '/').browser).toBe('open');
    expect(parseArgs(['--no-open'], '/').browser).toBe('skip');
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
