import { describe, expect, it } from 'vitest';
import { batchRows, outputName, parseCsv, sheetCsvUrl } from './batch';

describe('parseCsv', () => {
  it('reads a header and rows, with quoted commas, escaped quotes and CRLF', () => {
    const csv = 'name,headline\r\n"Rossi, Ada","She said ""hi"""\r\nBo,Plain\r\n';

    expect(parseCsv(csv)).toEqual({ headers: ['name', 'headline'], rows: [{ name: 'Rossi, Ada', headline: 'She said "hi"' }, { name: 'Bo', headline: 'Plain' }] });
  });

  it('a quoted value may span lines; blank lines are skipped', () => {
    expect(parseCsv('a\n"one\ntwo"\n\n').rows).toEqual([{ a: 'one\ntwo' }]);
  });

  it('a tab-separated paste from a spreadsheet reads the same', () => {
    expect(parseCsv('a\tb\n1\t2').rows).toEqual([{ a: '1', b: '2' }]);
  });
});

describe('batchRows', () => {
  it('maps columns onto field keys, leaving unmapped fields at their default', () => {
    const table = parseCsv('Name,Price\nA,10\nB,20');

    expect(batchRows(table, { headline: 'Name', price: 'Price', subtitle: null })).toEqual([{ headline: 'A', price: '10' }, { headline: 'B', price: '20' }]);
  });
});

describe('outputName', () => {
  it('fills the pattern with field values and the row number, as a safe file name', () => {
    expect(outputName('{{n}}-{{headline}}', { headline: 'Summer / Sale!' }, 3)).toBe('003-Summer-Sale');
  });

  it('an empty result falls back to the row number', () => {
    expect(outputName('{{missing}}', {}, 1)).toBe('row-001');
  });
});

describe('sheetCsvUrl', () => {
  it('turns a Google Sheet link into its CSV export, keeping the tab', () => {
    expect(sheetCsvUrl('https://docs.google.com/spreadsheets/d/AbC_1/edit#gid=42')).toBe('https://docs.google.com/spreadsheets/d/AbC_1/export?format=csv&gid=42');
  });

  it('anything else is not a sheet', () => {
    expect(sheetCsvUrl('https://evil.example.com/spreadsheets/d/x')).toBeNull();
  });
});
