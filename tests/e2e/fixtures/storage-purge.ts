export type StorageEntry = { name: string; folder: boolean };

export type StoragePort = {
  buckets(): Promise<string[]>;
  list(bucket: string, prefix: string): Promise<StorageEntry[]>;
  remove(bucket: string, paths: string[]): Promise<void>;
};

async function filesUnder(storage: StoragePort, bucket: string, prefix: string): Promise<string[]> {
  const entries = await storage.list(bucket, prefix);
  const nested = await Promise.all(entries.map((e) => (e.folder ? filesUnder(storage, bucket, `${prefix}/${e.name}`) : [`${prefix}/${e.name}`])));
  return nested.flat();
}

export async function purgeStorage(storage: StoragePort, prefixes: readonly string[]): Promise<number> {
  let removed = 0;
  for (const bucket of await storage.buckets()) {
    for (const prefix of prefixes) {
      const files = await filesUnder(storage, bucket, prefix);
      if (!files.length) {
        continue;
      }
      await storage.remove(bucket, files);
      removed += files.length;
    }
  }
  return removed;
}
