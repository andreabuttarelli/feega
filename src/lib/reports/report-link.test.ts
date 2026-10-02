import { describe, expect, it } from 'vitest';
import { reportHref } from './report-link';

describe('reportHref', () => {
  it('points at the form with no target', () => {
    expect(reportHref({})).toBe('/report');
  });

  it('carries the share token and the node', () => {
    expect(reportHref({ share: 'tok', node: 'n-1' })).toBe('/report?share=tok&node=n-1');
  });

  it('carries the canvas from inside the app', () => {
    expect(reportHref({ canvas: 'c-1', node: 'n-1' })).toBe('/report?canvas=c-1&node=n-1');
  });
});
