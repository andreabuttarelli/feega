import { describe, expect, it } from 'vitest';
import { pageActionOf } from './page-answers';

describe('what a page answer over bearer means to its client', () => {
  it('a success is the body, unwrapped', () => {
    expect(pageActionOf(200, { node: { id: 'n1' } })).toEqual({ type: 'success', status: 200, data: { node: { id: 'n1' } } });
  });

  it('a redirect body and an expired session navigate', () => {
    expect(pageActionOf(200, { redirect: '/p/p1/c/c2' })).toEqual({ type: 'redirect', status: 303, location: '/p/p1/c/c2' });
    expect(pageActionOf(401, { error: 'invalid_token' })).toEqual({ type: 'redirect', status: 303, location: '/login' });
  });

  it('a refusal keeps its status and body, conflict keys included', () => {
    expect(pageActionOf(409, { conflict: true, keys: ['prompt'] })).toEqual({ type: 'failure', status: 409, data: { conflict: true, keys: ['prompt'] } });
  });

  it('a server error stays an error with its message, so a busy database is told apart', () => {
    expect(pageActionOf(503, { error: 'db_busy' })).toEqual({ type: 'error', status: 503, error: { message: 'db_busy' } });
  });
});
