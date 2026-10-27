import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFeegaMcpServer, listAllTools } from './server.ts';
import { savedPath } from './tools/canvas-file.ts';

const registered = (server: unknown) => Object.keys((server as { _registeredTools: Record<string, unknown> })._registeredTools);

describe('canvas_file: a canvas on the local disk', () => {
  test('saving into a folder names the file after the canvas', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'feega-file-'));
    expect(await savedPath(dir, 'Launch.feega')).toBe(join(dir, 'Launch.feega'));
    expect(await savedPath(join(dir, 'mine.feega'), 'Launch.feega')).toBe(join(dir, 'mine.feega'));
  });

  test('is a canvas tool an agent can find and load', async () => {
    expect(registered(createFeegaMcpServer())).toContain('canvas_file');
    expect((await listAllTools()).map((t) => t.name)).toContain('canvas_file');
  });
});
