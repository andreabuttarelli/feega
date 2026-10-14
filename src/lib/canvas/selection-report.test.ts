import { describe, expect, it } from 'vitest';
import { ReportChange, reportChange } from './selection-report';

const box = { x: 10, y: 20, width: 100, height: 50 };
const empty = { ids: [], box: null, zoom: 1 };

describe('reportChange', () => {
  it('ignores a pan or zoom with nothing selected, so the toolbar is not rebuilt every frame', () => {
    expect(reportChange(empty, { ...empty, zoom: 0.5 })).toBe(ReportChange.None);
  });

  it('moves only the box when a selection is panned', () => {
    expect(reportChange({ ids: ['a'], box, zoom: 1 }, { ids: ['a'], box: { ...box, x: 40 }, zoom: 1 })).toBe(ReportChange.Box);
  });

  it('reports the box when only the zoom changed', () => {
    expect(reportChange({ ids: ['a'], box, zoom: 1 }, { ids: ['a'], box, zoom: 2 })).toBe(ReportChange.Box);
  });

  it('reports nothing for an identical selection', () => {
    expect(reportChange({ ids: ['a'], box, zoom: 1 }, { ids: ['a'], box: { ...box }, zoom: 1 })).toBe(ReportChange.None);
  });

  it('reports new ids when the selection itself changed', () => {
    expect(reportChange({ ids: ['a'], box, zoom: 1 }, { ids: ['a', 'b'], box, zoom: 1 })).toBe(ReportChange.Ids);
    expect(reportChange({ ids: ['a'], box, zoom: 1 }, empty)).toBe(ReportChange.Ids);
  });
});
