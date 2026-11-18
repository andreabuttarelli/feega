import { describe, expect, it } from 'vitest';
import { LIVE_FIELDS, LiveProp, Side, classOf, editBody, fieldValue, pickOf, previewOf } from './live-fields';

const field = (key: string) => LIVE_FIELDS.find((f) => f.key === key)!;

const RESULT = {
  source: { file: 'app/Hero.tsx', line: 6, col: 7 },
  rect: { x: 10, y: 20, width: 300, height: 60 },
  styles: { color: 'rgb(0, 0, 0)', 'padding-left': '16px', 'font-weight': '600' },
  classes: 'text-5xl font-semibold text-black px-4',
  text: 'Ship faster'
};

describe('live fields', () => {
  it('una risposta del bridge diventa una selezione con file:line:col', () => {
    expect(pickOf(RESULT)?.source).toBe('app/Hero.tsx:6:7');
    expect(pickOf(null)).toBeNull();
  });

  it('ogni campo legge lo stile calcolato, il testo legge il testo', () => {
    const pick = pickOf(RESULT)!;
    expect(fieldValue(field('color'), pick)).toBe('rgb(0, 0, 0)');
    expect(fieldValue(field('px'), pick)).toBe('16px');
    expect(fieldValue(field('text'), pick)).toBe('Ship faster');
  });

  it('il token mostrato è la classe del codice per quel campo', () => {
    const pick = pickOf(RESULT)!;
    expect(classOf(field('color'), pick.classes)).toBe('text-black');
    expect(classOf(field('size'), pick.classes)).toBe('text-5xl');
    expect(classOf(field('px'), pick.classes)).toBe('px-4');
    expect(classOf(field('gap'), pick.classes)).toBeNull();
  });

  it('l anteprima applica subito lo stesso valore, in px per i numeri', () => {
    expect(previewOf(field('py'), '24')).toEqual({ style: { 'padding-top': '24px', 'padding-bottom': '24px' } });
    expect(previewOf(field('text'), 'Ship today')).toEqual({ text: 'Ship today' });
  });

  it('la richiesta porta prop, lato e valore', () => {
    const pick = pickOf(RESULT)!;
    expect(editBody(pick, field('px'), '24')).toEqual({ at: 'app/Hero.tsx:6:7', prop: LiveProp.Padding, side: Side.X, value: '24px', was: '16px' });
    expect(editBody(pick, field('text'), 'Ship today')).toMatchObject({ prop: LiveProp.Text, value: 'Ship today', was: 'Ship faster' });
  });
});
