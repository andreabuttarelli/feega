import { describe, expect, it } from 'vitest';
import { ColumnAxis, SETTINGS_COLUMN, withSettingsColumn } from './settings-column';

const bases = new Map([
  ['feed', { w: 400, h: 300, settings: true }],
  ['text', { w: 200, h: 100 }]
]);

const node = (id: string, selected: boolean) => ({ id, selected, data: {} as Record<string, unknown> });

describe('la colonna delle impostazioni allarga il nodo sorgente selezionato', () => {
  it('un nodo sorgente selezionato si allarga della colonna, accanto', () => {
    const next = withSettingsColumn([node('feed', true)], bases, ColumnAxis.Beside)!;
    expect(next[0]).toMatchObject({ width: 400 + SETTINGS_COLUMN.w, height: 300, data: { growth: { w: SETTINGS_COLUMN.w, h: 0 } } });
  });

  it('su schermo stretto la colonna va sotto e il nodo si allunga', () => {
    const next = withSettingsColumn([node('feed', true)], bases, ColumnAxis.Below)!;
    expect(next[0]).toMatchObject({ width: 400, height: 300 + SETTINGS_COLUMN.h });
  });

  it('deselezionato torna alla larghezza della sola anteprima', () => {
    const wide = withSettingsColumn([node('feed', true)], bases, ColumnAxis.Beside)!;
    const next = withSettingsColumn([{ ...wide[0], selected: false }], bases, ColumnAxis.Beside)!;
    expect(next[0]).toMatchObject({ width: 400, height: 300, data: { growth: { w: 0, h: 0 } } });
  });

  it('un nodo senza impostazioni non si tocca', () => {
    expect(withSettingsColumn([node('text', true)], bases, ColumnAxis.Beside)).toBeNull();
  });

  it('niente da cambiare restituisce null, così la tela non si ridisegna', () => {
    const wide = withSettingsColumn([node('feed', true)], bases, ColumnAxis.Beside)!;
    expect(withSettingsColumn(wide, bases, ColumnAxis.Beside)).toBeNull();
  });
});
