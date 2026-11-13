import { describe, expect, it } from 'vitest';
import { paintFirst } from './paint-first';

function painter() {
  const waiting: (() => void)[] = [];
  return { later: (job: () => void) => waiting.push(job), paint: () => waiting.splice(0).forEach((job) => job()) };
}

describe('paint first', () => {
  it('a rebuild held for the paint starts after it, once, with the newest edit', () => {
    const p = painter();
    const ran: string[] = [];
    const rebuild = paintFirst(p.later, (id: string, doc: string) => ran.push(`${id}:${doc}`));
    rebuild.afterPaint('frame', 'first');
    rebuild.afterPaint('frame', 'second');
    expect(ran).toEqual([]);
    p.paint();
    expect(ran).toEqual(['frame:second']);
  });

  it('a rebuild started now drops the older one still held for the paint', () => {
    const p = painter();
    const ran: string[] = [];
    const rebuild = paintFirst(p.later, (id: string, doc: string) => ran.push(`${id}:${doc}`));
    rebuild.afterPaint('frame', 'patched');
    rebuild.now('frame', 'rebuilt');
    p.paint();
    expect(ran).toEqual(['frame:rebuilt']);
  });

  it('frames held for the same paint each start their own rebuild', () => {
    const p = painter();
    const ran: string[] = [];
    const rebuild = paintFirst(p.later, (id: string, doc: string) => ran.push(`${id}:${doc}`));
    rebuild.afterPaint('a', '1');
    rebuild.afterPaint('b', '2');
    p.paint();
    expect(ran).toEqual(['a:1', 'b:2']);
  });
});
