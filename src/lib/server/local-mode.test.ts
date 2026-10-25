import { describe, expect, it } from 'vitest';
import { localModeRefusal } from './local-mode';

describe('local mode si rifiuta di partire fuori da questa macchina', () => {
  it('spenta, nessun rifiuto', () => {
    expect(localModeRefusal({ PUBLIC_APP_URL: 'https://oh.feega.app' })).toBeNull();
  });

  it.each(['http://localhost:5173', 'http://127.0.0.1:3000', undefined])('accesa su %s parte', (url) => {
    expect(localModeRefusal({ FEEGA_LOCAL_MODE: '1', PUBLIC_APP_URL: url })).toBeNull();
  });

  it('accesa con un URL pubblico, rifiuta', () => {
    expect(localModeRefusal({ FEEGA_LOCAL_MODE: '1', PUBLIC_APP_URL: 'https://oh.feega.app' })).toMatch(/PUBLIC_APP_URL/);
  });

  it('accesa in una build Vercel, rifiuta anche su localhost', () => {
    expect(localModeRefusal({ FEEGA_LOCAL_MODE: '1', PUBLIC_APP_URL: 'http://localhost:5173', VERCEL: '1' })).toMatch(/Vercel/);
  });
});
