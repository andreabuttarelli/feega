import { describe, expect, it } from 'vitest';
import { editQueue } from './edit-queue';

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('editQueue', () => {
  it('runs tasks one at a time in arrival order', async () => {
    const queue = editQueue();
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`${name}:start`);
      await later(ms);
      log.push(`${name}:end`);
    };

    await Promise.all([queue.run(task('a', 30)), queue.run(task('b', 1)), queue.run(task('c', 1))]);

    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('keeps going after a task fails', async () => {
    const queue = editQueue();

    const failed = queue.run(async () => Promise.reject(new Error('boom')));
    const next = queue.run(async () => 'done');

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('done');
  });
});
