import { describe, expect, it, vi } from 'vitest';

const loadSettingsShell = vi.fn(async (): Promise<{ shell: boolean; brand: { id: string } | null }> => ({ shell: true, brand: { id: 'b1' } }));
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
  it('redirects a dashboard section to /app/settings, keeping the query', async () => {
    await expect(run('/p/p1/settings/profile?tab=memory')).rejects.toMatchObject({ status: 307, location: '/app/settings/profile?tab=memory' });
  });

  it('redirects team to the existing team page', async () => {
    await expect(run('/p/p1/settings/team')).rejects.toMatchObject({ location: '/app/team' });
  });

  it('sends a brand section to the dashboard page of the project brand', async () => {
    await expect(run('/p/p1/settings/video?x=1')).rejects.toMatchObject({ status: 307, location: '/app/settings/brands/b1/video?x=1' });
    await expect(run('/p/p1/settings/brand')).rejects.toMatchObject({ location: '/app/settings/brands/b1/brand' });
  });

  it('sends a brand section to the brand list when the project has no brand', async () => {
    loadSettingsShell.mockResolvedValueOnce({ shell: true, brand: null });

    await expect(run('/p/p1/settings/danger')).rejects.toMatchObject({ status: 307, location: '/app/settings/brands' });
  });

  it('keeps a project section on the canvas', async () => {
    expect(await run('/p/p1/settings/project')).toMatchObject({ shell: true });
    expect(await run('/p/p1/settings/spend')).toMatchObject({ shell: true });
  });
});
