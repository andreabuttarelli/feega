import { describe, expect, it } from 'vitest';
import { signToken, TokenCheck, verifyToken, type TokenClaims } from './token';

const SECRET = 'test-secret';
const CLAIMS: TokenClaims = {
  sid: 'abcdefghij',
  role: 'editor',
  sub: '11111111-1111-4111-8111-111111111111',
  org: '22222222-2222-4222-8222-222222222222',
  exp: 1_800_000_000
};
const VECTOR =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOiJhYmNkZWZnaGlqIiwicm9sZSI6ImVkaXRvciIsInN1YiI6IjExMTExMTExLTExMTEtNDExMS04MTExLTExMTExMTExMTExMSIsIm9yZyI6IjIyMjIyMjIyLTIyMjItNDIyMi04MjIyLTIyMjIyMjIyMjIyMiIsImV4cCI6MTgwMDAwMDAwMH0.jcsUJ7TYvgqL_pecYfmZeSvmMTY9xjDMRPX203yadLg';
const BEFORE_EXPIRY_MS = 1_799_999_999_000;
const AT_EXPIRY_MS = 1_800_000_000_000;

describe('cloud token', () => {
  it('signs to the fixed vector shared with the relay', async () => {
    expect(await signToken(CLAIMS, SECRET)).toBe(VECTOR);
  });

  it('verifies the fixed vector', async () => {
    expect(await verifyToken(VECTOR, SECRET, BEFORE_EXPIRY_MS)).toEqual({ check: TokenCheck.Valid, claims: CLAIMS });
  });

  it('rejects a token signed with another secret', async () => {
    expect(await verifyToken(VECTOR, 'other-secret', BEFORE_EXPIRY_MS)).toEqual({ check: TokenCheck.BadSignature });
  });

  it('rejects a token whose payload was changed', async () => {
    const [header, , signature] = VECTOR.split('.');
    const forged = btoa(JSON.stringify({ ...CLAIMS, role: 'host' })).replace(/=+$/, '');

    expect(await verifyToken(`${header}.${forged}.${signature}`, SECRET, BEFORE_EXPIRY_MS)).toEqual({ check: TokenCheck.BadSignature });
  });

  it('rejects an expired token at the expiry second', async () => {
    expect(await verifyToken(VECTOR, SECRET, AT_EXPIRY_MS)).toEqual({ check: TokenCheck.Expired });
  });

  it('rejects malformed input', async () => {
    expect(await verifyToken('a.b', SECRET)).toEqual({ check: TokenCheck.Malformed });
    expect(await verifyToken('a.b.c!', SECRET)).toEqual({ check: TokenCheck.Malformed });
  });

  it('rejects a genuine signature over claims with an unknown role', async () => {
    const token = await signToken({ ...CLAIMS, role: 'admin' as never }, SECRET);

    expect(await verifyToken(token, SECRET, BEFORE_EXPIRY_MS)).toEqual({ check: TokenCheck.BadClaims });
  });
});
