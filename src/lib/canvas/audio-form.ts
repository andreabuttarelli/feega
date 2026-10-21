import { DEFAULT_VOICE, DUBBING_LANGUAGES, audioModelFor, audioModelsOf, audioOperationOf, operationSpec } from './audio-operations';
import type { GenNode } from './gen-node';

export enum AudioFieldKind {
  Select = 'select',
  Voice = 'voice',
  More = 'more',
  Slider = 'slider',
  Number = 'number'
}

export type AudioField = { kind: AudioFieldKind; label: string; value: string; ratio: number };

const VOICE_SETTINGS = [
  ['stability', 'Stability'],
  ['similarity', 'Similarity'],
  ['style', 'Style']
] as const;
const MIDDLE = 0.5;
const PICK_LANGUAGE = 'Pick a language';
const MORE_VOICES = 'More voices';

const field = (kind: AudioFieldKind, label: string, value = '', ratio = 0): AudioField => ({ kind, label, value, ratio });

export function audioFormOf(node: Pick<GenNode, 'params' | 'model'>): AudioField[] {
  const operation = audioOperationOf(node.params);
  const spec = operationSpec(operation);
  const params = node.params as Record<string, unknown>;
  const fields = [field(AudioFieldKind.Select, 'Operation', spec.label)];
  if (audioModelsOf(operation).length > 1) {
    fields.push(field(AudioFieldKind.Select, 'Model', audioModelFor(operation, node.model)));
  }
  if (spec.needsVoice) {
    const voice = (params.voiceName as string | undefined) ?? (params.voiceId as string | undefined) ?? DEFAULT_VOICE.name;
    fields.push(field(AudioFieldKind.Voice, 'Voice', voice), field(AudioFieldKind.More, '', MORE_VOICES));
    for (const [key, label] of VOICE_SETTINGS) {
      const value = params[key];
      fields.push(field(AudioFieldKind.Slider, label, '', typeof value === 'number' ? value : MIDDLE));
    }
  }
  if (spec.needsLanguage) {
    fields.push(field(AudioFieldKind.Select, 'Language', DUBBING_LANGUAGES[String(params.targetLanguage ?? '')] ?? PICK_LANGUAGE));
  }
  if (spec.duration) {
    fields.push(field(AudioFieldKind.Number, 'Seconds', String(typeof params.duration === 'number' ? params.duration : spec.duration.initial)));
  }
  return fields;
}
