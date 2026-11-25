import { LiveProp } from '@feega/live-edit/live-fields';
import { ToHost, type HostMessage } from '../messages';
import { EditKind } from './usage';

const EDIT_KIND_OF: Partial<Record<ToHost, EditKind>> = {
  [ToHost.Edit]: EditKind.Style,
  [ToHost.SaveVariable]: EditKind.Style,
  [ToHost.Font]: EditKind.Style,
  [ToHost.FontReplace]: EditKind.Style,
  [ToHost.FontLoad]: EditKind.Style,
  [ToHost.Move]: EditKind.Structure,
  [ToHost.Structure]: EditKind.Structure,
  [ToHost.StructureMany]: EditKind.Structure,
  [ToHost.AddImage]: EditKind.Image,
  [ToHost.ImageChoose]: EditKind.Image,
  [ToHost.ImageUpload]: EditKind.Image,
  [ToHost.IconSwap]: EditKind.Image,
  [ToHost.IconMarkup]: EditKind.Image,
  [ToHost.IconGet]: EditKind.Image,
  [ToHost.Link]: EditKind.Attribute,
  [ToHost.Attribute]: EditKind.Attribute,
  [ToHost.ApplyProps]: EditKind.Attribute,
  [ToHost.LibraryInsert]: EditKind.Template
};

export function editKindOf(message: HostMessage): EditKind {
  if (message.kind === ToHost.Edit && message.ask.prop === LiveProp.Text) {
    return EditKind.Text;
  }
  return EDIT_KIND_OF[message.kind] ?? EditKind.Other;
}
