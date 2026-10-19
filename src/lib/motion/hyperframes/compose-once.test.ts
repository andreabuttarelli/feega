import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '../doc';
import { lastComposed } from './compose-once';

describe('a frame composed twice with the same inputs is composed once', () => {
  const doc = newMotionDoc(MotionFormat.Square);
  const tokens = {} as never;
  const assets = {};

  it('the preview and the baked frame of an unchanged doc share one compose', () => {
    const compose = vi.fn(() => '<html>');
    const once = lastComposed(compose);

    once({ doc, tokens, assets });
    once({ doc, tokens, assets });

    expect(compose).toHaveBeenCalledTimes(1);
  });

  it('an edited doc is composed again', () => {
    const compose = vi.fn(() => '<html>');
    const once = lastComposed(compose);

    once({ doc, tokens, assets });
    once({ doc: { ...doc, height: 900 }, tokens, assets });

    expect(compose).toHaveBeenCalledTimes(2);
  });

  it('a different input field, not only the doc, is composed again', () => {
    const compose = vi.fn(() => '<html>');
    const once = lastComposed(compose);

    once({ doc, tokens, assets });
    once({ doc, tokens, assets: { a: 'u' } });

    expect(compose).toHaveBeenCalledTimes(2);
  });
});
