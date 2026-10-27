import { describe, expect, it } from 'vitest';
import { VarType, checkVarValue, checkVarValues, varDecl } from './code-vars';

describe('una variabile dichiarata', () => {
  it('la forma completa porta tipo e metadati', () => {
    expect(varDecl('gap', { type: 'range', min: 0, max: 64, step: 4, default: 24, label: 'Gap' })).toEqual({
      name: 'gap',
      type: VarType.Range,
      min: 0,
      max: 64,
      step: 4,
      default: 24,
      label: 'Gap'
    });
  });

  it('la scorciatoia dà il tipo dal nome della funzione', () => {
    expect(varDecl('accent', '#ff5100', VarType.Color)).toMatchObject({ type: VarType.Color, default: '#ff5100' });
    expect(varDecl('title', 'Build faster')).toMatchObject({ type: VarType.Text, default: 'Build faster' });
  });

  it('un tipo sconosciuto non è una dichiarazione', () => {
    expect(varDecl('x', { type: 'vector', default: 1 })).toBeNull();
  });
});

describe('un valore contro il suo tipo', () => {
  const range = varDecl('gap', { type: 'range', min: 0, max: 64, step: 4, default: 24 })!;

  it('un range si stringe ai limiti e al passo', () => {
    expect(checkVarValue(range, 99)).toEqual({ ok: true, value: 64 });
    expect(checkVarValue(range, 10)).toEqual({ ok: true, value: 12 });
  });

  it('un colore deve essere esadecimale', () => {
    const accent = varDecl('accent', '#ff5100', VarType.Color)!;
    expect(checkVarValue(accent, '#00AA11')).toEqual({ ok: true, value: '#00aa11' });
    expect(checkVarValue(accent, 'red').ok).toBe(false);
  });

  it('una select accetta solo le sue opzioni', () => {
    const plan = varDecl('plan', { type: 'select', options: ['monthly', 'yearly'], default: 'monthly' })!;
    expect(checkVarValue(plan, 'yearly').ok).toBe(true);
    expect(checkVarValue(plan, 'weekly')).toMatchObject({ ok: false, error: expect.stringContaining('monthly, yearly') });
  });

  it('booleano, numero, testo, immagine', () => {
    expect(checkVarValue(varDecl('on', true, VarType.Boolean)!, 'yes').ok).toBe(false);
    expect(checkVarValue(varDecl('n', 3, VarType.Number)!, '3').ok).toBe(false);
    expect(checkVarValue(varDecl('t', 'a')!, 'una riga\naltra').ok).toBe(false);
    expect(checkVarValue(varDecl('t', 'a', VarType.LongText)!, 'una riga\naltra').ok).toBe(true);
    expect(checkVarValue(varDecl('img', 'https://x.io/a.png', VarType.Image)!, 'javascript:alert(1)').ok).toBe(false);
  });

  it('checkVarValues rifiuta un valore per una variabile mai dichiarata', () => {
    expect(checkVarValues([range], { gap: 8, ghost: 'x' })).toMatchObject({ ok: false, error: expect.stringContaining('ghost') });
    expect(checkVarValues([range], { gap: 8 })).toEqual({ ok: true, values: { gap: 8 } });
    expect(checkVarValues([range], { gap: 99 })).toMatchObject({ ok: false, error: expect.stringContaining('0') });
  });
});
