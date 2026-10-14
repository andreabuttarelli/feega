export const PRODUCTION_PROJECT_REF = 'klnswzhhgrqvbfjzioul';
export const TEST_ACCOUNT_EMAIL = 'test@dazero.co';

export enum E2eTarget {
  Production = 'production',
  Disposable = 'disposable'
}

export function targetOf(supabaseUrl: string): E2eTarget {
  if (new URL(supabaseUrl).hostname.startsWith(`${PRODUCTION_PROJECT_REF}.`)) {
    return E2eTarget.Production;
  }
  return E2eTarget.Disposable;
}

export function assertTestAccount(target: E2eTarget, email: string | undefined): void {
  if (target !== E2eTarget.Production) {
    return;
  }
  if (email?.toLowerCase() !== TEST_ACCOUNT_EMAIL) {
    throw new Error(`e2e on production runs only as ${TEST_ACCOUNT_EMAIL}, not ${email ?? 'nobody'}`);
  }
}

export function refuseAdminWrites(target: E2eTarget): void {
  if (target === E2eTarget.Production) {
    throw new Error('e2e refuses to create or delete users and orgs on production');
  }
}
