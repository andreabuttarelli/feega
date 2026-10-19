import { describe, expect, it } from 'vitest';
import { canvasActionOf } from './canvas-answers';

describe('what a canvas API answer means to the canvas page', () => {
  it('a success is the body, unwrapped', () => {
    expect(canvasActionOf(200, { node: { id: 'n1' } })).toEqual({ type: 'success', status: 200, data: { node: { id: 'n1' } } });
  });

  it('a redirect body and an expired session navigate', () => {
    expect(canvasActionOf(200, { redirect: '/p/p1/c/c2' })).toEqual({ type: 'redirect', status: 303, location: '/p/p1/c/c2' });
    expect(canvasActionOf(401, { error: 'invalid_token' })).toEqual({ type: 'redirect', status: 303, location: '/login' });
  });

  it('a refusal keeps its status and body, conflict keys included', () => {
    expect(canvasActionOf(409, { conflict: true, keys: ['prompt'] })).toEqual({ type: 'failure', status: 409, data: { conflict: true, keys: ['prompt'] } });
  });

  it('a server error stays an error with its message, so a busy database is told apart', () => {
    expect(canvasActionOf(503, { error: 'db_busy' })).toEqual({ type: 'error', status: 503, error: { message: 'db_busy' } });
  });
});
