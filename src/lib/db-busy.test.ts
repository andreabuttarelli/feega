import { describe, expect, it } from 'vitest';
import { DB_BUSY, busyAnswer } from './db-busy';

describe('busyAnswer', () => {
  it('names a Postgres statement timeout so the canvas can say the database was busy', () => {
    expect(busyAnswer({ code: '57014', message: 'canceling statement due to statement timeout' })).toEqual({ message: DB_BUSY });
  });

  it('leaves every other error to the default answer', () => {
    expect(busyAnswer(new Error('boom'))).toBeUndefined();
  });
});
