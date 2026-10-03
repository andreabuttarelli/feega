import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { load } from './+page.server';

describe('the old uncensored workspace URL', () => {
  it('redirects to the project settings, where uncensored is now a switch', async () => {
    let thrown: unknown;
    try {
      await (load as (e: unknown) => Promise<unknown>)({ params: { projectId: 'proj-1' } });
    } catch (error) {
      thrown = error;
    }
    expect(isRedirect(thrown) && thrown.location).toBe('/p/proj-1/settings/project');
  });
});
