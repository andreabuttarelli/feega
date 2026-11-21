import { describe, expect, it } from 'vitest';
import { namesFromAuth } from './provider-name';

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
