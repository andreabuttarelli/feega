import { describe, expect, it } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { HandoffStart } from '$lib/home/handoff';
import { startHandoff, USED_HANDOFFS_COOKIE } from '$lib/server/home/handoff-start';

function jar(values: Record<string, string> = {}): Cookies {
  return {
    get: (name: string) => values[name],
    set: (name: string, value: string) => {
      values[name] = value;
    }
  } as unknown as Cookies;
}

const at = (query: string) => new URLSearchParams(query);

describe('a landing prompt sends itself once', () => {
  it('a fresh nonce sends the prompt', () => {
    expect(startHandoff(at('prompt=launch&kind=motion&go=n1'), jar())).toBe(HandoffStart.Send);
  });

  it('a refresh or back with the same nonce only prefills', () => {
    const cookies = jar();
    startHandoff(at('prompt=launch&kind=motion&go=n1'), cookies);

    expect(startHandoff(at('prompt=launch&kind=motion&go=n1'), cookies)).toBe(HandoffStart.Prefill);
  });

  it('the server remembers the nonce, not the page', () => {
    const values: Record<string, string> = {};
    startHandoff(at('prompt=launch&kind=motion&go=n1'), jar(values));

    expect(values[USED_HANDOFFS_COOKIE]).toContain('n1');
  });

  it('a link without a nonce never sends', () => {
    expect(startHandoff(at('prompt=launch&kind=motion'), jar())).toBe(HandoffStart.Prefill);
  });

  it('a GitHub or Figma source waits for the pick', () => {
    expect(startHandoff(at('prompt=launch&kind=website&source=github&go=n1'), jar())).toBe(HandoffStart.Prefill);
    expect(startHandoff(at('kind=website&source=figma&go=n2'), jar())).toBe(HandoffStart.Prefill);
  });

  it('images the landing could not carry wait for the upload', () => {
    expect(startHandoff(at('prompt=launch&kind=motion&attach=1&go=n1'), jar())).toBe(HandoffStart.Prefill);
  });

  it('no handoff, nothing to start', () => {
    expect(startHandoff(at(''), jar())).toBe(HandoffStart.None);
  });
});
