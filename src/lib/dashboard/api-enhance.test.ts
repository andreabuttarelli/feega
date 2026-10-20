import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/forms', () => ({ applyAction: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidate: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$lib/api/page-action', () => ({ hasTwin: vi.fn(), postPageAction: vi.fn() }));

const { actionTarget } = await import('./api-enhance');

describe('which page action a dashboard form posts to', () => {
  it('a relative action is on the current page', () => {
    expect(actionTarget('?/upgrade', '/app/credits')).toEqual({ pathname: '/app/credits', action: 'upgrade' });
  });

  it('an absolute action names its page', () => {
    expect(actionTarget('/app?/project', '/app/canvases')).toEqual({ pathname: '/app', action: 'project' });
  });

  it('a plain route is not a page action', () => {
    expect(actionTarget('/auth/signout', '/app')).toBeNull();
  });
});
