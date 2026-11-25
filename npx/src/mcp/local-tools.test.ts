import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import type { EditorEntry, EditorRegistry } from '../../../inspect/src/host/local-bridge/editors';
import { localTools } from './local-tools';
import { Picture } from './tools';
import { mcpServer } from './server';
import type { CloudDeps } from './tools';

const shop: EditorEntry = { projectRoot: '/work/shop', port: 4001, token: 'tk-shop', pid: 1, lastActiveAt: 5 };
const blog: EditorEntry = { projectRoot: '/work/blog', port: 4002, token: 'tk-blog', pid: 2, lastActiveAt: 9 };

type Answers = Record<number, unknown>;

function rig(entries: EditorEntry[], answers: Answers = {}, cwd = '/work/shop') {
  const dropped: number[] = [];
  const asked: { url: string; auth: string | null }[] = [];
  const registry: EditorRegistry = {
    list: () => entries.filter((e) => !dropped.includes(e.port)),
    save: () => undefined,
    drop: (e) => void dropped.push(e.port)
  };
  const send = (async (url: string, init: RequestInit) => {
    const port = Number(new URL(url).port);
    asked.push({ url, auth: new Headers(init.headers).get('authorization') });
    if (!(port in answers)) {
      throw new TypeError('fetch failed');
    }
    return { ok: true, json: async () => answers[port] };
  }) as unknown as typeof fetch;
  const cloud = {} as CloudDeps;
  return { dropped, asked, tools: localTools({ registry, send, cwd }), connect: connect(mcpServer({ ...cloud, cwd }, '0.0.0', localTools({ registry, send, cwd }))) };
}

async function connect(server: ReturnType<typeof mcpServer>) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 't', version: '0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

const textOf = (result: unknown) => ((result as { content: { text: string }[] }).content[0].text);

describe('local tools', () => {
  it('feega_selection returns the context of the editor for the folder', async () => {
    const { tools, asked } = rig([shop, blog], { 4001: { context: 'Feega selection\nsource: src/Card.svelte:4:2' } });

    expect(await tools.feega_selection.run({})).toEqual({ context: 'Feega selection\nsource: src/Card.svelte:4:2' });
    expect(asked).toEqual([{ url: 'http://127.0.0.1:4001/selection', auth: 'Bearer tk-shop' }]);
  });

  it('says nothing is selected when the editor has no selection', async () => {
    const { tools } = rig([shop], { 4001: { context: null } });

    expect(await tools.feega_selection.run({})).toEqual({ context: null, note: 'Nothing is selected in Feega. Click an element in the editor.' });
  });

  it('feega_changes returns the visual edits with their files', async () => {
    const change = { id: 1, at: 'src/Card.svelte:4:2', prop: 'padding', value: '16px', scope: 'element', files: ['src/Card.svelte'], time: 3 };
    const { tools } = rig([shop], { 4001: { changes: [change] } });

    expect(await tools.feega_changes.run({})).toEqual({ changes: [change] });
  });

  it('project targets another editor', async () => {
    const { tools, asked } = rig([shop, blog], { 4002: { context: 'blog' } });
    await tools.feega_selection.run({ project: '/work/blog' });

    expect(asked[0].url).toBe('http://127.0.0.1:4002/selection');
  });

  it('feega_screenshot returns the picture of the tab the user sees', async () => {
    const { tools, asked } = rig([shop], { 4001: { png: 'iVBORw0K' } });

    expect(await tools.feega_screenshot.run({})).toEqual(new Picture('iVBORw0K'));
    expect(asked).toEqual([{ url: 'http://127.0.0.1:4001/screenshot', auth: 'Bearer tk-shop' }]);
  });

  it('feega_screenshot crops to the selection when asked', async () => {
    const { tools, asked } = rig([shop], { 4001: { png: 'iVBORw0K' } });
    await tools.feega_screenshot.run({ selection: true });

    expect(asked[0].url).toBe('http://127.0.0.1:4001/screenshot?selection=1');
  });

  it('feega_screenshot says so when the editor could not draw the tab', async () => {
    const { tools } = rig([shop], { 4001: { png: null } });

    await expect(tools.feega_screenshot.run({})).rejects.toThrow('Feega could not capture the tab');
  });

  it('hands the picture to the agent as an image, not as text', async () => {
    const { connect: ready } = rig([shop], { 4001: { png: 'iVBORw0K' } });
    const result = (await (await ready).callTool({ name: 'feega_screenshot', arguments: {} })) as { content: { type: string; data?: string; mimeType?: string }[] };

    expect(result.content).toEqual([{ type: 'image', data: 'iVBORw0K', mimeType: 'image/png' }]);
  });

  it('feega_context returns the block the composer shows', async () => {
    const { tools, asked } = rig([shop], { 4001: { context: 'Feega page\npage: /' } });

    expect(await tools.feega_context.run({})).toEqual({ context: 'Feega page\npage: /' });
    expect(asked[0].url).toBe('http://127.0.0.1:4001/context');
  });

  it('feega_editors lists the running editors without tokens', async () => {
    const { tools } = rig([shop, blog]);
    const listed = (await tools.feega_editors.run({})) as { editors: Record<string, unknown>[] };

    expect(listed.editors).toEqual([
      { project: '/work/shop', lastActiveAt: 5 },
      { project: '/work/blog', lastActiveAt: 9 }
    ]);
  });

  it('asks to open Feega when no editor runs', async () => {
    const { connect: ready } = rig([]);
    const result = await (await ready).callTool({ name: 'feega_selection', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('No Feega editor is running. Open Feega in this project first: npx feega or the VS Code panel.');
  });

  it('names the projects that have Feega open when none matches the folder', async () => {
    const { connect: ready } = rig([blog], {}, '/work/shop');
    const result = await (await ready).callTool({ name: 'feega_changes', arguments: {} });

    expect(textOf(result)).toContain('Feega is open in /work/blog');
  });

  it('ignores and cleans an editor that refuses the connection', async () => {
    const { tools, dropped } = rig([shop]);

    await expect(tools.feega_selection.run({})).rejects.toThrow('No Feega editor is running');
    expect(dropped).toEqual([4001]);
  });

  it('falls back to the next editor when the best one is stale', async () => {
    const parent: EditorEntry = { ...shop, projectRoot: '/work', port: 4003, token: 'tk-up' };
    const deep: EditorEntry = { ...shop, projectRoot: '/work/shop/app', port: 4004 };
    const { tools, dropped } = rig([parent, deep], { 4003: { context: 'up' } }, '/work/shop/app');

    expect(await tools.feega_selection.run({})).toEqual({ context: 'up' });
    expect(dropped).toEqual([4004]);
  });
});
