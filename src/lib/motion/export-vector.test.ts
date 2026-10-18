// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { freezePage, printDocument, svgDocument } from './export-vector';

describe('vector export', () => {
  it('freezes a drawn page: no scripts left, the pose kept inline, text still text', () => {
    document.body.innerHTML = '<div id="root"><h1 style="transform: translateX(12px)">Big sale</h1><script>tick()</script></div>';
    const html = freezePage(document);

    expect(html).not.toContain('<script');
    expect(html).toContain('translateX(12px)');
    expect(html).toContain('>Big sale<');
    expect(html).toContain('xmlns="http://www.w3.org/1999/xhtml"');
  });

  it('an SVG holds the frozen page as live text at the asked size, cropped to an element when asked', () => {
    const svg = svgDocument('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Hi &amp; bye</p></body></html>', { width: 1080, height: 1350 }, { scale: 2 });

    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="2160" height="2700" viewBox="0 0 1080 1350">/);
    expect(svg).toContain('<foreignObject x="0" y="0" width="1080" height="1350">');
    expect(svg).toContain('<p>Hi &amp; bye</p>');

    const cropped = svgDocument('<p>Hi</p>', { width: 1080, height: 1350 }, { scale: 1, crop: { left: 100, top: 50, width: 200, height: 80 } });
    expect(cropped).toContain('width="200" height="80" viewBox="100 50 200 80"');
  });

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
