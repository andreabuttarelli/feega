import { describe, expect, it } from 'vitest';
import { CrashRecorder, SAMPLE_EVERY_MS, blankSample, type Shelf } from './crash-record';

class MemoryShelf implements Shelf {
  readonly items = new Map<string, string>();
  writes = 0;
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

const sampled = (zoom: number) => ({ ...blankSample(), zoom });

describe('the crash record', () => {
  it('finds nothing to report on a first visit', () => {
    expect(new CrashRecorder(new MemoryShelf()).begin()).toBeNull();
  });

  it('reports the last sample of a session that never ended cleanly', () => {
    const shelf = new MemoryShelf();
    const crashed = new CrashRecorder(shelf);
    crashed.begin();
    crashed.sample(sampled(2.5), 0);

    const report = new CrashRecorder(shelf).begin();

    expect(report?.zoom).toBe(2.5);
  });

  it('reports nothing after a session hidden cleanly', () => {
    const shelf = new MemoryShelf();
    const left = new CrashRecorder(shelf);
    left.begin();
    left.sample(sampled(2.5), 0);
    left.endCleanly();

    expect(new CrashRecorder(shelf).begin()).toBeNull();
  });

  it('reports a crash only once', () => {
    const shelf = new MemoryShelf();
    const crashed = new CrashRecorder(shelf);
    crashed.begin();
    crashed.sample(sampled(1), 0);

    new CrashRecorder(shelf).begin();

    expect(new CrashRecorder(shelf).begin()).toBeNull();
  });

  it('a page shown again after hiding counts as open, so a crash after it is caught', () => {
    const shelf = new MemoryShelf();
    const back = new CrashRecorder(shelf);
    back.begin();
    back.endCleanly();
    back.resume();
    back.sample(sampled(3), 0);

    expect(new CrashRecorder(shelf).begin()?.zoom).toBe(3);
  });

  it('writes at most once per sampling period', () => {
    const shelf = new MemoryShelf();
    const recorder = new CrashRecorder(shelf);
    recorder.begin();
    const before = shelf.writes;

    for (let t = 0; t < SAMPLE_EVERY_MS * 4; t += 16) {
      recorder.sample(sampled(t), t);
    }

    expect(shelf.writes - before).toBe(4);
  });

  it('survives a shelf that throws', () => {
    const broken: Shelf = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      }
    };
    const recorder = new CrashRecorder(broken);

    expect(recorder.begin()).toBeNull();
    expect(() => recorder.sample(sampled(1), 0)).not.toThrow();
    expect(() => recorder.endCleanly()).not.toThrow();
  });
});
