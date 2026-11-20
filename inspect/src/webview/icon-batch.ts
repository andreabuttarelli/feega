export const PREVIEW_BATCH_DELAY_MS = 40;

export function previewBatcher(send: (names: string[]) => void, has: (name: string) => boolean = () => false) {
  const asked = new Set<string>();
  let batch: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    timer = undefined;
    send(batch);
    batch = [];
  }

  function want(name: string) {
    if (asked.has(name) || has(name)) {
      return;
    }
    asked.add(name);
    batch.push(name);
    timer ??= setTimeout(flush, PREVIEW_BATCH_DELAY_MS);
  }

  return { want };
}
