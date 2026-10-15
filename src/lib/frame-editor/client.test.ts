import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_ACTIONS } from './actions';
import { EDITOR_OPS } from '$lib/server/frame-editor/editor-ops';

const apiCall = vi.fn();
vi.mock('$lib/api/client', () => ({ apiCall: (...a: unknown[]) => apiCall(...a), withOrg: (path: string) => path }));

const { editorAction, editorSessionOf } = await import('./client');

const EDITOR = '/p/p1/c/c1/motion/n1';

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

beforeEach(() => {
  apiCall.mockReset();
});

describe('every editor action names an op the API runs', () => {
  it.each(Object.entries(EDITOR_ACTIONS))('%s', (_, ask) => {
    const asked = ask(form({ doc: '{}', version: '1' }));

    expect('op' in asked && Object.hasOwn(EDITOR_OPS, asked.op)).toBe(true);
  });
});

describe('editorAction posts the action to the node ops over bearer', () => {
  it('sends the op and its input as json', async () => {
    apiCall.mockResolvedValue({ status: 200, body: { head: { version: 4 } } });

    await editorAction(EDITOR, 'restore', form({ version: '3' }));

    expect(apiCall).toHaveBeenCalledWith('/api/v1/motion/n1/ops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'restore_revision', input: { version: 3 } }) });
  });

  it('answers a 200 as the success the page action returned', async () => {
    apiCall.mockResolvedValue({ status: 200, body: { head: { version: 4 } } });

    expect(await editorAction(EDITOR, 'restore', form({ version: '3' }))).toEqual({ type: 'success', status: 200, data: { head: { version: 4 } } });
  });

  it('answers an error status as the failure the page action returned', async () => {
    apiCall.mockResolvedValue({ status: 409, body: { error: 'save_first' } });

    expect(await editorAction(EDITOR, 'render', form({ version: '9' }))).toEqual({ type: 'failure', status: 409, data: { error: 'save_first' } });
  });

  it('refuses a doc that is not json without calling the API', async () => {
    expect(await editorAction(EDITOR, 'save', form({ version: '1', doc: '{' }))).toEqual({ type: 'failure', status: 400, data: { error: 'invalid_doc' } });
    expect(apiCall).not.toHaveBeenCalled();
  });
});

describe('editorSessionOf reads the editor through editor_session', () => {
  it('passes the brief ids and returns the session', async () => {
    apiCall.mockResolvedValue({ status: 200, body: { projectId: 'p1' } });

    expect(await editorSessionOf('n1', ['b1'])).toEqual({ projectId: 'p1' });
    expect(apiCall).toHaveBeenCalledWith('/api/v1/motion/n1/ops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'editor_session', input: { briefIds: ['b1'] } }) });
  });

  it('answers null when the API refuses', async () => {
    apiCall.mockResolvedValue({ status: 404, body: { error: 'motion_node_not_found' } });

    expect(await editorSessionOf('n1', [])).toBeNull();
  });
});
