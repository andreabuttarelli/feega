import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { focusPage } from './focus.js';

const CARD = 'src/Card.tsx:4:5';

const dom = (body: string, head = '') => new JSDOM(`<!doctype html><html class="dark"><head>${head}</head><body class="app">${body}</body></html>`).window.document;

const cards = `<div id="root"><main data-feega-src="src/App.tsx:3:1"><section data-feega-src="src/App.tsx:5:1">
  <article data-feega-src="${CARD}"><h2 data-feega-src="src/Card.tsx:5:7">One</h2></article>
  <article data-feega-src="${CARD}"><h2 data-feega-src="src/Card.tsx:5:7">Two</h2></article>
</section><footer data-feega-src="src/App.tsx:9:1">Footer</footer></main></div>`;

describe('focusPage', () => {
  it('counts every instance of the component of the element', () => {
    expect(focusPage(dom(cards), 'src/Card.tsx:5:7').count).toBe(2);
  });

  it('shows the instances and nothing else of the page', () => {
    const { body } = focusPage(dom(cards), 'src/Card.tsx:5:7');

    expect(body).toContain('One');
    expect(body).toContain('Two');
    expect(body).not.toContain('Footer');
  });

  it('keeps the source attribute on the elements that tell what the component is used in, and on no other ancestor', () => {
    const { body } = focusPage(dom(cards), 'src/Card.tsx:4:5');

    expect(body).toContain('data-feega-src="src/App.tsx:5:1"');
    expect(body).not.toContain('data-feega-src="src/App.tsx:3:1"');
  });

  it('puts instances that share a parent under one parent', () => {
    const { body } = focusPage(dom(cards), 'src/Card.tsx:4:5');

    expect(body.match(/src\/App\.tsx:5:1/g)).toHaveLength(1);
  });

  it('copies the stylesheets and the classes of html and body', () => {
    const page = dom(cards, '<style>.card{color:red}</style><link rel="stylesheet" href="/a.css"><script src="/x.js"></script>');
    const parts = focusPage(page, CARD);

    expect(parts.head).toContain('.card{color:red}');
    expect(parts.head).toContain('href="/a.css"');
    expect(parts.head).not.toContain('<script');
    expect(parts.htmlAttrs.class).toBe('dark');
    expect(parts.bodyAttrs.class).toBe('app');
  });

  it('is empty for a source that is not on the page', () => {
    expect(focusPage(dom(cards), 'src/Gone.tsx:1:1').count).toBe(0);
  });

  it('takes the style rules a script inserted without text', () => {
    const page = dom(cards, '<style id="s"></style>');
    page.getElementById('s')!.sheet!.insertRule('.x{color:blue}');

    expect(focusPage(page, CARD).head).toContain('.x');
  });
});
