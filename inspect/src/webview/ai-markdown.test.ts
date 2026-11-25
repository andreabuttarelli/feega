import { describe, expect, it } from 'vitest';
import { markdown } from './ai-markdown';

describe('the chat markdown', () => {
  it('escapes raw html so an agent cannot inject markup', () => {
    expect(markdown('<img src=x onerror=alert(1)>')).not.toContain('<img');
    expect(markdown('<script>x</script>')).toContain('&lt;script&gt;');
  });

  it('renders code fences without touching their content', () => {
    expect(markdown('```ts\nconst a = **1**;\n```')).toBe('<pre><code>const a = **1**;</code></pre>');
  });

  it('renders inline code, bold and italic', () => {
    expect(markdown('use `npm i` **now** and *later*')).toBe('<p>use <code>npm i</code> <strong>now</strong> and <em>later</em></p>');
  });

  it('links only http and https urls', () => {
    expect(markdown('[a](https://feega.app)')).toContain('<a href="https://feega.app"');
    expect(markdown('[a](javascript:alert(1))')).not.toContain('href');
  });

  it('renders lists and headings', () => {
    expect(markdown('# T\n- a\n- b')).toBe('<h4>T</h4><ul><li>a</li><li>b</li></ul>');
  });

  it('separates paragraphs on a blank line', () => {
    expect(markdown('a\n\nb')).toBe('<p>a</p><p>b</p>');
  });
});
