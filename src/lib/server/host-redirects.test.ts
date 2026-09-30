import { describe, expect, it } from 'vitest';
import { redirectFor } from './host-redirects';

describe('i domini che rimandano a feega.app', () => {
  it.each(['dalnulla.com', 'www.dalnulla.com', 'r.feega.app'])('%s va su feega.app tenendo il percorso', (host) => {
    expect(redirectFor(new URL(`https://${host}/pricing?ref=x`))).toBe('https://feega.app/pricing?ref=x');
  });

  it('ignora maiuscole e porta', () => {
    expect(redirectFor(new URL('https://DalNulla.com:443/'))).toBe('https://feega.app/');
  });

  it("l'app non rimanda da nessuna parte", () => {
    expect(redirectFor(new URL('https://oh.feega.app/login'))).toBeNull();
  });
});
