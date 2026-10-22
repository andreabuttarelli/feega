import { describe, expect, it } from 'vitest';
import { Pasted, clipboardHtml, readPaste } from './system-clipboard';

const tiles = { nodes: [{ type: 'text', data: { text: 'hi' }, dx: 0, dy: 0 }], edges: [], freeIds: [] };

describe('system clipboard', () => {
  it('round-trips a feega payload through text/html', () => {
    const html = clipboardHtml({ tiles });
    expect(readPaste({ html, text: '', files: [] })).toEqual({ kind: Pasted.Feega, payload: { tiles } });
  });

  it('round-trips non-latin text in the payload', () => {
    const payload = { tiles: { ...tiles, nodes: [{ ...tiles.nodes[0], data: { text: 'città ✓ 漢' } }] } };
    expect(readPaste({ html: clipboardHtml(payload), text: '', files: [] })).toEqual({ kind: Pasted.Feega, payload });
  });

  it('reads svg markup from plain text before plain text', () => {
    const svg = '<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
    expect(readPaste({ html: '', text: svg, files: [] })).toEqual({ kind: Pasted.Svg, svg });
  });

  it('reads a png file as an image', () => {
    const png = { type: 'image/png', name: 'a.png' };
    expect(readPaste({ html: '', text: '', files: [png] })).toEqual({ kind: Pasted.Image, file: png });
  });

  it('recognises a figma clipboard', () => {
    const html = '<meta charset="utf-8"><span data-metadata="<!--(figmeta)eyJ9(/figmeta)-->"></span><span data-buffer="<!--(figma)ZmlnLWtpd2k=(/figma)-->"></span>';
    expect(readPaste({ html, text: '', files: [] })).toEqual({ kind: Pasted.Figma });
  });

  it('falls back to plain text, and to nothing when empty', () => {
    expect(readPaste({ html: '<b>hi</b>', text: 'hi', files: [] })).toEqual({ kind: Pasted.Text, text: 'hi' });
    expect(readPaste({ html: '', text: '  ', files: [] })).toBeNull();
  });
});
