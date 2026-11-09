import { describe, expect, it } from 'vitest';
import { serverTiming } from './server-timing';

describe('serverTiming', () => {
  it('times every call a port makes, under the name of the call', async () => {
    let t = 0;
    const phases = serverTiming(() => (t += 5));
    const port = phases.port({ read: async (id: string) => id, write: async () => 1 });

    expect(await port.read('a')).toBe('a');
    await port.write();

    expect(phases.header()).toBe('read;dur=5, write;dur=5');
  });
});
