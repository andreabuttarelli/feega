import { describe, expect, it } from 'vitest';
import { PromptKind } from './prompt-kinds';
import { AppMode, briefFor, PROMPT_SOURCES, PromptSource, sourceName, sourcesFor } from './prompt-sources';

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

describe('the local folder source follows the app mode', () => {
  it('in the cloud the folder is uploaded once, in local mode it stays a live path', () => {
    expect(sourcesFor(AppMode.Cloud)).toEqual([PromptSource.Github, PromptSource.Upload, PromptSource.Figma]);
    expect(sourcesFor(AppMode.Local)).toEqual([PromptSource.Github, PromptSource.Folder, PromptSource.Figma]);
    expect(PROMPT_SOURCES[PromptSource.Upload].label).toBe(PROMPT_SOURCES[PromptSource.Folder].label);
  });

  it('an uploaded folder is named after the folder, not the storage path', () => {
    expect(sourceName(PromptSource.Upload, 'o/p/code-uploads/u/my-app')).toBe('my-app');
  });
});
