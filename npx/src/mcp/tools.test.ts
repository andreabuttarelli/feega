import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { CloudError, CloudFailure, type CloudApi, type CloudComment } from '../../../inspect/src/host/cloud-api';
import type { ShareHost, ShareRequest } from '../../../inspect/src/host/share-port';
import type { Editors } from './editors';
import { BILLING_URL, mcpServer } from './server';

const comment = (over: Partial<CloudComment> = {}): CloudComment => ({ id: 'c1', sessionId: 's1', authorId: 'u1', authorName: 'Ada', body: 'Tighter padding', selector: 'div.card', sourceFile: 'src/Card.svelte', sourceLine: 4, sourceCol: 2, parentId: null, createdAt: '2026-11-21T10:00:00Z', resolvedAt: null, resolvedBy: null, ...over });

function rig(over: { comments?: CloudComment[]; api?: Partial<CloudApi>; shareFails?: Error } = {}) {
  const log: string[] = [];
  const started: ShareRequest[] = [];
  const share: ShareHost = {
    start: async (request) => {
      if (over.shareFails) {
        throw over.shareFails;
      }
      started.push(request);
      return { id: 's1', url: 'https://s1.s.feega.app', expiresAt: '2026-11-21T22:00:00Z' };
    },
    stop: async (id) => void log.push(`stop ${id}`)
  };
  const editors: Editors = {
    ensure: async (dir) => (log.push(`ensure ${dir}`), { url: 'http://127.0.0.1:4100/' }),
    release: async (dir) => void log.push(`release ${dir}`)
  };
  const api = {
    comments: async (_id: string, openOnly: boolean) => (over.comments ?? []).filter((c) => !openOnly || !c.resolvedAt),
    liveSessions: async () => [{ id: 's1' }],
    resolve: async (id: string, commentId: string, note?: string) => (log.push(`resolve ${id} ${commentId} ${note ?? ''}`.trim()), comment({ id: commentId, resolvedAt: 'now' })),
    snapshot: async (id: string, name: string) => ({ url: `https://oh.feega.app/s/${id}/${name}` }),
    ...over.api
  } as unknown as CloudApi;

  return { log, started, connect: connect(mcpServer({ api, share, editors, cwd: '/work/shop' }, '0.0.0')) };
}

async function connect(server: ReturnType<typeof mcpServer>) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

const textOf = (result: unknown) => ((result as { content: { text: string }[] }).content[0].text);
const jsonOf = (result: unknown) => JSON.parse(textOf(result));
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });

