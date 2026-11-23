import { Gate, ToHost, type EditAsk, type HostMessage, type ToView, type ViewMessage } from '../messages';
import { SettingKey } from '../settings';
import type { DiffFile } from '../host/diff-preview';

export type Held = { ask: EditAsk; reason: string; files: DiffFile[] };

export const heldOf = ({ ask, reason, files }: Extract<ViewMessage, { kind: ToView.Preview }>): Held => ({ ask, reason, files });

export const applyMessage = (held: Held): HostMessage => ({ kind: ToHost.Edit, ask: held.ask, gate: Gate.Apply });

export const muteMessage = (): HostMessage => ({ kind: ToHost.Setting, key: SettingKey.PreviewUnknown, value: false });

export const summaryOf = (files: DiffFile[]): string => files.map((f) => `${f.path}:${f.line}`).join(', ');
