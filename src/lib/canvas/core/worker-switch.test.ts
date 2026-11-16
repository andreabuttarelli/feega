import { describe, expect, it } from 'vitest';
import { coreWorkerOn } from './worker-switch';

describe('core worker switch', () => {
  it('stays off unless the page asks for it', () => {
    expect(coreWorkerOn('')).toBe(false);
    expect(coreWorkerOn('?coreTiles=1')).toBe(false);
    expect(coreWorkerOn('?coreWorker=0')).toBe(false);
    expect(coreWorkerOn('?coreWorker=1')).toBe(true);
  });
});
