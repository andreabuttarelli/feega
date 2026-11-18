import { describe, expect, it } from 'vitest';
import { owesVectors, pictureTurns } from './picture-turns';

const settled = () => new Promise((r) => setTimeout(r, 0));
const FIRST = () => 0;

describe('pictures wait for the vectors still owed on screen', () => {
  it('lets only a few frames fetch pictures while an on-screen frame still lacks its vectors (sources queued behind 800 pictures)', async () => {
    const turns = pictureTurns(1);
    turns.owed(true);
    const started: number[] = [];

    void turns.take(FIRST).then(() => started.push(1));
    void turns.take(FIRST).then(() => started.push(2));
    await settled();

    expect(started).toEqual([1]);
  });

  it('hands the next turn when one is done', async () => {
    const turns = pictureTurns(1);
    turns.owed(true);
    const started: number[] = [];

    const first = await turns.take(FIRST);
    void turns.take(FIRST).then(() => started.push(2));
    first();
    await settled();

    expect(started).toEqual([2]);
  });

  it('opens every waiting frame once nothing on screen owes vectors', async () => {
    const turns = pictureTurns(1);
    turns.owed(true);
    const started: number[] = [];

    void turns.take(FIRST);
    void turns.take(FIRST).then(() => started.push(2));
    void turns.take(FIRST).then(() => started.push(3));
    turns.owed(false);
    await settled();

    expect(started).toEqual([2, 3]);
  });

  it('never holds a frame when the limit is unbounded (hosted: pictures come from another host)', async () => {
    const turns = pictureTurns(Infinity);
    turns.owed(true);
    const started: number[] = [];

    void turns.take(FIRST).then(() => started.push(1));
    void turns.take(FIRST).then(() => started.push(2));
    await settled();

    expect(started).toEqual([1, 2]);
  });

  it('hands the next turn to the frame nearest the centre, not to the first that asked', async () => {
    const turns = pictureTurns(1);
    turns.owed(true);
    const started: string[] = [];

    const first = await turns.take(() => 0);
    void turns.take(() => 900).then(() => started.push('far'));
    void turns.take(() => 10).then(() => started.push('near'));
    first();
    await settled();

    expect(started).toEqual(['near']);
  });

  it('ranks at hand-out time, so a frame the camera moved to goes first', async () => {
    const turns = pictureTurns(1);
    turns.owed(true);
    const started: string[] = [];
    const rank = { a: 10, b: 900 };

    const first = await turns.take(() => 0);
    void turns.take(() => rank.a).then(() => started.push('a'));
    void turns.take(() => rank.b).then(() => started.push('b'));
    rank.a = 900;
    rank.b = 10;
    first();
    await settled();

    expect(started).toEqual(['b']);
  });
});

describe('owesVectors', () => {
  const onScreen = new Set(['a', 'b']);

  it('an on-screen frame owes its vectors until its source is built, even while its poster shows', () => {
    expect(owesVectors(['a', 'b'], onScreen, (id) => id === 'a')).toBe(true);
  });

  it('owes nothing once every on-screen frame is built or shown', () => {
    expect(owesVectors(['a', 'b', 'c'], onScreen, (id) => id !== 'c')).toBe(false);
  });
});
