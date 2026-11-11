import { describe, expect, it } from 'vitest';
import { PromptKind } from './prompt-kinds';
import { briefFor, PromptSource } from './prompt-sources';

describe('a source with no words still makes a brief', () => {
  it('keeps what the visitor wrote', () => {
    expect(briefFor(PromptKind.Motion, '  a launch film ', { source: PromptSource.Github, value: 'https://github.com/acme/site' })).toBe('a launch film');
  });

  it('defaults per kind, naming the source', () => {
    expect(briefFor(PromptKind.Website, '', { source: PromptSource.Github, value: 'https://github.com/acme/site' })).toBe('Design a website from acme/site');
    expect(briefFor(PromptKind.Motion, ' ', { source: PromptSource.Folder, value: 'my-app' })).toBe('Make a motion video from my-app');
  });

  it('is empty with neither words nor source', () => {
    expect(briefFor(PromptKind.Motion, '', null)).toBe('');
  });
});
