import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectLibrary } from '@feega/live-edit/icon-library';
import { IconSource, LIBRARY_GRID_LIMIT, libraryHits, mcpIcon, mcpSearch, searchIcons } from './icon-search';

const LUCIDE = JSON.stringify({ dependencies: { 'lucide-react': '1' } });
const NODE = 'const __iconData = { node: [["path", { d: "M5 12h14", key: "a" }]] };';
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
    ['mail.js', 'mail.js.map', 'mail-open.js', 'heart.js'].forEach((f) => writeFileSync(join(dir, f), 'const __iconNode = [["path", { "d": "M1 1" }]];'));
    const library = detectLibrary(JSON.stringify({ dependencies: { 'lucide-react': '1' } }))!;

    expect((await libraryHits(root, library, 'mail', 10, null)).map((h) => h.name)).toEqual(['mail', 'mail-open']);
  });

  it('draws an alias through the module it re-exports, and leaves out what it cannot draw', async () => {
    const root = mkdtempSync(join(tmpdir(), 'icons-'));
    const dir = join(root, 'node_modules/lucide-react/dist/esm/icons');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'mail-box.mjs'), 'export { default } from \'./mailbox.mjs\';');
    writeFileSync(join(dir, 'mailbox.mjs'), NODE);
    writeFileSync(join(dir, 'mail-index.mjs'), 'export {};');
    const library = detectLibrary(LUCIDE)!;
    const hits = await libraryHits(root, library, 'mail', 10, null);

    expect(hits.map((h) => h.name).sort()).toEqual(['mail-box', 'mailbox']);
    expect(hits.every((h) => h.svg)).toBe(true);
  });

  it('keeps filling the grid past icons it cannot draw', async () => {
    const root = mkdtempSync(join(tmpdir(), 'icons-'));
    const dir = join(root, 'node_modules/lucide-react/dist/esm/icons');
    mkdirSync(dir, { recursive: true });
    Array.from({ length: 5 }, (_, i) => writeFileSync(join(dir, `a${i}.mjs`), 'export {};'));
    Array.from({ length: 3 }, (_, i) => writeFileSync(join(dir, `b${i}.mjs`), NODE));
    const hits = await libraryHits(root, detectLibrary(LUCIDE)!, '', 3, null);

    expect(hits).toHaveLength(3);
  });
});

function project(icons: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'icons-'));
  const dir = join(root, 'node_modules/lucide-react/dist/esm/icons');
  mkdirSync(dir, { recursive: true });
  Object.entries(icons).forEach(([file, text]) => writeFileSync(join(dir, file), text));
  writeFileSync(join(root, 'package.json'), LUCIDE);
  return root;
}

const remoteReply = (results: { name: string }[]) => reply([{ type: 'text', text: JSON.stringify({ results }) }]);

describe('searchIcons', () => {
  it('ranks local hits and draws them', async () => {
    const root = project({ 'a-arrow-up.mjs': NODE, 'arrow-up-01.mjs': NODE, 'arrow-right.mjs': NODE });
    const found = await searchIcons(root, remoteReply([]), 'arrow', null);

    expect(found.hits.map((h) => h.name)).toEqual(['arrow-right', 'arrow-up-01', 'a-arrow-up']);
    expect(found.hits[0].svg).toContain('<path d="M5 12h14"/>');
  });

  it('keeps the remote hits next to the local ones, even with the same name', async () => {
    const root = project({ 'arrow-right.mjs': NODE });
    const found = await searchIcons(root, remoteReply([{ name: 'arrow-right' }, { name: 'download' }]), 'arrow', null);

    expect(found.hits.map((h) => [h.name, h.source])).toEqual([
      ['arrow-right', IconSource.Library],
      ['arrow-right', IconSource.IconMcp],
      ['download', IconSource.IconMcp]
    ]);
    expect(found.error).toBeUndefined();
  });

  it('searches iconmcp even when the project has no icon package', async () => {
    const root = mkdtempSync(join(tmpdir(), 'icons-'));
    const found = await searchIcons(root, remoteReply([{ name: 'download' }]), 'arrow', null);

    expect(found.library).toBeNull();
    expect(found.hits.map((h) => h.name)).toEqual(['download']);
  });

  it('reports why iconmcp is missing', async () => {
    const root = project({ 'arrow-right.mjs': NODE });
    const found = await searchIcons(root, async () => new Response('no', { status: 503 }), 'arrow', null);

    expect(found.error).toContain('503');
    expect(found.hits.map((h) => h.source)).toEqual([IconSource.Library]);
  });

  it('suggests the selected icon first when there is no query, and asks iconmcp for something like it', async () => {
    const root = project({ 'zap.mjs': NODE, 'arrow-left.mjs': NODE, 'arrow-right.mjs': NODE });
    let asked = '';
    const fetcher = async (_: string, init?: RequestInit) => {
      asked = JSON.parse(String(init?.body)).params.arguments.query;
      return remoteReply([{ name: 'move-right' }])();
    };
    const found = await searchIcons(root, fetcher, '', 'arrow-right');

    expect(found.hits.filter((h) => h.source === IconSource.Library).map((h) => h.name)).toEqual(['arrow-right', 'arrow-left', 'zap']);
    expect(asked).toBe('arrow-right');
    expect(found.hits.at(-1)?.name).toBe('move-right');
  });

  it('caps the grid', async () => {
    const files = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`icon-${i}.mjs`, NODE]));
    const found = await searchIcons(project(files), remoteReply([]), '', null);

    expect(found.hits).toHaveLength(LIBRARY_GRID_LIMIT);
  });
});
