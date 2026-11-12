import { describe, expect, it } from 'vitest';
import { LAST_LINES, rowsOf, timeline } from './debug-timeline.mjs';

const row = (seq: number, kind = 'sample', props: object = { zoom: 2 }) => ({ session: 's1', seq, t_ms: seq * 250, kind, props });

describe('the debug timeline', () => {
  it('reads a JSON array, JSON lines and a CSV export with a quoted props column', () => {
    const json = JSON.stringify([row(1), row(0)]);
    const jsonl = [row(0), row(1)].map((r) => JSON.stringify(r)).join('\n');
    const csv = 'session,seq,t_ms,kind,props\ns1,1,250,sample,"{""zoom"": 2}"\ns1,0,0,start,"{""ua"": ""a, b""}"';

    expect(rowsOf(json).map((r) => r.seq)).toEqual([1, 0]);
    expect(rowsOf(jsonl)).toHaveLength(2);
    expect(rowsOf(csv)[1]).toEqual({ session: 's1', seq: 0, t_ms: 0, kind: 'start', props: { ua: 'a, b' } });
  });

  it('orders by seq, marks lost lines and the end without a pagehide', () => {
    const out = timeline(JSON.stringify([row(3), row(0, 'start'), row(1)]));

    expect(out).toMatch(/1 lost/);
    expect(out.indexOf('start')).toBeLessThan(out.indexOf('-- 1 line lost --'));
    expect(out).toMatch(/no pagehide/);
  });

  it('highlights the last lines before the end', () => {
    const rows = Array.from({ length: LAST_LINES + 10 }, (_, i) => row(i));
    const lines = timeline(JSON.stringify(rows)).split('\n');

    expect(lines.filter((l) => l.startsWith('>>'))).toHaveLength(LAST_LINES);
    expect(lines.at(-1)).toMatch(/^>>/);
  });
});
