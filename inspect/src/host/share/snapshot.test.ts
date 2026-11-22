import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { snapshotOf } from './snapshot';

const PAGE = `<!doctype html><html><head><title>t</title><link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="http://other.invalid/skip.css"><link rel="stylesheet" href="/missing.css"><script type="module" src="/__feega/bridge.js"></script><script>boot()</script><style>p{margin:0}</style></head><body><h1>hi</h1><script src="/app.js"></script></body></html>`;

let closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((close) => close()));

async function app() {
  const server = createServer((request, response) => {
    const bodies: Record<string, [string, string]> = { '/': ['text/html', PAGE], '/a.css': ['text/css', 'h1{color:red}'] };
    const hit = bodies[request.url ?? ''];
    hit ? response.writeHead(200, { 'content-type': hit[0] }).end(hit[1]) : response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  closers.push(() => server.close());
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

function unzip(bytes: Uint8Array, name: string) {
  const file = join(mkdtempSync(join(tmpdir(), 'feega-snap-')), 'snap.zip');
  writeFileSync(file, bytes);
  return execFileSync('unzip', ['-p', file, name]).toString();
}

describe('snapshotOf', () => {
  it('bundles the page and its stylesheets without scripts', async () => {
    const zip = (await snapshotOf(await app(), fetch))!;

    const html = unzip(zip, 'index.html');
    expect(html).toContain('<h1>hi</h1>');
    expect(html).toContain('<style>p{margin:0}</style>');
    expect(html).not.toMatch(/<script/);
    expect(html).toContain('href="styles/0.css"');
    expect(unzip(zip, 'styles/0.css')).toBe('h1{color:red}');
  });

  it('leaves the stylesheets it cannot fetch where they were', async () => {
    const html = unzip((await snapshotOf(await app(), fetch))!, 'index.html');

    expect(html).toContain('href="http://other.invalid/skip.css"');
    expect(html).toContain('href="/missing.css"');
  });

  it('gives nothing when the app does not answer', async () => {
    expect(await snapshotOf('http://127.0.0.1:1/', fetch)).toBeNull();
    expect(await snapshotOf(null, fetch)).toBeNull();
  });
});
