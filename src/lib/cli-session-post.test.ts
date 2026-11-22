import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { PostOutcome, desktopLink, editorLinks, postSession } from './cli-session-post';

const session = { access_token: 'a', refresh_token: 'r', expires_at: 1, state: 'app.s1' };
const servers: Server[] = [];

async function listener(status: number) {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    seen.push(String(req.url));
    res.writeHead(status).end();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { port: (server.address() as { port: number }).port, seen };
}

afterEach(() => {
  servers.splice(0).forEach((s) => s.close());
});

describe('postSession', () => {
  it('reaches a listener bound only to 127.0.0.1 even when localhost resolves elsewhere', async () => {
    const { port, seen } = await listener(200);
    const hosts: string[] = [];
    const resolvingToV6: typeof fetch = (input, init) => {
      const url = String(input);
      hosts.push(new URL(url).hostname);
      return fetch(url.replace('localhost', '[::1]'), init);
    };
    expect(await postSession(port, session, resolvingToV6)).toBe(PostOutcome.Sent);
    expect(seen).toEqual(['/session']);
    expect(hosts[0]).toBe('127.0.0.1');
  });

  it('falls back to localhost when 127.0.0.1 refuses', async () => {
    const calls: string[] = [];
    const flaky: typeof fetch = async (input) => {
      calls.push(new URL(String(input)).hostname);
      if (calls.length === 1) {
        throw new TypeError('Failed to fetch');
      }
      return new Response('', { status: 200 });
    };
    expect(await postSession(1, session, flaky)).toBe(PostOutcome.Sent);
    expect(calls).toEqual(['127.0.0.1', 'localhost']);
  });

  it('does not retry when the listener answered with a refusal', async () => {
    const { port, seen } = await listener(400);
    expect(await postSession(port, session)).toBe(PostOutcome.Rejected);
    expect(seen).toHaveLength(1);
  });

  it('reports unreachable when nothing listens', async () => {
    const failing: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await postSession(1, session, failing)).toBe(PostOutcome.Unreachable);
  });

  it('asks Chrome for loopback access', async () => {
    let init: RequestInit | undefined;
    const spy: typeof fetch = async (_input, i) => {
      init = i;
      return new Response('', { status: 200 });
    };
    await postSession(1, session, spy);
    expect((init as { targetAddressSpace?: string }).targetAddressSpace).toBe('loopback');
  });
});

describe('editorLinks', () => {
  it('opens each editor on the extension sign-in handler with the session', () => {
    const links = editorLinks(session);
    expect(links.map((l) => l.label)).toEqual(['VS Code', 'Cursor', 'Windsurf', 'VSCodium']);
    const url = new URL(links[0].href);
    expect(url.protocol).toBe('vscode:');
    expect(url.hostname).toBe('andreabuttarelli.feega');
    expect(url.pathname).toBe('/signin');
    expect(Object.fromEntries(url.searchParams)).toEqual({ access_token: 'a', refresh_token: 'r', expires_at: '1', state: 'app.s1' });
    expect(links[1].href.startsWith('cursor://andreabuttarelli.feega/signin?')).toBe(true);
  });
});

describe('desktopLink', () => {
  it('opens the Feega desktop app on its sign-in handler with the session', () => {
    const link = desktopLink(session);
    const url = new URL(link.href);
    expect(link.label).toBe('Feega');
    expect(url.protocol).toBe('feega:');
    expect(url.hostname).toBe('signin');
    expect(Object.fromEntries(url.searchParams)).toEqual({ access_token: 'a', refresh_token: 'r', expires_at: '1', state: 'app.s1' });
  });
});
