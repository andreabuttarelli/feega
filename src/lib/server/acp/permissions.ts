import type { PermissionOutcome } from './client';

const waiting = new Map<string, (outcome: PermissionOutcome) => void>();

const CANCELLED: PermissionOutcome = { outcome: 'cancelled' };

export function awaitChoice(id: string, signal: AbortSignal): Promise<PermissionOutcome> {
  return new Promise((done) => {
    const settle = (outcome: PermissionOutcome) => {
      waiting.delete(id);
      done(outcome);
    };

    waiting.set(id, settle);
    signal.addEventListener('abort', () => settle(CANCELLED), { once: true });
  });
}

export function choose(id: string, optionId: string): boolean {
  const settle = waiting.get(id);
  if (!settle) {
    return false;
  }

  settle({ outcome: 'selected', optionId });
  return true;
}
