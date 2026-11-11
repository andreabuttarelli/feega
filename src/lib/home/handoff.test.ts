import { describe, expect, it } from 'vitest';
import { handoffOf } from './handoff';
import { PromptKind } from './prompt-kinds';
import { PromptSource } from './prompt-sources';

const of = (query: string) => handoffOf(new URLSearchParams(query));

describe('the landing hands its prompt to /new', () => {
  it('reads prompt, kind and source', () => {
    expect(of('prompt=Redesign+linear.app&kind=website&source=github')).toEqual({ text: 'Redesign linear.app', kind: PromptKind.Website, source: PromptSource.Github, waitsForImages: false });
  });

  it('waits when the visitor attached images the landing could not carry', () => {
    expect(of('prompt=x&attach=1')?.waitsForImages).toBe(true);
  });

  it('drops a source the app does not know', () => {
    expect(of('prompt=x&source=dropbox')?.source).toBeNull();
  });

  it('a source alone is enough', () => {
    expect(of('source=figma&kind=website')).toEqual({ text: '', kind: PromptKind.Website, source: PromptSource.Figma, waitsForImages: false });
  });

  it('is nothing without a prompt or with an unknown kind', () => {
    expect(of('')).toBeNull();
    expect(of('kind=website')).toBeNull();
    expect(of('prompt=x&kind=poster')).toBeNull();
  });
});
