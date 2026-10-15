import { describe, expect, it } from 'vitest';
import { actionResultOf, liveActionResultOf, loadedOf } from './answers';

describe('what an API answer means to a dashboard page', () => {
  it('a load answer is its data', () => {
    expect(loadedOf(200, { data: { a: 1 } })).toEqual({ a: 1 });
  });

  it('a load redirect becomes a SvelteKit redirect', () => {
    expect(() => loadedOf(200, { redirect: '/p/p1/c/c1' })).toThrow(expect.objectContaining({ status: 303, location: '/p/p1/c/c1' }));
  });

  it('a load error keeps its status and message', () => {
    expect(() => loadedOf(404, { error: 'Create a project first' })).toThrow(expect.objectContaining({ status: 404, body: { message: 'Create a project first' } }));
  });

  it('an expired session is sent to login', () => {
    expect(() => loadedOf(401, { error: 'invalid_token' })).toThrow(expect.objectContaining({ status: 303, location: '/login' }));
  });

  it('an action redirect, failure and success map to the ActionResult a form expects', () => {
    expect(actionResultOf(200, { redirect: '/p/p1/c/c1' })).toEqual({ type: 'redirect', status: 303, location: '/p/p1/c/c1' });
    expect(actionResultOf(400, { error: 'Paste a URL or describe your video' })).toEqual({ type: 'failure', status: 400, data: { error: 'Paste a URL or describe your video' } });
    expect(actionResultOf(200, { data: { ok: true } })).toEqual({ type: 'success', status: 200, data: { ok: true } });
  });

  it('an expired session during an action is sent to login', () => {
    expect(actionResultOf(401, { error: 'invalid_token' })).toEqual({ type: 'redirect', status: 303, location: '/login' });
  });

  it('a server error during a live action stays an error, with the message the page reads', () => {
    expect(liveActionResultOf(500, { message: 'db_busy' })).toEqual({ type: 'error', status: 500, error: { message: 'db_busy' } });
    expect(liveActionResultOf(409, { conflict: true, keys: ['prompt'] })).toEqual({ type: 'failure', status: 409, data: { conflict: true, keys: ['prompt'] } });
  });
});
