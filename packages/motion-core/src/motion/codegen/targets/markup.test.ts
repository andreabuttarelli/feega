import { describe, expect, it } from 'vitest';
import { jsxSvg } from './markup';

describe('raw HTML inside an SVG as JSX', () => {
  const raw = '<foreignObject width="10"><div class="fls" style="position:absolute;inset:0;--tone:#fff"><img class="fl-image" src="/a.png" alt=""></div></foreignObject>';

  it('self-closes void elements', () => {
    expect(jsxSvg(raw)).toContain('<img className="fl-image" src="/a.png" alt="" />');
  });

  it('turns inline style into a style object, which HTML elements honour', () => {
    expect(jsxSvg(raw)).toContain(`style={{ position: 'absolute', inset: '0', '--tone': '#fff' }}`);
  });

  it('keeps a semicolon inside a url() together', () => {
    expect(jsxSvg('<div style="background:url(data:image/png;base64,AA)"></div>')).toContain(`style={{ background: 'url(data:image/png;base64,AA)' }}`);
  });
});
