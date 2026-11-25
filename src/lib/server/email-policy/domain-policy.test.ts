import { describe, expect, it } from 'vitest';
import { DomainVerdict, signupVerdict, type DomainLists } from './domain-policy';
import { OWN_BLOCKED_DOMAINS } from './own-blocked-domains';

const lists: DomainLists = {
  allowed: new Set(['trusted.example']),
  blocked: new Set(['bad.example']),
  disposable: new Set(['throwaway.example', 'trusted.example'])
};

describe('signupVerdict', () => {
  it('lascia passare un dominio sconosciuto', () => {
    expect(signupVerdict('ada@gmail.com', lists)).toBe(DomainVerdict.Allowed);
  });

  it('blocca un dominio nella lista propria', () => {
    expect(signupVerdict('x@bad.example', lists)).toBe(DomainVerdict.Blocked);
  });

  it('blocca un dominio usa-e-getta', () => {
    expect(signupVerdict('x@throwaway.example', lists)).toBe(DomainVerdict.Disposable);
  });

  it('ignora maiuscole e spazi', () => {
    expect(signupVerdict('  X@BAD.Example ', lists)).toBe(DomainVerdict.Blocked);
  });

  it('blocca i sottodomini di un dominio bloccato', () => {
    expect(signupVerdict('x@mail.bad.example', lists)).toBe(DomainVerdict.Blocked);
  });

  it('non confonde un dominio che finisce con lo stesso testo', () => {
    expect(signupVerdict('x@notbad.example', lists)).toBe(DomainVerdict.Allowed);
  });

  it('la allowlist vince sulle liste di blocco', () => {
    expect(signupVerdict('x@trusted.example', lists)).toBe(DomainVerdict.Allowed);
  });

  it('un indirizzo senza dominio non e valido per la policy', () => {
    expect(signupVerdict('nodomain', lists)).toBe(DomainVerdict.Blocked);
  });
});

describe('liste incluse', () => {
  it('bloccano gli otto domini dell attacco di novembre 2026', () => {
    for (const domain of OWN_BLOCKED_DOMAINS) {
      expect(signupVerdict(`a@${domain}`)).toBe(DomainVerdict.Blocked);
    }

    expect(OWN_BLOCKED_DOMAINS).toHaveLength(8);
  });

  it('bloccano un dominio usa-e-getta noto', () => {
    expect(signupVerdict('a@0-mail.com')).toBe(DomainVerdict.Disposable);
  });

  it('non bloccano i provider normali', () => {
    for (const domain of ['gmail.com', 'outlook.com', 'icloud.com', 'proton.me']) {
      expect(signupVerdict(`a@${domain}`)).toBe(DomainVerdict.Allowed);
    }
  });
});
