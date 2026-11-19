import type { Conflict } from '@feega/canvas-folder';

const WHOLE_ENTITY = '*';
const SHORT_ID = 8;
const MAX_VALUE = 60;
const DATA_PREFIX = 'data.';

export function conflictTitle(conflict: Conflict, names: Record<string, string>): string {
  const subject = names[conflict.id] ?? conflict.id.slice(0, SHORT_ID);
  const field = conflict.field === WHOLE_ENTITY ? 'deleted on one side' : conflict.field.replace(DATA_PREFIX, '');
  return `${subject} · ${field}`;
}

export function shownValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(removed)';
  }

  const text = JSON.stringify(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 2)}…` : text;
}

export function unsavedLine(since: string, timeZone?: string): string {
  const time = new Date(since).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
  return `Not saved to .feega/ since ${time}`;
}
