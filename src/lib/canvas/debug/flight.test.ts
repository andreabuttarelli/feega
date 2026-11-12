import { describe, expect, it } from 'vitest';
import { flightNote, startFlight } from './flight';

const tab = () => {
  const kept = new Map<string, string>();
  return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) };
};

const place = { canvasId: 'c1', device: 'phone', crash: {}, read: () => ({}) };

describe('the flight recorder', () => {
  it('does not start for a canvas opened without ?debug', () => {
    expect(startFlight(place, { on: false, tab: tab() })).toBeNull();
    expect(() => flightNote('error', { message: 'x' })).not.toThrow();
  });

  it('does not start where the tab has no storage', () => {
    expect(startFlight(place, { on: true, tab: null })).toBeNull();
  });
});
