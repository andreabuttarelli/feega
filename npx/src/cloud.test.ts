import { describe, expect, it } from 'vitest';
import { relayUrlOf } from './cloud';

describe('relayUrlOf', () => {
  it('uses the local relay unless FEEGA_RELAY_URL says otherwise', () => {
    expect(relayUrlOf({})).toBe('ws://127.0.0.1:8787/host');
    expect(relayUrlOf({ FEEGA_RELAY_URL: 'wss://relay.example.test/host' })).toBe('wss://relay.example.test/host');
  });
});
