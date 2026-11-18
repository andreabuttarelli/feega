import { describe, expect, it } from 'vitest';
import { EditorMode, listedModes, readEditorMode } from './editor-mode.svelte';

describe('modes offered in the bottom bar', () => {
  it('leaves prototyping (Play) out of the bar', () => {
    expect(listedModes()).toEqual([EditorMode.Design, EditorMode.Motion, EditorMode.Code]);
  });

  it('reopens Design when the stored mode is one the bar no longer offers', () => {
    expect(readEditorMode(EditorMode.Play)).toBe(EditorMode.Design);
    expect(readEditorMode(EditorMode.Code)).toBe(EditorMode.Code);
  });
});
