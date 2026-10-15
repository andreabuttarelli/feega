const FRESH_MS = 2_000;

type Entry = { value: unknown; json: string; at: number; revalidating: boolean };

export class SwrCache {
  private entries = new Map<string, Entry>();

  constructor(private now: () => number = Date.now) {}

  async read<T>(key: string, fetcher: () => Promise<T>, onFresh: () => void): Promise<T> {
    const entry = this.entries.get(key);
    if (!entry) {
      return this.store(key, await fetcher());
    }

    if (!entry.revalidating && this.now() - entry.at > FRESH_MS) {
      this.revalidate(key, entry, fetcher, onFresh);
    }
    return entry.value as T;
  }

  clear(): void {
    this.entries.clear();
  }

  private store<T>(key: string, value: T): T {
    this.entries.set(key, { value, json: JSON.stringify(value), at: this.now(), revalidating: false });
    return value;
  }

  private revalidate<T>(key: string, entry: Entry, fetcher: () => Promise<T>, onFresh: () => void): void {
    entry.revalidating = true;
    fetcher().then(
      (value) => {
        const changed = JSON.stringify(value) !== entry.json;
        this.store(key, value);
        if (changed) {
          onFresh();
        }
      },
      () => {
        entry.revalidating = false;
      }
    );
  }
}
