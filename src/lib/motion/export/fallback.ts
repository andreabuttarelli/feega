export async function orFallback<T>(first: () => Promise<T>, fallback: (() => Promise<T>) | null, signal: AbortSignal, onFallback: (error: unknown) => void = () => {}): Promise<T> {
  try {
    return await first();
  } catch (error) {
    if (!fallback || signal.aborted) {
      throw error;
    }
    onFallback(error);
    return fallback();
  }
}
