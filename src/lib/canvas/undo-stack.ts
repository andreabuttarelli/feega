export type UndoStack<T> = {
  push: (entry: T) => void;
  pushPending: (landing: Promise<T | null>) => void;
  popUndo: () => Promise<T | null>;
  popRedo: () => T | null;
  pushRedo: (entry: T) => void;
  pushUndo: (entry: T) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

export function createUndoStack<T>(): UndoStack<T> {
  const undo: Promise<T | null>[] = [];
  const redo: T[] = [];

  function pushPending(landing: Promise<T | null>) {
    undo.push(landing.catch(() => null));
    redo.length = 0;
  }

  async function popUndo(): Promise<T | null> {
    while (undo.length) {
      const entry = await undo.pop()!;
      if (entry !== null) {
        return entry;
      }
    }
    return null;
  }

  return {
    push: (entry: T) => pushPending(Promise.resolve(entry)),
    pushPending,
    popUndo,
    popRedo: () => redo.pop() ?? null,
    pushRedo: (entry: T) => redo.push(entry),
    pushUndo: (entry: T) => undo.push(Promise.resolve(entry)),
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0
  };
}
