import { describe, expect, it } from 'vitest';
import { handoffOf } from './handoff';
import { PromptKind } from './prompt-kinds';

const of = (query: string) => handoffOf(new URLSearchParams(query));

describe('the landing hands its prompt to /new', () => {
  it('reads prompt, kind and source', () => {
    expect(of('prompt=Redesign+linear.app&kind=website&source=github')).toEqual({ text: 'Redesign linear.app', kind: PromptKind.Website, source: 'github', waitsForImages: false });
  });

  it('waits when the visitor attached images the landing could not carry', () => {
    expect(of('prompt=x&attach=1')?.waitsForImages).toBe(true);
  });

  it('is nothing without a prompt or with an unknown kind', () => {
    expect(of('')).toBeNull();
    expect(of('prompt=x&kind=poster')).toBeNull();
  });
});
