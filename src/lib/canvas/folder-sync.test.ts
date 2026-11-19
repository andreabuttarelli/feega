import { describe, expect, it } from 'vitest';
import { fieldLabel, shownValue, unsavedLine, valueKind, ValueKind } from './folder-sync';

describe('folder sync wording', () => {
  it('names a field without its data prefix', () => {
    expect(fieldLabel('data.color')).toBe('color');
    expect(fieldLabel('position')).toBe('position');
    expect(fieldLabel('*')).toBe('deleted on one side');
  });

  it('shows a removed value and cuts long ones', () => {
    expect(shownValue(null)).toBe('(removed)');
    expect(shownValue('x'.repeat(100))).toBe(`"${'x'.repeat(57)}…`);
    expect(shownValue({ a: 1 })).toBe('{"a":1}');
  });

  it('says when the folder changed', () => {
    expect(unsavedLine('2026-11-19T09:05:00.000Z', 'UTC')).toBe('Not saved to .feega/ since 09:05');
  });
});

describe('how a conflict value is shown', () => {
  it.each([
    ['#2563eb', ValueKind.Color],
    ['rgb(10, 20, 30)', ValueKind.Color],
    ['https://cdn.test/hero.png', ValueKind.Image],
    ['data:image/svg+xml;base64,AAAA', ValueKind.Image],
    ['/local/storage/canvas-assets/a.webp?x=1', ValueKind.Image],
    ['Ship it', ValueKind.Text],
    [null, ValueKind.Removed],
    [{ a: 1 }, ValueKind.Text]
  ])('%s is %s', (value, kind) => {
    expect(valueKind(value)).toBe(kind);
  });
});
