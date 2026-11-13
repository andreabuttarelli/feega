import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeDebugRows, type DebugRow } from './debug-log-repo';

const row = (seq: number): DebugRow => ({ session: 'sess000001', seq, t_ms: seq * 250, user_id: 'local', org_id: null, canvas_id: 'c1', kind: 'sample', props: { zoom: 1 } });

describe('debug rows in local mode', () => {
  it('append as one JSON line each to a file next to the .feega file', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'flight-')), 'my.feega');

    await writeDebugRows([row(0), row(1)], { FEEGA_LOCAL_FILE: file });
    await writeDebugRows([row(2)], { FEEGA_LOCAL_FILE: file });

    const lines = readFileSync(`${file}.debug.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.map((l) => l.seq)).toEqual([0, 1, 2]);
    expect(lines[0]).toMatchObject({ session: 'sess000001', kind: 'sample', props: { zoom: 1 } });
    expect(typeof lines[0].created_at).toBe('string');
  });
});
