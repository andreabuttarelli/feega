import { describe, expect, it } from 'vitest';
import { PhoneSheetKind, PhoneSheets } from './phone-sheets.svelte';

describe('phone sheets', () => {
  it('one sheet at a time: opening another replaces it', () => {
    const sheets = new PhoneSheets();
    sheets.toggle(PhoneSheetKind.Layers);
    sheets.toggle(PhoneSheetKind.Insert);
    expect(sheets.shown).toBe(PhoneSheetKind.Insert);
  });

  it('the same tab twice closes it', () => {
    const sheets = new PhoneSheets();
    sheets.toggle(PhoneSheetKind.Layers);
    sheets.toggle(PhoneSheetKind.Layers);
    expect(sheets.shown).toBeNull();
  });

  it('closing a sheet that is not shown leaves the shown one alone', () => {
    const sheets = new PhoneSheets();
    sheets.toggle(PhoneSheetKind.Chat);
    sheets.close(PhoneSheetKind.Layers);
    expect(sheets.shown).toBe(PhoneSheetKind.Chat);
  });
});
