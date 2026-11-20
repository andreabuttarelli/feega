import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { Launch } from './dev-server';
import { Verdict, verdictOf } from './candidate';
import { FEEGA_SERVER_HEADER } from './feega-server';
import { n } from './test-paths';

const servers: Server[] = [];

async function serve(handler: (url: string) => { status: number; headers?: Record<string, string>; body?: string }): Promise<string> {
  const server = createServer((req, res) => {
    const reply = handler(req.url ?? '/');
    res.writeHead(reply.status, { 'content-type': 'text/html', ...reply.headers }).end(reply.body ?? '');
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
}

afterEach(() => servers.splice(0).forEach((s) => s.close()));

describe('verdictOf', () => {
  it('rifiuta il server dell editor di Feega', async () => {
    const url = await serve(() => ({ status: 200, headers: { [FEEGA_SERVER_HEADER]: 'editor' } }));
    expect(await verdictOf(url, n('/w/app'), Launch.Vite)).toBe(Verdict.FeegaServer);
  });

  it('rifiuta il proxy di un altra istanza di Feega', async () => {
    const url = await serve(() => ({ status: 200, headers: { [FEEGA_SERVER_HEADER]: 'proxy' } }));
    expect(await verdictOf(url, n('/w/app'), Launch.Next)).toBe(Verdict.FeegaServer);
  });

  it('rifiuta un server Vite che non serve i file di questo progetto', async () => {
    const url = await serve((path) => ({ status: path.startsWith('/@fs/') ? 404 : 200 }));
    expect(await verdictOf(url, n('/w/app'), Launch.Vite)).toBe(Verdict.OtherProject);
  });

  it('accetta un server Vite che serve il package.json del progetto', async () => {
    const url = await serve(() => ({ status: 200 }));
    expect(await verdictOf(url, n('/w/app'), Launch.Vite)).toBe(Verdict.Ours);
  });

  it('accetta un server di un altro framework senza prove ulteriori', async () => {
    const url = await serve(() => ({ status: 200 }));
    expect(await verdictOf(url, n('/w/app'), Launch.Next)).toBe(Verdict.Ours);
  });

  it('dice che nessuno risponde su una porta chiusa', async () => {
    expect(await verdictOf('http://127.0.0.1:1/', n('/w/app'), Launch.Vite)).toBe(Verdict.Silent);
  });
});
