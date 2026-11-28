import { describe, expect, it } from 'vitest';
import { LiveProp } from '@feega/live-edit/live-fields';
import { ToHost, type HostMessage } from '../messages';
import { EditKind } from './usage';
import { editKindOf } from './edit-kind';

const message = (m: object) => m as HostMessage;

describe('editKindOf', () => {
  it.each([
    [{ kind: ToHost.Edit, ask: { at: 'a:1:1', prop: LiveProp.Text } }, EditKind.Text],
    [{ kind: ToHost.Edit, ask: { at: 'a:1:1', prop: LiveProp.Color } }, EditKind.Style],
    [{ kind: ToHost.Font }, EditKind.Style],
    [{ kind: ToHost.Structure }, EditKind.Structure],
    [{ kind: ToHost.Move }, EditKind.Structure],
    [{ kind: ToHost.ImageUpload }, EditKind.Image],
    [{ kind: ToHost.IconSwap }, EditKind.Image],
    [{ kind: ToHost.Attribute }, EditKind.Attribute],
    [{ kind: ToHost.Retag }, EditKind.Attribute],
    [{ kind: ToHost.LibraryInsert }, EditKind.Template],
    [{ kind: ToHost.Undo }, EditKind.Other]
  ])('%o is %s', (m, kind) => {
    expect(editKindOf(message(m))).toBe(kind);
  });
});
