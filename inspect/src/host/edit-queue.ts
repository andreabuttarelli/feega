export function editQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  function run<T>(task: () => Promise<T> | T): Promise<T> {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  }

  return { run };
}
