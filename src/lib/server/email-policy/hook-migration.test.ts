import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALLOWED_DOMAINS, OWN_BLOCKED_DOMAINS } from './own-blocked-domains';

const MIGRATION = readFileSync('supabase/migrations/20261122100000_block_fake_signups.sql', 'utf8');

describe('migration del hook before-user-created', () => {
  it('semina ogni dominio della lista propria', () => {
    for (const domain of OWN_BLOCKED_DOMAINS) {
      expect(MIGRATION).toContain(`'${domain}'`);
    }
  });

  it('semina ogni dominio della allowlist', () => {
    for (const domain of ALLOWED_DOMAINS) {
      expect(MIGRATION).toContain(`'${domain}'`);
    }
  });

  it('applica la regola a raffica a meno di domini in allowlist', () => {
    expect(MIGRATION).toMatch(/burst_limit constant int := 5/);
    expect(MIGRATION).toMatch(/burst_window constant interval := interval '10 minutes'/);
  });

  it('chiude le tabelle a anon e authenticated', () => {
    expect(MIGRATION).toMatch(/revoke all on public\.blocked_email_domains from anon, authenticated/);
    expect(MIGRATION).toMatch(/revoke all on public\.allowed_email_domains from anon, authenticated/);
  });

  it('concede il hook solo a supabase_auth_admin', () => {
    expect(MIGRATION).toMatch(/grant execute on function public\.hook_before_user_created\(jsonb\) to supabase_auth_admin/);
    expect(MIGRATION).toMatch(/revoke execute on function public\.hook_before_user_created\(jsonb\) from public, anon, authenticated/);
  });

  it('usa lo stesso messaggio generico del form', () => {
    expect(MIGRATION).toContain('Please use a work or personal email address.');
  });
});
