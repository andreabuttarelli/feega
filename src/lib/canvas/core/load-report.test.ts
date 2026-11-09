import { describe, expect, it } from 'vitest';
import { loadReport } from './load-report';

const mark = (name: string, startTime: number) => ({ name, startTime });
const resource = (name: string, startTime: number, responseEnd: number, transferSize: number, initiatorType = 'fetch') => ({ name, startTime, responseEnd, transferSize, encodedBodySize: transferSize, initiatorType });

describe('loadReport', () => {
  it('mette in fila per frame i passi, le immagini e le richieste delle sorgenti', () => {
    const report = loadReport({
      marks: [mark('frame|asked|a', 100), mark('frame|whole|a:1:256', 900), mark('frame|images|a', 300), mark('frame|thumb|a:1:thumb', 50), mark('frame|all-vectors|all', 600), mark('frame|sharp|all', 1500)],
      resources: [resource('https://x/p/1/c/2/motion/sources?ids=a,b', 120, 400, 5000), resource('https://img/a.png', 310, 700, 2000, 'img'), resource('https://img/other.png', 0, 10, 99, 'img')],
      images: new Map([['a', ['https://img/a.png']]]),
      navigation: { responseEnd: 80, domContentLoadedEventEnd: 90 }
    });

    expect(report.frames[0]).toMatchObject({ id: 'a', steps: { asked: 100, whole: 900, thumb: 50 }, images: { count: 1, bytes: 2000, lastEnd: 700 } });
    expect(report.sources).toEqual([{ ids: 2, start: 120, end: 400, bytes: 5000 }]);
    expect(report.totals).toMatchObject({ frames: 1, sourceBytes: 5000, imageBytes: 2000, lastContent: 900, allVectors: 600, sharp: 1500 });
  });
});
