import { describe, expect, it } from 'vitest';
import { PropsSource } from '../props-source';
import { Badge, REASON_MAX, badgeOf, reasonOf, statusOf } from './canvas-card';

describe('statusOf', () => {
  it('reads a ready report with its size and the props it was drawn with', () => {
    expect(statusOf({ type: 'feega:mount:status', status: 'ready', size: { width: 200, height: 90 }, props: { a: 1 } })).toEqual({ kind: 'ready', size: { width: 200, height: 90 }, props: { a: 1 } });
  });

  it('reads a failed report with a one-line reason', () => {
    expect(statusOf({ type: 'feega:mount:status', status: 'failed', reason: 'Cannot read properties of undefined\n\n\tin <unknown>' })).toEqual({ kind: 'failed', reason: 'Cannot read properties of undefined' });
  });

  it('ignores anything else', () => {
    expect(statusOf({ type: 'other' })).toBeNull();
    expect(statusOf(null)).toBeNull();
    expect(statusOf({ type: 'feega:mount:status', status: 'error', reason: 'late' })).toBeNull();
  });

  it('reads a ready report without a usable size as ready with no size', () => {
    expect(statusOf({ type: 'feega:mount:status', status: 'ready', size: { width: 0, height: 0 } })).toEqual({ kind: 'ready', size: null, props: {} });
  });
});

describe('reasonOf', () => {
  it('keeps the first line and caps it', () => {
    expect(reasonOf('a'.repeat(REASON_MAX + 50)).length).toBeLessThanOrEqual(REASON_MAX + 1);
  });

  it('says something when there is no reason', () => {
    expect(reasonOf(undefined)).not.toBe('');
  });
});

describe('badgeOf', () => {
  it('says the props come from the code when a use of the component gave them', () => {
    expect(badgeOf({ props: { a: 1 }, source: PropsSource.Code }, { a: 1 })).toBe(Badge.Code);
  });

  it('says the props are sample ones when only the types gave them', () => {
    expect(badgeOf(undefined, { title: 'title' })).toBe(Badge.Sample);
  });

  it('has no badge when the component took no props', () => {
    expect(badgeOf(undefined, {})).toBeNull();
    expect(badgeOf(undefined, undefined)).toBeNull();
  });
});
