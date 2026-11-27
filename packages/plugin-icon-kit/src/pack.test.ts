import { describe, expect, it } from 'vitest';
import { pack } from './pack';
import { unpack } from './unpack';

describe('packed data', () => {
  it('comes back identical after packing and unpacking', async () => {
    const data = { camera: ['<path d="M1 1"/>', 'photo'], sun: ['<circle r="4"/>', ''] };

    expect(await unpack(pack(data))).toEqual(data);
  });

  it('is smaller than the text it holds', () => {
    const data = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`icon-${i}`, '<path d="M12 2 L22 22 L2 22 Z"/>']));

    expect(pack(data).length).toBeLessThan(JSON.stringify(data).length / 4);
  });
});
