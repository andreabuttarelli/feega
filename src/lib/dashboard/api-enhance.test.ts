import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ applyAction: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidate: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$lib/api/page-action', () => ({ hasTwin: vi.fn(), postPageAction: vi.fn() }));

const { actionTarget } = await import('./api-enhance');

describe('which page action a dashboard form posts to', () => {
  it('a relative action is on the current page', () => {
    expect(actionTarget('?/subscribe', '/app/credits')).toEqual({ pathname: '/app/credits', action: 'subscribe' });
  });

  it('an absolute action names its page', () => {
    expect(actionTarget('/app?/project', '/app/canvases')).toEqual({ pathname: '/app', action: 'project' });
  });

  it('a plain route is not a page action', () => {
    expect(actionTarget('/auth/signout', '/app')).toBeNull();
  });
});

describe('a dashboard form posts once per submission', () => {
  function fakeForm() {
    let listener: (event: unknown) => Promise<void> = async () => {};
    const form = {
      getAttribute: () => '?/subscribe',
      addEventListener: (_: string, fn: typeof listener) => (listener = fn),
      removeEventListener: () => {},
      reset: () => {}
    };
    const submit = () => listener({ preventDefault: () => {}, submitter: null });
    return { form, submit };
  }

  it('a second click while the first is still on its way does not post again', async () => {
    const { hasTwin, postPageAction } = await import('$lib/api/page-action');
    vi.mocked(hasTwin).mockReturnValue(true);
    let land: (r: unknown) => void = () => {};
    vi.mocked(postPageAction).mockReturnValue(new Promise((done) => (land = done)) as never);
    vi.stubGlobal('location', { pathname: '/app/credits', href: 'https://dashboard/app/credits', origin: 'https://dashboard' });
    vi.stubGlobal('FormData', class {});
    const { apiEnhance } = await import('./api-enhance');
    const { form, submit } = fakeForm();
    apiEnhance(form as never);

    const first = submit();
    const second = submit();
    land({ type: 'success', status: 200 });
    await Promise.all([first, second]);
    vi.mocked(postPageAction).mockResolvedValue({ type: 'success', status: 200 } as never);
    await submit();

    expect(postPageAction).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
