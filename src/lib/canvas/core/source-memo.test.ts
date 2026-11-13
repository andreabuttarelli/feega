import { describe, expect, it } from 'vitest';
import { memoSources } from './source-memo';

describe('frame source memo', () => {
  it('a tier change reuses the source already fetched at this revision', async () => {
    let calls = 0;
    const read = memoSources(async (f: { id: string; revision: number }) => {
      calls++;
      return { doc: f.id };
    });

    await read({ id: 'a', revision: 1 });
    await read({ id: 'a', revision: 1 });

    expect(calls).toBe(1);
  });

  it('a frame sent back to its snapshot is fetched again when it is built again', async () => {
    let calls = 0;
    const read = memoSources(async (f: { id: string; revision: number }) => {
      calls++;
      return { doc: f.id };
    });

    await read({ id: 'a', revision: 1 });
    read.forget('a');
    await read({ id: 'a', revision: 1 });

    expect(calls).toBe(2);
  });

  it('a new revision is fetched again', async () => {
    let calls = 0;
    const read = memoSources(async () => {
      calls++;
      return { doc: 'x' };
    });

    await read({ id: 'a', revision: 1 });
    await read({ id: 'a', revision: 2 });

    expect(calls).toBe(2);
  });

  it('a missing source is not remembered', async () => {
    let calls = 0;
    const read = memoSources(async () => {
      calls++;
      return null;
    });

    await read({ id: 'a', revision: 1 });
    await read({ id: 'a', revision: 1 });

    expect(calls).toBe(2);
  });
});
