import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

const canvasPage = (name: string) =>
  readFileSync(join(dir, '..', '..', 'routes', 'p', '[projectId]', 'c', '[canvasId]', name), 'utf8');

const flow = readFileSync(join(dir, '..', 'components', 'canvas', 'gpu', 'GpuFlow.svelte'), 'utf8');
const page = canvasPage('+page.svelte');
const server = readFileSync(join(dir, '..', 'server', 'canvas', 'canvas-page.ts'), 'utf8');

describe('il gesto di cancellare arriva fino alla riga', () => {
  it('la tela chiede fuori di togliere le tile, invece di deciderlo da sé', () => {
    expect(flow).toMatch(/onDelete\?\.\(/);
  });

  it('la pagina toglie le tile dal PROPRIO stato, o la riconciliazione le riporta', () => {
    expect(page).toMatch(/onDelete=\{/);
    expect(page).toMatch(/post\('remove'/);
  });

  it('e le linee della tela le può togliere davvero', () => {
    expect(page).toMatch(/onEdgeDelete=\{/);
    expect(page).toMatch(/action: LineAction\.Disconnect/);
  });

  it('le action che cancellano ci sono entrambe, e il server le conosce', () => {
    expect(server).toMatch(/remove: async/);
    expect(server).toMatch(/disconnect: async/);
  });
});
