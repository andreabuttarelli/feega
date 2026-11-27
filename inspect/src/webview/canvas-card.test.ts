import { describe, expect, it } from 'vitest';
import { FAILED_TEXT, NOTHING_TEXT, REASON_MAX, failedTextOf, reasonOf, statusOf } from './canvas-card';

describe('statusOf', () => {
  it('reads a ready report with its size and the props it was drawn with', () => {
    expect(statusOf({ type: 'feega:mount:status', status: 'ready', size: { width: 200, height: 90 }, props: { a: 1 } })).toEqual({ kind: 'ready', size: { width: 200, height: 90 }, props: { a: 1 }, controls: null });
  });

  it('reads a failed report with a one-line reason', () => {
    expect(statusOf({ type: 'feega:mount:status', status: 'failed', reason: 'Cannot read properties of undefined\n\n\tin <unknown>' })).toEqual({ kind: 'failed', reason: 'Cannot read properties of undefined' });
  });

  it('reads the props a failed component declares', () => {
    expect(statusOf({ type: 'feega:mount:controls', controls: [{ name: 'title', kind: 'text', required: true }] })).toEqual({ kind: 'controls', controls: [{ name: 'title', kind: 'text', required: true }] });
    expect(statusOf({ type: 'feega:mount:controls', controls: null })).toEqual({ kind: 'controls', controls: null });
  });

  it('ignores anything else', () => {
    expect(statusOf({ type: 'other' })).toBeNull();
    expect(statusOf(null)).toBeNull();
    expect(statusOf({ type: 'feega:mount:status', status: 'error', reason: 'late' })).toBeNull();
  });

  it('reads a ready report without a usable size as ready with no size', () => {
    expect(statusOf({ type: 'feega:mount:status', status: 'ready', size: { width: 0, height: 0 } })).toEqual({ kind: 'ready', size: null, props: {}, controls: null });
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

describe('failedTextOf', () => {
  it('says a component that drew nothing is not broken, it just has nothing to show', () => {
    expect(failedTextOf('It rendered nothing')).toBe(NOTHING_TEXT);
  });

  it('asks for props for any other failure', () => {
    expect(failedTextOf("Cannot read properties of undefined (reading 'length')")).toBe(FAILED_TEXT);
  });
});
