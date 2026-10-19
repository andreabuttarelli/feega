export const UPLOAD_BUDGET_MS = 4;

type Ports = { now: () => number; rank: (url: string) => number };

export type UploadQueue = {
  push: (url: string, upload: () => void) => void;
  drain: () => void;
  size: () => number;
};

export function createUploadQueue({ now, rank }: Ports): UploadQueue {
  const waiting = new Map<string, () => void>();

  const nearest = () => {
    let best: string | null = null;
    let bestRank = Infinity;
    for (const url of waiting.keys()) {
      const r = rank(url);
      if (best === null || r < bestRank) {
        best = url;
        bestRank = r;
      }
    }
    return best;
  };

  return {
    push: (url, upload) => waiting.set(url, upload),
    drain() {
      const start = now();
      do {
        const url = nearest();
        if (url === null) {
          return;
        }
        const upload = waiting.get(url)!;
        waiting.delete(url);
        upload();
      } while (now() - start < UPLOAD_BUDGET_MS);
    },
    size: () => waiting.size
  };
}
