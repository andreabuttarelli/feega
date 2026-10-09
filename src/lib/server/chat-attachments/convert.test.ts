import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATTACHMENT_TEXT_CAP, attachmentMarkdown } from './convert';

const fixture = (name: string): ArrayBuffer => {
  const buf = readFileSync(join(__dirname, 'fixtures', name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

describe('attachmentMarkdown', () => {
  it('pdf', async () => {
    expect(await attachmentMarkdown(fixture('brief.pdf'), 'application/pdf', 'brief.pdf')).toMatch(/Quarterly launch brief/);
  });

  it('docx', async () => {
    expect(await attachmentMarkdown(fixture('voice.docx'), '', 'voice.docx')).toMatch(/calm and precise/);
  });

  it('pptx, slide in ordine numerico', async () => {
    const md = await attachmentMarkdown(fixture('deck.pptx'), '', 'deck.pptx');
    expect(md).toMatch(/## Slide 1\n\nOne\nsecond line/);
    expect(md.indexOf('Two & more')).toBeLessThan(md.indexOf('Ten'));
  });

  it('csv come tabella', async () => {
    const md = await attachmentMarkdown(fixture('rows.csv'), 'text/csv', 'rows.csv');
    expect(md).toMatch(/Bottle/);
    expect(md).toMatch(/\|/);
  });

  it('md passa com\'è', async () => {
    expect(await attachmentMarkdown(fixture('notes.md'), 'text/markdown', 'notes.md')).toMatch(/# Notes\n\nShip on Friday\./);
  });

  it('un testo oltre il tetto è troncato con la nota', async () => {
    const long = new TextEncoder().encode('x'.repeat(ATTACHMENT_TEXT_CAP + 500)).buffer as ArrayBuffer;
    const md = await attachmentMarkdown(long, 'text/plain', 'long.txt');
    expect(md.length).toBeLessThan(ATTACHMENT_TEXT_CAP + 200);
    expect(md).toMatch(/Truncated: showing/);
  });
});
