import { describe, expect, test } from 'bun:test';
import { exportAsk } from './export-ask.ts';

describe('feega canvas export', () => {
  test('one row from the flags: a scale by default', () => {
    expect(exportAsk(['a', 'b'], { format: 'jpg', scale: '2', quality: '80' })).toEqual({ frameIds: ['a', 'b'], elements: [], rows: [{ format: 'jpg', by: 'scale', value: 2, suffix: '', quality: 80, transparent: false }] });
  });

  test('a fixed width or height wins over the scale, and a transparent png keeps its suffix', () => {
    expect(exportAsk(['a'], { width: '1200', suffix: '@web', transparent: true }).rows[0]).toEqual({ format: 'png', by: 'width', value: 1200, suffix: '@web', transparent: true });
    expect(exportAsk(['a'], { height: '600' }).rows[0]).toMatchObject({ by: 'height', value: 600 });
  });

  test('frame:element exports one element inside a frame', () => {
    expect(exportAsk(['a', 'b:title'], { format: 'svg' })).toMatchObject({ frameIds: ['a'], elements: [{ frameId: 'b', elementId: 'title' }] });
  });

  test('rows as JSON take every setting at once', () => {
    expect(exportAsk(['a'], { rows: '[{"format":"webp","by":"scale","value":0.5}]' }).rows).toEqual([{ format: 'webp', by: 'scale', value: 0.5 }]);
  });
});
