import { describe, expect, it } from 'vitest';
import { LOCKED_GLOBALS, lockdown } from './lockdown';

describe('lockdown', () => {
  it('removes every way out of the sandbox', () => {
    const scope: Record<string, unknown> = Object.fromEntries(LOCKED_GLOBALS.map((name) => [name, () => 'open']));
    scope.keep = 1;
    lockdown(scope);
    for (const name of LOCKED_GLOBALS) {
      expect(scope[name], name).toBeUndefined();
    }
    expect(scope.keep).toBe(1);
  });

  it('cannot be undone by the plugin', () => {
    const scope: Record<string, unknown> = { fetch: () => 'open' };
    lockdown(scope);
    expect(() => {
      'use strict';
      scope.fetch = () => 'open';
    }).toThrow();
  });

  it('closes the network, storage, nested workers and script loading', () => {
    expect(LOCKED_GLOBALS).toEqual(expect.arrayContaining(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'Worker', 'SharedWorker', 'BroadcastChannel', 'WebTransport']));
  });
});