describe('feega mcp tools', () => {
  it('lists the five tools with json schemas', async () => {
    const client = await rig().connect;

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(['feega_comments', 'feega_resolve', 'feega_share', 'feega_snapshot', 'feega_stop']);
    expect(tools.find((t) => t.name === 'feega_share')!.inputSchema.properties).toHaveProperty('visitorsCanEdit');
    expect(tools.find((t) => t.name === 'feega_snapshot')!.inputSchema.required).toEqual(['sessionId', 'name']);
  });

  it('shares the working folder by starting an editor first', async () => {
    const { connect: ready, log, started } = rig();
    const client = await ready;

    const result = await call(client, 'feega_share');

    expect(jsonOf(result)).toEqual({ url: 'https://s1.s.feega.app', id: 's1', expiresAt: '2026-11-21T22:00:00Z' });
    expect(log).toEqual(['ensure /work/shop']);
    expect(started).toEqual([{ dir: '/work/shop', editorUrl: 'http://127.0.0.1:4100/', visitorsCanEdit: false }]);
  });

  it('shares a given folder and lets visitors edit when asked', async () => {
    const { connect: ready, started } = rig();
    const client = await ready;

    await call(client, 'feega_share', { dir: '/work/other', visitorsCanEdit: true });

    expect(started[0]).toMatchObject({ dir: '/work/other', visitorsCanEdit: true });
  });

  it('uses an editor that already runs when given its url', async () => {
    const { connect: ready, log, started } = rig();
    const client = await ready;

    await call(client, 'feega_share', { url: 'http://127.0.0.1:4200/' });

    expect(log).toEqual([]);
    expect(started[0].editorUrl).toBe('http://127.0.0.1:4200/');
  });

  it('tells the user to sign in when there is no account', async () => {
    const client = await rig({ shareFails: new CloudError(CloudFailure.NotSignedIn, 'x') }).connect;

    const result = await call(client, 'feega_share');

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('npx feega');
    expect(textOf(result)).toContain('FEEGA_API_KEY');
  });

  it('points to the billing page when the plan is missing', async () => {
    const client = await rig({ shareFails: new CloudError(CloudFailure.PlanRequired, 'x', 402) }).connect;

    const result = await call(client, 'feega_share');

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(BILLING_URL);
  });

  it('reports other failures with their message', async () => {
    const client = await rig({ shareFails: new Error('relay unreachable') }).connect;

    expect(textOf(await call(client, 'feega_share'))).toContain('relay unreachable');
  });

  it('lists open comments with file, line, column, selector and author', async () => {
    const client = await rig({ comments: [comment(), comment({ id: 'c2', resolvedAt: 'x' })] }).connect;
    await call(client, 'feega_share');

    const listed = jsonOf(await call(client, 'feega_comments', {}));

    expect(listed.comments).toEqual([{ id: 'c1', sessionId: 's1', author: 'Ada', text: 'Tighter padding', place: 'src/Card.svelte:4:2', file: 'src/Card.svelte', line: 4, column: 2, selector: 'div.card', replyTo: null, resolved: false, createdAt: '2026-11-21T10:00:00Z' }]);
  });

  it('includes resolved comments when openOnly is false', async () => {
    const client = await rig({ comments: [comment(), comment({ id: 'c2', resolvedAt: 'x' })] }).connect;
    await call(client, 'feega_share');

    const listed = jsonOf(await call(client, 'feega_comments', { sessionId: 's1', openOnly: false }));

    expect(listed.comments.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2']);
  });

  it('falls back to the live sessions when nothing was shared here', async () => {
    const client = await rig({ comments: [comment()] }).connect;

    const listed = jsonOf(await call(client, 'feega_comments'));

    expect(listed.comments).toHaveLength(1);
  });

  it('resolves a comment in the session it belongs to', async () => {
    const { connect: ready, log } = rig({ comments: [comment()] });
    const client = await ready;
    await call(client, 'feega_comments', { sessionId: 's1' });

    const result = jsonOf(await call(client, 'feega_resolve', { commentId: 'c1', note: 'Padding is 12px now' }));

    expect(result).toEqual({ id: 'c1', resolved: true });
    expect(log).toContain('resolve s1 c1 Padding is 12px now');
  });

  it('finds the session of a comment it has not listed yet', async () => {
    const { connect: ready, log } = rig({ comments: [comment()] });
    const client = await ready;

    await call(client, 'feega_resolve', { commentId: 'c1' });

    expect(log).toContain('resolve s1 c1');
  });

  it('refuses to resolve an unknown comment', async () => {
    const client = await rig().connect;

    const result = await call(client, 'feega_resolve', { commentId: 'nope' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('nope');
  });

  it('saves a named snapshot', async () => {
    const client = await rig().connect;

    expect(jsonOf(await call(client, 'feega_snapshot', { sessionId: 's1', name: 'v2' }))).toEqual({ url: 'https://oh.feega.app/s/s1/v2' });
  });

  it('stops the share and releases the editor it started', async () => {
    const { connect: ready, log } = rig();
    const client = await ready;
    await call(client, 'feega_share');

    const result = jsonOf(await call(client, 'feega_stop', { sessionId: 's1' }));

    expect(result).toEqual({ stopped: true });
    expect(log).toEqual(['ensure /work/shop', 'stop s1', 'release /work/shop']);
  });

  it('leaves an editor it did not start alone', async () => {
    const { connect: ready, log } = rig();
    const client = await ready;
    await call(client, 'feega_share', { url: 'http://127.0.0.1:4200/' });

    await call(client, 'feega_stop', { sessionId: 's1' });

    expect(log).toEqual(['stop s1']);
  });
});
