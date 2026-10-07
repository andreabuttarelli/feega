import { describe, expect, it, vi } from 'vitest';
import { localStills, type LocalPorts } from './local-stills';

function ports(overrides: Partial<LocalPorts> = {}): LocalPorts & { runs: string[][]; written: Record<string, string> } {
  const runs: string[][] = [];
  const written: Record<string, string> = {};
  return {
    runs,
    written,
    tempDir: async () => '/tmp/deep-x',
    write: async (path, text) => {
      written[path] = text;
    },
    run: vi.fn(async (cmd: string, args: string[]) => {
      runs.push([cmd, ...args]);
      return { code: 0, output: '' };
    }),
    read: async (path) => Buffer.from(path),
    remove: vi.fn(async () => {}),
    ...overrides
  };
}

const job = { html: '<html></html>', fps: 30 };

describe('stills rendered on this machine', () => {
  it('renders the composition with the local hyperframes engine, then cuts one JPEG per time', async () => {
    const p = ports();

    const frames = await localStills(p)(job, [0.25, 7.5]);

    expect(p.written['/tmp/deep-x/index.html']).toBe('<html></html>');
    expect(p.runs[0].join(' ')).toContain('hyperframes render /tmp/deep-x');
    expect(p.runs.some((r) => r.join(' ').includes('-ss 7.5'))).toBe(true);
    expect(frames.map((f) => f.time)).toEqual([0.25, 7.5]);
    expect(p.remove).toHaveBeenCalledWith('/tmp/deep-x');
  });

  it('fails with the engine output and still cleans up', async () => {
    const p = ports({ run: vi.fn(async () => ({ code: 1, output: 'Chrome not found' })) });

    await expect(localStills(p)(job, [1])).rejects.toThrow(/Chrome not found/);
    expect(p.remove).toHaveBeenCalled();
  });
});
