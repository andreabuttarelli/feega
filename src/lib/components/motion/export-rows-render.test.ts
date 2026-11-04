import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ExportRows from './ExportRows.svelte';

describe('the export rows', () => {
  it('start at 2x of the frame as it is on the canvas', () => {
    const body = render(ExportRows, { props: { count: 1, onexport: async () => 'off' } }).body;

    expect(body).toMatch(/aria-label="Size"[^>]*value="2"|value="2"[^>]*aria-label="Size"/);
  });
});
