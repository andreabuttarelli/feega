export class FrameStalled extends Error {
  constructor(what: string, ms: number) {
    super(`${what} took longer than ${ms} ms`);
  }
}

export function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FrameStalled(what, ms)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}
