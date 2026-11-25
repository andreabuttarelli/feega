import { Gate, ToHost, type ApplyAsk, type EditAsk, type HostMessage, type ToView, type ViewMessage } from '../messages';
import { SettingKey } from '../settings';
import type { DiffFile } from '../host/diff-preview';

export type Held = { ask: EditAsk | ApplyAsk; reason: string; files: DiffFile[]; by?: string };

export const heldOf = ({ ask, reason, files, by }: Extract<ViewMessage, { kind: ToView.Preview | ToView.PropsPreview }>): Held => ({ ask, reason, files, by: by?.name });

export const applyMessage = (held: Held): HostMessage => ('prop' in held.ask ? { kind: ToHost.Edit, ask: held.ask, gate: Gate.Apply } : { kind: ToHost.ApplyProps, ask: held.ask, gate: Gate.Apply });

export const muteMessage = (): HostMessage => ({ kind: ToHost.Setting, key: SettingKey.PreviewUnknown, value: false });

export const summaryOf = (files: DiffFile[]): string => files.map((f) => `${f.path}:${f.line}`).join(', ');
