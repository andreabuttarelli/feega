import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pidFile } from './pid-file';

const COMMAND = 'electron cli.cjs /app --no-open';
const NOT_EXISTING_PID = 2147483000;

const fresh = () => mkdtempSync(join(tmpdir(), 'feega-pids-'));

describe('pid file', () => {
  it('sweeps only processes whose command still matches what we recorded', () => {
    const dir = fresh();
    const pids = pidFile(dir, (pid) => (pid === NOT_EXISTING_PID ? COMMAND : 'something else entirely'));
    pids.add({ pid: NOT_EXISTING_PID, command: COMMAND });
    pids.add({ pid: NOT_EXISTING_PID - 1, command: COMMAND });

    expect(pids.sweep()).toEqual([NOT_EXISTING_PID]);
  });

  it('forgets a process that exited', () => {
    const dir = fresh();
    const pids = pidFile(dir, () => COMMAND);
    pids.add({ pid: NOT_EXISTING_PID, command: COMMAND });
    pids.remove(NOT_EXISTING_PID);

    expect(pids.sweep()).toEqual([]);
  });

  it('starts empty after a sweep', () => {
    const dir = fresh();
    const pids = pidFile(dir, () => COMMAND);
    pids.add({ pid: NOT_EXISTING_PID, command: COMMAND });
    pids.sweep();

    expect(JSON.parse(readFileSync(join(dir, 'pids.json'), 'utf8'))).toEqual([]);
  });
});
