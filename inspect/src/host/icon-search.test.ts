import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectLibrary } from '@feega/live-edit/icon-library';
import { IconSource, libraryHits, mcpIcon, mcpSearch } from './icon-search';

const reply = (content: { type: string; text: string }[]) => async () => new Response(JSON.stringify({ result: { content } }));

describe('iconmcp', () => {
  it('searches icons by name', async () => {
    const results = [{ name: 'arrow-right', label: 'Arrow right' }, { name: 'download', label: 'Download' }];
    const hits = await mcpSearch(reply([{ type: 'text', text: JSON.stringify({ results }) }]), 'arrow', 5);

    expect(hits).toEqual([
      { name: 'arrow-right', label: 'Arrow right', source: IconSource.IconMcp },
      { name: 'download', label: 'Download', source: IconSource.IconMcp }
    ]);
  });

  it('asks for an icon with its size and stroke, and gets the svg back', async () => {
    let body = '';
    const fetcher = async (_: string, init?: RequestInit) => {
      body = String(init?.body);
      return reply([{ type: 'text', text: '<svg viewBox="0 0 16 16"></svg>' }, { type: 'text', text: '{}' }])();
    };

    expect(await mcpIcon(fetcher, 'arrow-right', 24, 2)).toBe('<svg viewBox="0 0 16 16"></svg>');
    expect(JSON.parse(body).params).toEqual({ name: 'get_icon', arguments: { name: 'arrow-right', size: 24, stroke: 2 } });
  });

  it('reads an event stream reply', async () => {
    const stream = async () => new Response(`event: message\ndata: ${JSON.stringify({ result: { content: [{ type: 'text', text: '<svg></svg>' }] } })}\n\n`);

    expect(await mcpIcon(stream, 'x', 24, 2)).toBe('<svg></svg>');
  });

  it('does not ask iconmcp for an empty query', async () => {
    let called = false;
    const fetcher = async () => {
      called = true;
      return reply([])();
    };

    expect(await mcpSearch(fetcher, '  ', 5)).toEqual([]);
    expect(called).toBe(false);
  });

  it('reports a tool error as its message, not a JSON parse failure', async () => {
    const failing = async () => new Response(JSON.stringify({ result: { content: [{ type: 'text', text: 'MCP error -32602: bad query' }], isError: true } }));

    await expect(mcpSearch(failing, 'a', 5)).rejects.toThrow('MCP error -32602: bad query');
  });

  it('fails with the reason when the service is down', async () => {
    const down = async () => new Response('no', { status: 503 });

    await expect(mcpSearch(down, 'a', 5)).rejects.toThrow('503');
  });
});

describe('libraryHits', () => {
  it('lists the icons the installed package ships, filtered by the query', async () => {
    const root = mkdtempSync(join(tmpdir(), 'icons-'));
    const dir = join(root, 'node_modules/lucide-react/dist/esm/icons');
    mkdirSync(dir, { recursive: true });
    ['mail.js', 'mail.js.map', 'mail-open.js', 'heart.js'].forEach((f) => writeFileSync(join(dir, f), ''));
    const library = detectLibrary(JSON.stringify({ dependencies: { 'lucide-react': '1' } }))!;

    expect((await libraryHits(root, library, 'mail', 10)).map((h) => h.name)).toEqual(['mail', 'mail-open']);
  });
});
