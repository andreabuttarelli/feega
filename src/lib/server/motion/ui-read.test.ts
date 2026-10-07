import { describe, expect, it, vi } from 'vitest';
import { AssetKind } from '$lib/motion/components';
import { uiReader } from './ui-read';

const ASSET = { id: 'a', kind: AssetKind.Image, label: 'capture', previewUrl: '', url: 'https://x/a.png' };
const STRUCTURE = { layout: 'app', colors: { ink: '#111111', muted: '#777777', paper: '#ffffff', line: '#eeeeee', accent: '#ff5500' }, font: 'sans', radius: 8, blocks: [{ kind: 'heading', text: 'Hi' }] };

function reader(answer: unknown) {
  const ask = vi.fn(async () => answer);
  const fetchBytes = vi.fn(async () => ({ mediaType: 'image/png', data: 'AAAA' }));
  return { ask, fetchBytes, read: uiReader({ ask, fetchBytes }) };
}

describe('reading a UI structure from a capture', () => {
  it('sends the picture and the region to the vision model and keeps a valid structure', async () => {
    const { ask, read } = reader(STRUCTURE);
    const got = await read(ASSET, { x: 0, y: 0.5, width: 1, height: 0.5 });

    expect(got).toEqual({ ok: true, structure: STRUCTURE });
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ images: [{ mediaType: 'image/png', data: 'AAAA' }], prompt: expect.stringContaining('50%') }));
  });

  it('refuses what the model invents outside the schema', async () => {
    const { read } = reader({ ...STRUCTURE, colors: { ...STRUCTURE.colors, accent: 'orange' } });

    expect((await read(ASSET)).ok).toBe(false);
  });

  it('turns a failed model call into an error the agent can read', async () => {
    const { ask, read } = reader(STRUCTURE);
    ask.mockRejectedValueOnce(new Error('timeout'));

    expect(await read(ASSET)).toEqual({ ok: false, error: 'the capture could not be read: timeout' });
  });
});
