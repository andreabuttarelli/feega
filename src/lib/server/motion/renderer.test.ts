import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('@vercel/sandbox', () => ({ Sandbox: {} }));

import { motionRenderFarm } from './renderer';

describe('motion render farm', () => {
  it('off Vercel and without a sandbox token there is no farm: the editor offers the browser export only', () => {
    expect(motionRenderFarm({})).toBeNull();
  });

  it('a deployment on Vercel renders on sandboxes with its own identity', () => {
    expect(motionRenderFarm({ VERCEL: '1' })).not.toBeNull();
  });

  it('a local checkout with a token, team and project renders on sandboxes too', () => {
    expect(motionRenderFarm({ VERCEL_TOKEN: 't', VERCEL_TEAM_ID: 'team', VERCEL_PROJECT_ID: 'p' })).not.toBeNull();
  });
});
