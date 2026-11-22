import { describe, expect, it } from 'vitest';
import { isGithubNickname, namesFromAuth } from './provider-name';

describe('isGithubNickname', () => {
  const github = (metadata: Record<string, unknown>) => ({ app_metadata: { provider: 'github' }, user_metadata: metadata });

  it('flags a stored name equal to the GitHub handle', () => {
    expect(isGithubNickname(github({ user_name: 'ghopper', name: 'Grace Hopper' }), 'ghopper')).toBe(true);
    expect(isGithubNickname(github({ preferred_username: 'ghopper' }), 'GHopper')).toBe(true);
  });

  it('flags a single-word GitHub name, which cannot be first and last', () => {
    expect(isGithubNickname(github({ name: 'grace' }), 'grace')).toBe(true);
  });

  it('accepts a two-word name', () => {
    expect(isGithubNickname(github({ name: 'Grace Hopper', user_name: 'ghopper' }), 'Grace Hopper')).toBe(false);
  });

  it('never flags other providers', () => {
    expect(isGithubNickname({ app_metadata: { provider: 'google' }, user_metadata: { user_name: 'x' } }, 'x')).toBe(false);
  });
});

describe('namesFromAuth', () => {
  it('uses the given and family name Google sends', () => {
    expect(
      namesFromAuth({ app_metadata: { provider: 'google' }, user_metadata: { given_name: 'Ada', family_name: 'Lovelace', full_name: 'Ada King' } })
    ).toEqual({ first: 'Ada', last: 'Lovelace' });
  });

  it('splits a Google full name on the last space when the parts are missing', () => {
    expect(
      namesFromAuth({ app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Mary Ann Evans' } })
    ).toEqual({ first: 'Mary Ann', last: 'Evans' });
  });

  it('falls back to the Google name field', () => {
    expect(namesFromAuth({ app_metadata: { provider: 'google' }, user_metadata: { name: 'Cher' } })).toEqual({ first: 'Cher', last: '' });
  });

  it('uses the Apple name when the first authorization carried it', () => {
    expect(
      namesFromAuth({ app_metadata: { provider: 'apple' }, user_metadata: { full_name: 'Grace Hopper' } })
    ).toEqual({ first: 'Grace', last: 'Hopper' });
  });

  it('uses Apple given and family names when Supabase stores them', () => {
    expect(
      namesFromAuth({ app_metadata: { provider: 'apple' }, user_metadata: { given_name: 'Grace', family_name: 'Hopper' } })
    ).toEqual({ first: 'Grace', last: 'Hopper' });
  });

  it('leaves Apple empty without a name and never reads the relay email', () => {
    expect(
      namesFromAuth({ app_metadata: { provider: 'apple' }, user_metadata: { email: 'x7k2q9@privaterelay.appleid.com' } })
    ).toEqual({ first: '', last: '' });
  });

  it('leaves GitHub empty because its name is often a nickname', () => {
    expect(
      namesFromAuth({ app_metadata: { provider: 'github' }, user_metadata: { name: 'Grace Hopper', full_name: 'Grace Hopper', user_name: 'ghopper' } })
    ).toEqual({ first: '', last: '' });
  });

  it('leaves email sign-ups empty', () => {
    expect(namesFromAuth({ app_metadata: { provider: 'email' }, user_metadata: {} })).toEqual({ first: '', last: '' });
  });

  it('survives missing metadata', () => {
    expect(namesFromAuth({})).toEqual({ first: '', last: '' });
  });
});
