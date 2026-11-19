const WHOLE_ENTITY = '*';
const MAX_VALUE = 60;
const DATA_PREFIX = 'data.';

export enum ValueKind {
  Removed = 'removed',
  Color = 'color',
  Image = 'image',
  Text = 'text'
}

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i;
const IMAGE = /^(data:image\/|https?:\/\/.+\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$|\/local\/storage\/.+\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$)/i;

export function valueKind(value: unknown): ValueKind {
  if (value === null || value === undefined) {
    return ValueKind.Removed;
  }

  if (typeof value !== 'string') {
    return ValueKind.Text;
  }

  if (COLOR.test(value.trim())) {
    return ValueKind.Color;
  }

  return IMAGE.test(value) ? ValueKind.Image : ValueKind.Text;
}

export const fieldLabel = (field: string) => (field === WHOLE_ENTITY ? 'deleted on one side' : field.replace(DATA_PREFIX, ''));

export function shownValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(removed)';
  }

  const text = JSON.stringify(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 2)}…` : text;
}

const clock = (at: string, timeZone?: string) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });

export const unsavedLine = (since: string, timeZone?: string) => `Not saved to .feega/ since ${clock(since, timeZone)}`;

export const changedAtLine = (at: string, timeZone?: string) => `.feega/ changed on disk · ${clock(at, timeZone)}`;
