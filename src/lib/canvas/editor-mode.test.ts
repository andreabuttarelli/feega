import { describe, expect, it } from 'vitest';
import { EditMode } from '$lib/motion/edit-mode';
import { EDITOR_MODE_KEY, EditorMode, EditorModeState, ModeInspector, MODES, readEditorMode } from './editor-mode.svelte';

class MemoryStore {
  kept = new Map<string, string>();
  getItem = (key: string) => this.kept.get(key) ?? null;
  setItem = (key: string, value: string) => void this.kept.set(key, value);
}

const blocked = () => {
  throw new Error('blocked');
};

describe('editor mode', () => {
  it('every mode has an icon for the switch', () => {
    for (const mode of Object.values(EditorMode)) {
      expect(MODES[mode].icon).toBeTruthy();
    }
  });

  it('starts in Design without a remembered mode', () => {
    expect(new EditorModeState(new MemoryStore()).current).toBe(EditorMode.Design);
  });

  it('E toggles Design and Motion', () => {
    const mode = new EditorModeState(new MemoryStore());
    mode.toggleMotion();
    expect(mode.current).toBe(EditorMode.Motion);
    mode.toggleMotion();
    expect(mode.current).toBe(EditorMode.Design);
  });

  it('E from Play or Code goes back to Design', () => {
    const mode = new EditorModeState(new MemoryStore());
    mode.set(EditorMode.Play);
    mode.toggleMotion();
    expect(mode.current).toBe(EditorMode.Design);
  });

  it('⇧D enters Code and leaves it to Design', () => {
    const mode = new EditorModeState(new MemoryStore());
    mode.set(EditorMode.Motion);
    mode.toggleCode();
    expect(mode.current).toBe(EditorMode.Code);
    mode.toggleCode();
    expect(mode.current).toBe(EditorMode.Design);
  });

  it('remembers the mode across sessions', () => {
    const store = new MemoryStore();
    new EditorModeState(store).set(EditorMode.Play);
    expect(store.kept.get(EDITOR_MODE_KEY)).toBe(EditorMode.Play);
    expect(new EditorModeState(store).current).toBe(EditorMode.Play);
  });

  it('an unknown or unreadable stored mode falls back to Design', () => {
    expect(readEditorMode('nope')).toBe(EditorMode.Design);
    const mode = new EditorModeState({ getItem: blocked, setItem: blocked });
    mode.set(EditorMode.Code);
    expect(mode.current).toBe(EditorMode.Code);
  });

  it('only Motion keys edits at the playhead', () => {
    expect(MODES[EditorMode.Motion].edit).toBe(EditMode.Motion);
    expect([EditorMode.Design, EditorMode.Play, EditorMode.Code].map((m) => MODES[m].edit)).toEqual([EditMode.Design, EditMode.Design, EditMode.Design]);
  });

  it('Code reads the dev inspector, Play shows a placeholder', () => {
    expect(MODES[EditorMode.Code].inspector).toBe(ModeInspector.Code);
    expect(MODES[EditorMode.Play].inspector).toBe(ModeInspector.Soon);
    expect(MODES[EditorMode.Design].inspector).toBe(ModeInspector.Properties);
  });
});
