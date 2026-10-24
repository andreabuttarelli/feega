const keyOf = (canvasId: string) => `feega:comments-seen:${canvasId}`;

export function readSeen(canvasId: string): string | null {
  try {
    return localStorage.getItem(keyOf(canvasId));
  } catch {
    return null;
  }
}

export function writeSeen(canvasId: string, at: string): void {
  try {
    localStorage.setItem(keyOf(canvasId), at);
  } catch {
    return;
  }
}
