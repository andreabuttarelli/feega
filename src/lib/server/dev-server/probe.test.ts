import { describe, expect, it } from 'vitest';
import { candidateUrls, findRunning, servesFolder } from './probe';

describe('servesFolder', () => {
  it('vale solo se il processo in ascolto lavora dentro la cartella aperta', async () => {
    const cwdOf = async (port: number) => (port === 3000 ? '/work/site' : '/work/other');
    expect(await servesFolder('http://localhost:3000', '/work/site', cwdOf)).toBe(true);
    expect(await servesFolder('http://localhost:5174', '/work/site', cwdOf)).toBe(false);
  });

  it('una cartella con lo stesso prefisso non conta', async () => {
    expect(await servesFolder('http://localhost:3000', '/work/site', async () => '/work/site-old')).toBe(false);
  });
});

describe('candidateUrls', () => {
  it('prova prima l indirizzo configurato e salta la porta di Feega', () => {
    const urls = candidateUrls({ configured: 'http://localhost:4000', self: 3001 });
    expect(urls[0]).toBe('http://localhost:4000');
    expect(urls).not.toContain('http://localhost:3001');
    expect(urls).toContain('http://localhost:3000');
  });
});

describe('findRunning', () => {
  it('restituisce il primo che risponde', async () => {
    const up = new Set(['http://localhost:5174']);
    expect(await findRunning(['http://localhost:3000', 'http://localhost:5174'], async (u) => up.has(u))).toBe('http://localhost:5174');
  });

  it('null se nessuno risponde', async () => {
    expect(await findRunning(['http://localhost:3000'], async () => false)).toBeNull();
  });
});
