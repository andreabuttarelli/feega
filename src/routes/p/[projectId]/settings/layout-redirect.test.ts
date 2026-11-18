import { describe, expect, it, vi } from 'vitest';

const loadSettingsShell = vi.fn(async () => ({ shell: true }));
vi.mock('$lib/settings/api', () => ({ loadSettingsShell }));

const { load } = await import('./+layout');

function loadUrl(path: string) {
  const url = new URL(`https://feega.test${path}`);
  Object.defineProperty(url, 'hash', {
    get() {
      throw new Error('Cannot access event.url.hash');
    }
  });
  return url;
}

function run(path: string) {
  return (load as (e: unknown) => unknown)({ params: { projectId: 'p1' }, url: loadUrl(path), depends: () => {} });
}

describe('an old canvas settings URL', () => {
  it('redirects a dashboard section to /app/settings, keeping the query', () => {
    expect(() => run('/p/p1/settings/profile?tab=memory')).toThrowError(expect.objectContaining({ status: 307, location: '/app/settings/profile?tab=memory' }));
  });

  it('redirects team to the existing team page', () => {
    expect(() => run('/p/p1/settings/team')).toThrowError(expect.objectContaining({ location: '/app/team' }));
  });

  it('keeps a project section on the canvas', async () => {
    expect(await run('/p/p1/settings/project')).toEqual({ shell: true });
    expect(await run('/p/p1/settings/spend')).toEqual({ shell: true });
  });
});
