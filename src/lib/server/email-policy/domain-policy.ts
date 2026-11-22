import disposable from './disposable-domains.json';
import { ALLOWED_DOMAINS, OWN_BLOCKED_DOMAINS } from './own-blocked-domains';

export const BLOCKED_SIGNUP_MESSAGE = 'Please use a work or personal email address.';

export enum DomainVerdict {
  Allowed = 'allowed',
  Blocked = 'blocked',
  Disposable = 'disposable'
}

export type DomainLists = {
  allowed: ReadonlySet<string>;
  blocked: ReadonlySet<string>;
  disposable: ReadonlySet<string>;
};

const DEFAULT_LISTS: DomainLists = {
  allowed: new Set(ALLOWED_DOMAINS),
  blocked: new Set(OWN_BLOCKED_DOMAINS),
  disposable: new Set(disposable)
};

const VERDICT_BY_LIST: readonly (readonly [keyof DomainLists, DomainVerdict])[] = [
  ['allowed', DomainVerdict.Allowed],
  ['blocked', DomainVerdict.Blocked],
  ['disposable', DomainVerdict.Disposable]
];

function domainOf(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  const domain = normalized.slice(at + 1);
  return at > 0 && domain.includes('.') ? domain : null;
}

function suffixesOf(domain: string): string[] {
  const labels = domain.split('.');
  return labels.map((_, start) => labels.slice(start).join('.')).filter((suffix) => suffix.includes('.'));
}

export function signupVerdict(email: string, lists: DomainLists = DEFAULT_LISTS): DomainVerdict {
  const domain = domainOf(email);
  if (!domain) {
    return DomainVerdict.Blocked;
  }

  const suffixes = suffixesOf(domain);
  for (const [list, verdict] of VERDICT_BY_LIST) {
    if (suffixes.some((suffix) => lists[list].has(suffix))) {
      return verdict;
    }
  }

  return DomainVerdict.Allowed;
}
