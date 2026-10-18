import { afterEach, describe, expect, it, vi } from 'vitest';
import { localStore, sessionStore } from './browser-storage';

const working = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browser storage on the server and in the browser', () => {
  it('Node 25 exposes a localStorage with no methods during server render: no store, no crash', () => {
    vi.stubGlobal('localStorage', {});
    vi.stubGlobal('sessionStorage', {});
    expect(localStore()).toBeNull();
    expect(sessionStore()).toBeNull();
  });

  it('a missing storage is no store', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(localStore()).toBeNull();
  });

  it('a storage that throws on access is no store', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
    expect(localStore()).toBeNull();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('a real storage is used', () => {
    vi.stubGlobal('localStorage', working);
    expect(localStore()).toBe(working);
  });
});
