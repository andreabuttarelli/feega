import { describe, expect, it } from 'vitest';
import { ToHost } from '../../messages';
import { EDIT_LOCK_MS, editGate } from './gate';

const viewer = { userId: 'v', name: 'Vera', role: 'viewer' as const };
const ada = { userId: 'a', name: 'Ada', role: 'editor' as const };
const bo = { userId: 'b', name: 'Bo', role: 'editor' as const };

const edit = (at: string) => ({ kind: ToHost.Edit, ask: { at, prop: 'color', value: 'red' } });

describe('editGate', () => {
  it('lets viewers read but never change anything', () => {
    const gate = editGate(() => 0);

    for (const message of [{ kind: ToHost.Ready }, { kind: ToHost.Picked, id: 1, pick: null }, { kind: ToHost.Selected, at: null }, { kind: ToHost.Cursor, at: null }, { kind: ToHost.Wiring, at: 'a:1:1' }, { kind: ToHost.Comments }]) {
      expect(gate.check(viewer, message)).toEqual({ ok: true });
    }
    for (const message of [edit('a:1:1'), { kind: ToHost.Undo }, { kind: ToHost.Redo }, { kind: ToHost.Revert, id: 1 }, { kind: ToHost.Move, from: 'a:1:1', to: 'a:2:1', place: 'before' }, { kind: ToHost.Structure, op: 'delete', at: 'a:1:1' }, { kind: ToHost.ImageUpload, name: 'x', data: '' }]) {
      expect(gate.check(viewer, message)).toEqual({ ok: false, reason: 'viewers cannot edit' });
    }
  });

  it('never lets a visitor drive the host machine', () => {
    const gate = editGate(() => 0);

    for (const kind of [ToHost.Open, ToHost.Restart, ToHost.External, ToHost.Prefs, ToHost.Setting, ToHost.Server, ToHost.Diff, ToHost.SourceControl, ToHost.AttachUrl, ToHost.AddPlugin, ToHost.SignIn, ToHost.SignOut, ToHost.Copy, ToHost.CommentAdd, ToHost.CommentResolve, ToHost.ImageChoose]) {
      expect(gate.check(ada, { kind })).toEqual({ ok: false, reason: 'only the host can do that', quiet: true });
    }
  });

  it('refuses a kind it does not know', () => {
    expect(editGate(() => 0).check(ada, { kind: 'rm-rf' })).toEqual({ ok: false, reason: 'only the host can do that', quiet: true });
    expect(editGate(() => 0).check(ada, {})).toEqual({ ok: false, reason: 'only the host can do that', quiet: true });
  });

  it('lets editors edit and read', () => {
    const gate = editGate(() => 0);

    expect(gate.check(ada, edit('a:1:1'))).toEqual({ ok: true });
    expect(gate.check(ada, { kind: ToHost.Undo })).toEqual({ ok: true });
    expect(gate.check(ada, { kind: ToHost.Ready })).toEqual({ ok: true });
  });

  it('locks an element to its editor for 60 seconds', () => {
    let now = 1000;
    const gate = editGate(() => now);

    expect(gate.check(ada, edit('a:1:1'))).toEqual({ ok: true });
    expect(gate.check(bo, edit('a:1:1'))).toEqual({ ok: false, reason: 'Ada is editing this element' });
    expect(gate.check(ada, edit('a:1:1'))).toEqual({ ok: true });
    expect(gate.check(bo, edit('a:9:9'))).toEqual({ ok: true });

    now += EDIT_LOCK_MS - 1;
    expect(gate.check(bo, edit('a:1:1'))).toMatchObject({ ok: false });
    now += 1;
    expect(gate.check(bo, edit('a:1:1'))).toEqual({ ok: true });
  });

  it('extends the lock on every edit by its holder', () => {
    let now = 0;
    const gate = editGate(() => now);
    gate.check(ada, edit('a:1:1'));
    now = EDIT_LOCK_MS - 1;
    gate.check(ada, edit('a:1:1'));
    now = EDIT_LOCK_MS * 1.5;

    expect(gate.check(bo, edit('a:1:1'))).toMatchObject({ ok: false });
  });

  it('locks by the element a move or structure change targets', () => {
    const gate = editGate(() => 0);
    gate.check(ada, { kind: ToHost.Structure, op: 'delete', at: 'a:1:1' });

    expect(gate.check(bo, edit('a:1:1'))).toMatchObject({ ok: false });
    expect(gate.check(bo, { kind: ToHost.Move, from: 'a:1:1', to: 'a:3:1', place: 'before' })).toMatchObject({ ok: false });
  });

  it('releases a person locks when they leave', () => {
    const gate = editGate(() => 0);
    gate.check(ada, edit('a:1:1'));

    gate.release('a');

    expect(gate.check(bo, edit('a:1:1'))).toEqual({ ok: true });
  });
});
