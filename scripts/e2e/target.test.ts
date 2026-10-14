import { describe, expect, it } from 'vitest';
import { E2eTarget, PRODUCTION_PROJECT_REF, TEST_ACCOUNT_EMAIL, assertTestAccount, refuseAdminWrites, targetOf } from './target';

const PRODUCTION_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;

describe('e2e target guards', () => {
  it('recognises the production project by its ref', () => {
    expect(targetOf(PRODUCTION_URL)).toBe(E2eTarget.Production);
    expect(targetOf('http://localhost:54321')).toBe(E2eTarget.Disposable);
    expect(targetOf(`https://other.supabase.co/${PRODUCTION_PROJECT_REF}`)).toBe(E2eTarget.Disposable);
  });

  it('production accepts only the test account', () => {
    expect(() => assertTestAccount(E2eTarget.Production, TEST_ACCOUNT_EMAIL)).not.toThrow();
    expect(() => assertTestAccount(E2eTarget.Production, 'TEST@dazero.co')).not.toThrow();
    expect(() => assertTestAccount(E2eTarget.Production, 'someone@feega.app')).toThrow(/only as/);
    expect(() => assertTestAccount(E2eTarget.Production, undefined)).toThrow(/only as/);
  });

  it('a disposable database accepts any account', () => {
    expect(() => assertTestAccount(E2eTarget.Disposable, 'e2e-shell@feega.app')).not.toThrow();
  });

  it('production refuses admin user and org writes', () => {
    expect(() => refuseAdminWrites(E2eTarget.Production)).toThrow(/refuses/);
    expect(() => refuseAdminWrites(E2eTarget.Disposable)).not.toThrow();
  });
});
