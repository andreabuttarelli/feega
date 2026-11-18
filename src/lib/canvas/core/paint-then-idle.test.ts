import { describe, expect, it } from 'vitest';
import { paintThenIdle } from './paint-then-idle';

describe('paintThenIdle', () => {
  it('runs the job only in an idle slot after the next painted frame', () => {
    const painted: (() => void)[] = [];
    const idle: (() => void)[] = [];
    const ran: string[] = [];
    const later = paintThenIdle((job) => painted.push(job), (job) => idle.push(job));

    later(() => ran.push('views'));
    idle.splice(0).forEach((job) => job());
    expect(ran).toEqual([]);

    painted.splice(0).forEach((job) => job());
    expect(ran).toEqual([]);

    idle.splice(0).forEach((job) => job());
    expect(ran).toEqual(['views']);
  });
});
