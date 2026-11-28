import { describe, expect, it } from 'vitest';
import { emptyText, Preview, previewOf } from './preview-load';

describe('previewOf', () => {
  it('is loading while the page has not finished loading', () => {
    expect(previewOf({ bridged: false, pageLoaded: false, graceOver: false })).toBe(Preview.Loading);
  });

  it('keeps loading after the page loaded until the bridge had its grace period', () => {
    expect(previewOf({ bridged: false, pageLoaded: true, graceOver: false })).toBe(Preview.Loading);
  });

  it('reports a missing source map only after the page loaded and the grace ran out', () => {
    expect(previewOf({ bridged: false, pageLoaded: true, graceOver: true })).toBe(Preview.NoBridge);
  });

  it('is ready once the bridge connects, whatever else is set', () => {
    expect(previewOf({ bridged: true, pageLoaded: false, graceOver: true })).toBe(Preview.Ready);
  });
});

describe('emptyText', () => {
  it('never claims the source map is missing while the page is loading', () => {
    expect(emptyText(Preview.Loading)).not.toMatch(/source map/);
    expect(emptyText(Preview.NoBridge)).toMatch(/source map/);
  });
});
