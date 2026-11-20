import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyImage } from './image-copy';

const BYTES = new Uint8Array([1, 2, 3]);

function app(deps: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'feega-img-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }));
  return dir;
}

describe('copyImage', () => {
  it('a SvelteKit app gets the file in static/images', async () => {
    const dir = app({ '@sveltejs/kit': '2' });

    const out = await copyImage(dir, 'hero.jpg', BYTES);

    expect(out).toEqual({ ok: true, url: '/images/hero.jpg' });
    expect([...readFileSync(join(dir, 'static/images/hero.jpg'))]).toEqual([1, 2, 3]);
  });

  it.each([['react'], ['next'], ['vue']])('%s apps get the file in public/images', async (dep) => {
    const dir = app({ [dep]: '1' });

    const out = await copyImage(dir, 'a.png', BYTES);

    expect(out).toEqual({ ok: true, url: '/images/a.png' });
    expect(readFileSync(join(dir, 'public/images/a.png')).length).toBe(3);
  });

  it('never overwrites: a taken name gets a numeric suffix', async () => {
    const dir = app({ react: '1' });
    mkdirSync(join(dir, 'public/images'), { recursive: true });
    writeFileSync(join(dir, 'public/images/hero.jpg'), 'mine');

    const out = await copyImage(dir, 'hero.jpg', BYTES);

    expect(out).toEqual({ ok: true, url: '/images/hero-2.jpg' });
    expect(readFileSync(join(dir, 'public/images/hero.jpg'), 'utf8')).toBe('mine');
  });

  it('a name with a path or odd characters is reduced to a safe file name', async () => {
    const dir = app({ react: '1' });

    const out = await copyImage(dir, '../../My Photo (1).JPG', BYTES);

    expect(out).toEqual({ ok: true, url: '/images/My-Photo-1.jpg' });
  });

  it('refuses a file that is not an image', async () => {
    const dir = app({ react: '1' });

    const out = await copyImage(dir, 'script.js', BYTES);

    expect(out.ok).toBe(false);
  });
});
