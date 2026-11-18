import { describe, it, expect } from 'vitest';
import { toMarkdown } from './markdown';

function textBuf(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer;
}

describe('toMarkdown', () => {
  it('passes .txt files through with normalized newlines', async () => {
    const { markdown } = await toMarkdown(textBuf('Hello\r\nWorld  '), 'text/plain', 'notes.txt');
    expect(markdown).toBe('Hello\nWorld');
  });

  it('passes .md files through unchanged (modulo whitespace trim)', async () => {
    const { markdown } = await toMarkdown(textBuf('# Title\r\n\r\nBody text.\n'), 'text/markdown', 'doc.md');
    expect(markdown).toBe('# Title\n\nBody text.');
  });

  it('converts .csv to a markdown table', async () => {
    const { markdown } = await toMarkdown(textBuf('a,b\n1,2\n3,4'), 'text/csv', 'data.csv');
    expect(markdown).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |');
  });

  it('truncates large CSVs and notes the truncation', async () => {
    const rows = ['h1,h2', ...Array.from({ length: 250 }, (_, i) => `${i},${i}`)];
    const { markdown } = await toMarkdown(textBuf(rows.join('\n')), 'text/csv', 'big.csv');
    expect(markdown).toContain('Truncated: showing first 50 of 251 rows.');
  });

  it('converts HTML via markitdown-ts (or turndown fallback)', async () => {
    const { markdown } = await toMarkdown(
      textBuf('<html><body><h1>Hello</h1><p>World</p></body></html>'),
      'text/html',
      'page.html'
    );
    expect(markdown).toMatch(/Hello/);
    expect(markdown).toMatch(/World/);
  });
});
