import { describe, expect, it } from 'vitest';
import { HANDOFF_PROMPT_MAX, handoffLink, sourceTrigger, PROMPT_KINDS, PromptKind, PromptSource } from './handoff';

function params(link: string): URLSearchParams {
  const url = new URL(link);
  expect(url.origin + url.pathname).toBe('https://oh.feega.app/new');
  return url.searchParams;
}

describe('the hero prompt hands off to the app', () => {
  it('carries prompt, kind and source', () => {
    const got = params(handoffLink({ text: '  a launch film for stripe.com ', kind: PromptKind.Website, source: PromptSource.Figma, images: 0 }));
    expect(got.get('prompt')).toBe('a launch film for stripe.com');
    expect(got.get('kind')).toBe('website');
    expect(got.get('source')).toBe('figma');
    expect(got.has('attach')).toBe(false);
  });

  it('leaves out a source nobody picked', () => {
    expect(params(handoffLink({ text: 'x', kind: PromptKind.Motion, source: null, images: 0 })).has('source')).toBe(false);
  });

  it('asks the app for images it could not carry', () => {
    expect(params(handoffLink({ text: 'x', kind: PromptKind.Motion, source: null, images: 2 })).get('attach')).toBe('1');
  });

  it('caps a long prompt', () => {
    const got = params(handoffLink({ text: 'a'.repeat(HANDOFF_PROMPT_MAX * 2), kind: PromptKind.Motion, source: null, images: 0 }));
    expect(got.get('prompt')).toHaveLength(HANDOFF_PROMPT_MAX);
  });
});

describe('PROMPT_KINDS', () => {
  it('ogni tipo ha il proprio placeholder', () => {
    const placeholders = new Set(PROMPT_KINDS.map((row) => row.placeholder));
    expect(placeholders.size).toBe(PROMPT_KINDS.length);
  });
});

describe('sourceTrigger', () => {
  it('dice Import finché non si sceglie una sorgente', () => {
    expect(sourceTrigger(null)).toBe('Import');
  });

  it('mostra il nome della sorgente scelta', () => {
    expect(sourceTrigger(PromptSource.Folder)).toBe('Local folder');
  });
});
