import { describe, expect, it } from 'vitest';
import { perDoc } from './per-doc';

describe('perDoc', () => {
  it('computes once per doc while the second input stays the same object', () => {
    const seen: object[] = [];
    const laid = perDoc((doc: object, vars: object | undefined) => {
      seen.push(doc);
      return { doc, vars };
    });
    const doc = {};
    const vars = {};

    const first = laid(doc, vars);
    expect(laid(doc, vars)).toBe(first);
    expect(seen).toHaveLength(1);
  });

  it('computes again for a new doc or new second input', () => {
    let runs = 0;
    const laid = perDoc((_doc: object, _vars: object | undefined) => ++runs);
    const doc = {};

    laid(doc, undefined);
    laid({}, undefined);
    laid(doc, {});

    expect(runs).toBe(3);
  });
});
