import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { profileFromAuthUser } from './profiles';

const user = (provider: string, metadata: Record<string, unknown>) =>
  ({ id: 'u1', email: 'a@b.co', app_metadata: { provider }, user_metadata: metadata }) as unknown as User;

describe('profileFromAuthUser name', () => {
  it('stores no name for a new GitHub user, whose name is often a nickname', () => {
    expect(profileFromAuthUser(user('github', { name: 'ghopper', user_name: 'ghopper' })).name).toBeNull();
  });

  it('keeps the Google name', () => {
    expect(profileFromAuthUser(user('google', { full_name: 'Grace Hopper' })).name).toBe('Grace Hopper');
  });

  it('keeps the name of other providers', () => {
    expect(profileFromAuthUser(user('email', { name: 'Grace' })).name).toBe('Grace');
  });
});
