import { describe, expect, it } from 'vitest';
import { Account, Arrival, Step, Surface, localViewer, progressOf, stepsFor, surfaceOf, type Viewer } from './flow';

const viewer = (over: Partial<Viewer>): Viewer => ({ surface: Surface.Web, arrival: Arrival.FirstRun, account: Account.SignedIn, name: 'Ada', ...over });

describe('stepsFor', () => {
  it('asks a new web user only for what is missing, then offers the memory import', () => {
    expect(stepsFor(viewer({ name: null }))).toEqual([Step.Name, Step.Memory]);
    expect(stepsFor(viewer({ name: 'Ada' }))).toEqual([Step.Memory]);
  });

  it('asks a returning user for a missing name and nothing else', () => {
    expect(stepsFor(viewer({ arrival: Arrival.Returning, name: '  ' }))).toEqual([Step.Name]);
    expect(stepsFor(viewer({ arrival: Arrival.Returning }))).toEqual([]);
  });

  it('offers an optional sign-in first on this computer, then where the work lives', () => {
    expect(stepsFor(viewer({ surface: Surface.Local, account: Account.None, name: null }))).toEqual([Step.Account, Step.Home, Step.Agents]);
  });

  it('skips the sign-in once connected, and adds name and memory', () => {
    expect(stepsFor(viewer({ surface: Surface.Local, name: null }))).toEqual([Step.Home, Step.Name, Step.Agents, Step.Memory]);
  });

  it('shows nothing on this computer after the first run', () => {
    expect(stepsFor(viewer({ surface: Surface.Local, arrival: Arrival.Returning, account: Account.None, name: null }))).toEqual([]);
  });
});

describe('surfaceOf', () => {
  it('reads local mode before the desktop shell, which also opens local files', () => {
    expect(surfaceOf({ local: true, userAgent: 'Mozilla FeegaNative/1.2.0' })).toBe(Surface.Local);
    expect(surfaceOf({ local: false, userAgent: 'Mozilla FeegaNative/1.2.0' })).toBe(Surface.Desktop);
    expect(surfaceOf({ local: false, userAgent: 'Mozilla Safari' })).toBe(Surface.Web);
  });
});

describe('localViewer', () => {
  it('is a first run until this computer has seen the flow', () => {
    expect(localViewer({ seenAt: null, account: null }).arrival).toBe(Arrival.FirstRun);
    expect(localViewer({ seenAt: '2026-11-18T10:00:00Z', account: null }).arrival).toBe(Arrival.Returning);
  });

  it('carries the connected account name', () => {
    expect(localViewer({ seenAt: null, account: { email: 'a@b.co', name: 'Ada' } })).toMatchObject({ account: Account.SignedIn, name: 'Ada' });
  });
});

describe('progressOf', () => {
  it('fills the bar on the last step', () => {
    expect(progressOf(0, 2)).toBe(0.5);
    expect(progressOf(1, 2)).toBe(1);
  });
});
