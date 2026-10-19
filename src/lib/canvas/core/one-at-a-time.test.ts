import { describe, expect, it } from 'vitest';
import { oneAtATime } from './one-at-a-time';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('one DOM read at a time', () => {
  it('a second read starts only after the first has finished', async () => {
    const run = oneAtATime();
    const log: string[] = [];
    const read = (name: string) => async () => {
      log.push(`${name} start`);
      await tick();
      log.push(`${name} end`);
      return name;
    };
    expect(await Promise.all([run(read('a')), run(read('b'))])).toEqual(['a', 'b']);
    expect(log).toEqual(['a start', 'a end', 'b start', 'b end']);
  });

  it('a failed read does not block the next one', async () => {
    const run = oneAtATime();
    await expect(run(async () => Promise.reject(new Error('probe timed out')))).rejects.toThrow('probe timed out');
    expect(await run(async () => 'next')).toBe('next');
  });
});
