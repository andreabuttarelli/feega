import { describe, expect, it } from 'vitest';
import { assetOf, hostAssets } from './embed-assets';

const BASE = 'https://oh.feega.app/e/n/a';
const big = (byte: number) => Buffer.alloc(4096, byte).toString('base64');
const audio = `data:audio/mpeg;base64,${big(7)}`;
const photo = `data:image/jpeg;base64,${big(9)}`;
const dot = 'data:image/png;base64,iVBORw0KGgo=';
const page = `<script>({"html":"{\\"assets\\":{\\"a\\":\\"${audio}\\",\\"b\\":\\"${photo}\\",\\"c\\":\\"${audio}\\",\\"d\\":\\"${dot}\\"}}"})</script>`;

describe('hostAssets', () => {
  it('turns every large inlined asset into one content-hashed url, once per distinct asset', () => {
    const hosted = hostAssets(page, BASE);
    const urls = hosted.match(/https:\/\/oh\.feega\.app\/e\/n\/a\/[0-9a-f]+/g) ?? [];

    expect(hosted).not.toContain(big(7));
    expect(urls).toHaveLength(3);
    expect(new Set(urls).size).toBe(2);
    expect(hosted).toContain(dot);
  });

  it('serves back the exact bytes and type behind a hosted url', () => {
    const hash = hostAssets(page, BASE).match(/\/a\/([0-9a-f]+)/)?.[1] ?? '';

    const asset = assetOf(page, hash);

    expect(asset?.type).toBe('audio/mpeg');
    expect(Buffer.from(asset?.bytes ?? []).equals(Buffer.alloc(4096, 7))).toBe(true);
  });

  it('an unknown hash is no asset', () => {
    expect(assetOf(page, 'feedface')).toBeNull();
  });
});
