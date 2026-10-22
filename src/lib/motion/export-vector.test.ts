import { describe, expect, it } from 'vitest';
import { printDocument } from './export-vector';

describe('vector export', () => {
  it('prints one page per frame, each at its own size', () => {
    const html = printDocument([
      { html: '<p>One</p>', width: 1080, height: 1080 },
      { html: '<p>Two</p>', width: 1920, height: 1080 }
    ]);

    expect(html).toContain('@page p0 { size: 1080px 1080px; margin: 0 }');
    expect(html).toContain('@page p1 { size: 1920px 1080px; margin: 0 }');
    expect(html.match(/<iframe/g)).toHaveLength(2);
    expect(html).toContain('srcdoc="&lt;p&gt;One&lt;/p&gt;"');
  });
});
