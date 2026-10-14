export const DB_BUSY = 'db_busy';

const STATEMENT_TIMEOUT_CODE = '57014';
const STATEMENT_TIMEOUT_TEXT = 'statement timeout';

export function isStatementTimeout(error: unknown): boolean {
  if (typeof error === 'string') {
    return error.includes(STATEMENT_TIMEOUT_TEXT);
  }
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === STATEMENT_TIMEOUT_CODE || (typeof message === 'string' && message.includes(STATEMENT_TIMEOUT_TEXT));
}

export function busyAnswer(error: unknown): { message: string } | undefined {
  return isStatementTimeout(error) ? { message: DB_BUSY } : undefined;
}
