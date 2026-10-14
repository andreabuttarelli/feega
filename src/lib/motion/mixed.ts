export const MIXED = Symbol('mixed');

export type Shared<T> = T | typeof MIXED;

export function shared<T>(values: readonly T[]): Shared<T> {
  if (!values.length) {
    return MIXED;
  }
  return values.every((v) => v === values[0]) ? values[0] : MIXED;
}
