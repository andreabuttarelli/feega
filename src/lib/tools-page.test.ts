import { describe, expect, it } from 'vitest';
import { TOOLS } from '$lib/tools';
import { toolEntries } from './tools-page';

describe('the tools page lists what left the sidebar', () => {
  it('every tool with a page, scoped to the project, then the gallery', () => {
    const entries = toolEntries('p1');

    expect(entries.map((e) => e.id)).toEqual([...TOOLS.filter((t) => t.route).map((t) => t.id), 'gallery']);
    expect(entries.find((e) => e.id === 'studio')?.href).toBe('/app/studio?project=p1');
    expect(entries.at(-1)?.href).toBe('/gallery');
  });

  it('keeps the beta label here, where the sidebar no longer shows it', () => {
    expect(toolEntries(null).find((e) => e.id === 'studio')?.badge).toBe('Beta');
  });
});
