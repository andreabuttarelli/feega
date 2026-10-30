import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { historyApi, historyRows, keepChoices, type History } from './history.ts';

const seen: string[] = [];
const bodies: string[] = [];
const methods: string[] = [];
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    seen.push(req.url ?? '');
    methods.push(req.method ?? '');
    let text = '';
    req.on('data', (chunk) => (text += chunk));
    req.on('end', () => {
      bodies.push(text);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ canvas_id: 'c-1', lanes: [], entries: [] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe('historyApi', () => {
  it('reads the canvas timeline with the author and frame filters', async () => {
    await historyApi.list('t', { canvasId: 'c-1', author: 'ai', frame: 'f-1' }, 'org-1');

    expect(seen.at(-1)).toBe('/api/v1/canvas/c-1/history?author=ai&frame=f-1&org=org-1');
  });

  it('previews, restores and names one point of the timeline', async () => {
    await historyApi.at('t', { canvasId: 'c-1', entryId: 'revision:f-1:4', action: 'preview' });
    expect(seen.at(-1)).toBe('/api/v1/canvas/c-1/history/revision%3Af-1%3A4/preview');

    await historyApi.at('t', { canvasId: 'c-1', entryId: 'version:v1', action: 'restore' }, 'org-1');
    expect(seen.at(-1)).toBe('/api/v1/canvas/c-1/history/version%3Av1/restore?org=org-1');
  });

  it('merges and drops a branch of the timeline', async () => {
    await historyApi.at('t', { canvasId: 'c-1', entryId: 'branch:b-1:1', action: 'merge', keep: 'main' });
    expect(seen.at(-1)).toBe('/api/v1/canvas/c-1/history/branch%3Ab-1%3A1/merge');

    await historyApi.at('t', { canvasId: 'c-1', entryId: 'branch:b-1:1', action: 'drop' });
    expect(seen.at(-1)).toBe('/api/v1/canvas/c-1/history/branch%3Ab-1%3A1/drop');
  });

  it('sends no filter it was not given', async () => {
    await historyApi.list('t', { canvasId: 'c-1' });

    expect(seen.at(-1)).toBe('/api/v1/canvas/c-1/history');
  });
});

describe('historyApi.resolve', () => {
  it('posts the side to keep for one recorded conflict', async () => {
    await historyApi.resolve('t', { canvasId: 'c-1', conflictId: 'k-1', keep: 'mine' }, 'org-1');

    expect([methods.at(-1), seen.at(-1)]).toEqual(['POST', '/api/v1/canvas/c-1/conflicts/k-1/resolve?org=org-1']);
    expect(JSON.parse(bodies.at(-1) ?? '{}')).toEqual({ keep: 'mine' });
  });
});

describe('revert', () => {
  it('posts the change with its choices and confirm', async () => {
    await historyApi.at('t', { canvasId: 'c-1', entryId: 'event:7', action: 'revert', choices: keepChoices(['data.prompt=reject']), confirm: true });

    expect(seen.at(-1)).toBe('/api/v1/canvas/c-1/history/event%3A7/revert');
    expect(JSON.parse(bodies.at(-1) ?? '{}')).toEqual({ choices: [{ path: 'data.prompt', keep: 'reject' }], confirm: true });
  });

  it('a keep that is neither mine nor reject is refused', () => {
    expect(() => keepChoices(['data.prompt=theirs'])).toThrow();
  });
});

describe('historyRows', () => {
  it('names each entry by its lane, what it touched and its session', () => {
    const history: History = {
      canvas_id: 'c-1',
      lanes: [{ key: 'agent:claude-code', kind: 'agent', label: 'claude-code' }],
      entries: [{ id: 'event:1', source: 'event', kind: 'node.create', at: '2026-10-29T10:00:00Z', lane: 0, node_id: 'n-1', frame_id: null, subject: 'Hero title', session_id: 's-1', summary: null }]
    };

    expect(historyRows(history)).toEqual([{ at: '2026-10-29T10:00:00Z', who: 'claude-code', what: 'node.create', target: 'Hero title', session: 's-1', summary: '', id: 'event:1' }]);
  });
});
