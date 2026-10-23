import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSharedFrame = vi.fn();
const duplicateSharedFrame = vi.fn();
const standardTargets = vi.fn();
const toolScope = vi.fn();

vi.mock('$lib/server/canvas/frame-share', () => ({ readSharedFrame: (...a: unknown[]) => readSharedFrame(...a) }));
vi.mock('$lib/server/canvas/frame-duplicate', () => ({ duplicateSharedFrame: (...a: unknown[]) => duplicateSharedFrame(...a) }));
vi.mock('$lib/server/canvas/canvas-share', () => ({ createShareReadDb: () => ({}), signSharedMedia: () => async () => new Map() }));
vi.mock('$lib/server/motion/embed', () => ({ embedPublished: vi.fn() }));
vi.mock('$lib/server/projects/standard-targets', () => ({ standardTargets: (...a: unknown[]) => standardTargets(...a) }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope: (...a: unknown[]) => toolScope(...a) }));

const { load, actions } = await import('./+page.server');

const cookieJar = () => {
  const jar = new Map<string, string>();
  return { jar, api: { set: (k: string, v: string) => jar.set(k, v), get: (k: string) => jar.get(k), delete: (k: string) => jar.delete(k) } };
};

function event(signedIn: boolean, form: Record<string, string> = {}) {
  const body = new FormData();
  Object.entries(form).forEach(([k, v]) => body.set(k, v));
  const cookies = cookieJar();
  return {
    jar: cookies.jar,
    value: {
      params: { token: 'tok', frame: 'f1' },
      setHeaders: vi.fn(),
      cookies: cookies.api,
      request: new Request('https://app.test/s/tok/f1', { method: 'POST', body }),
      locals: { db: async () => ({}), safeGetSession: async () => ({ user: signedIn ? { id: 'u-me' } : null, session: signedIn ? {} : null }) },
      url: new URL('https://app.test/s/tok/f1')
    } as never
  };
}

const FRAME = { canvasName: 'Launch', frameId: 'f1', title: 'Intro', frames: [{ id: 'f1', title: 'Intro' }] };

beforeEach(() => {
  vi.clearAllMocks();
  standardTargets.mockResolvedValue([{ id: 'p-me', name: 'Mine' }]);
  toolScope.mockResolvedValue({ db: {}, orgId: 'org-me', projectId: 'p-me', userId: 'u-me' });
});

describe('/s/[token]/[frame]', () => {
  it('a revoked token or unpublished frame is a 404', async () => {
    readSharedFrame.mockResolvedValue(null);

    await expect(load(event(false).value)).rejects.toMatchObject({ status: 404 });
  });

  it('a live frame renders its embed url and swipe list', async () => {
    readSharedFrame.mockResolvedValue(FRAME);

    await expect(load(event(false).value)).resolves.toMatchObject({ frame: FRAME, embedSrc: '/e/f1?fit=contain', signedIn: false, projects: [] });
    expect(readSharedFrame).toHaveBeenCalledWith(expect.anything(), 'tok', 'f1', expect.any(Function));
  });

  it('a signed-in visitor gets the projects the copy can go into', async () => {
    readSharedFrame.mockResolvedValue(FRAME);

    await expect(load(event(true).value)).resolves.toMatchObject({ signedIn: true, projects: [{ id: 'p-me', name: 'Mine' }] });
  });
});

describe('duplicate', () => {
  it('sends someone without an account to sign in, and brings them back to this frame', async () => {
    const e = event(false);

    await expect(actions.signin(e.value)).rejects.toMatchObject({ status: 303, location: '/login' });
    expect([...e.jar.values()]).toContain('/s/tok/f1');
  });

  it('copies the frame into the chosen project and opens the copy', async () => {
    duplicateSharedFrame.mockResolvedValue({ ok: true, start: {}, editorPath: '/p/p-me/c/c-1/motion/n-1', title: 'Intro' });

    await expect(actions.duplicate(event(true, { project: 'p-me' }).value)).rejects.toMatchObject({ status: 303, location: '/p/p-me/c/c-1/motion/n-1' });
    expect(duplicateSharedFrame).toHaveBeenCalledWith(expect.objectContaining({ target: expect.anything(), source: expect.anything() }), expect.objectContaining({ token: 'tok', frameId: 'f1', orgId: 'org-me', projectId: 'p-me', userId: 'u-me' }));
  });

  it('a link that died is reported, nothing is opened', async () => {
    duplicateSharedFrame.mockResolvedValue({ ok: false, error: 'item_not_found', message: 'This link is no longer shared.' });

    const result = await actions.duplicate(event(true, { project: 'p-me' }).value);

    expect(result).toMatchObject({ status: 404, data: { error: 'This link is no longer shared.' } });
  });

  it('refuses a visitor without an account', async () => {
    await expect(actions.duplicate(event(false, { project: 'p-me' }).value)).rejects.toMatchObject({ status: 303, location: '/login' });
    expect(duplicateSharedFrame).not.toHaveBeenCalled();
  });
});
