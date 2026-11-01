import type { ActionAnswer } from './node-save';

const NO_CONNECTION = 'Export failed: no connection. Try again.';
const SERVER_GAVE_UP = 'Export failed: the server stopped while drawing. Try a smaller size, or PNG at 1×.';

export function exportFailure(answer: ActionAnswer): string {
  if (answer.type === 'network') {
    return NO_CONNECTION;
  }
  const reason = (answer.data as { error?: unknown } | undefined)?.error ?? answer.error?.message;
  return typeof reason === 'string' && reason ? `Export failed: ${reason}` : SERVER_GAVE_UP;
}
