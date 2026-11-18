import { describe, expect, it } from 'vitest';
import { pictureTurns } from './picture-turns';

const settled = () => new Promise((r) => setTimeout(r, 0));

describe('pictures wait for the vectors still owed on screen', () => {
  it('lets only a few frames fetch pictures while an on-screen frame still lacks its vectors (sources queued behind 800 pictures)', async () => {
    const turns = pictureTurns(1);
    turns.owed(true);
    const started: number[] = [];

    void turns.take().then(() => started.push(1));
    void turns.take().then(() => started.push(2));
    await settled();

    expect(started).toEqual([1]);
  });

  it('hands the next turn when one is done', async () => {
    const turns = pictureTurns(1);
    turns.owed(true);
    const started: number[] = [];

    const first = await turns.take();
    void turns.take().then(() => started.push(2));
    first();
    await settled();

    expect(started).toEqual([2]);
  });

  it('opens every waiting frame once nothing on screen owes vectors', async () => {
    const turns = pictureTurns(1);
    turns.owed(true);
    const started: number[] = [];

    void turns.take();
    void turns.take().then(() => started.push(2));
    void turns.take().then(() => started.push(3));
    turns.owed(false);
    await settled();

    expect(started).toEqual([2, 3]);
  });

  it('never holds a frame when the limit is unbounded (hosted: pictures come from another host)', async () => {
    const turns = pictureTurns(Infinity);
    turns.owed(true);
    const started: number[] = [];

    void turns.take().then(() => started.push(1));
    void turns.take().then(() => started.push(2));
    await settled();

    expect(started).toEqual([1, 2]);
  });
});
