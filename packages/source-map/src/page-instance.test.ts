import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { targetOf } from './bridge.js';

const SOURCE = 'src/A.jsx:4:5';

const doc = () => new JSDOM(`<body><ul>${['a', 'b', 'c'].map((t) => `<li data-feega-src="${SOURCE}">${t}</li>`).join('')}</ul></body>`).window.document;

describe('targetOf by selector', () => {
  it('finds the first instance of a repeated element without an index', () => {
    expect(targetOf(doc(), { selector: `[data-feega-src="${SOURCE}"]` })?.textContent).toBe('a');
  });

  it('finds the instance the index names', () => {
    expect(targetOf(doc(), { selector: `[data-feega-src="${SOURCE}"]`, index: 2 })?.textContent).toBe('c');
  });
});
