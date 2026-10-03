import { CREDITS_PER_USD_SUBSCRIPTION_LIST } from '$lib/credit-ladder';
import type { ConnectorType } from './connectors';
import { portHandle, type SelectOutput } from './select-outputs';
import type { OutputPort } from './select-sources';

export type AudioSource = 'text' | 'media';
export type AudioDelivery = 'now' | 'job';
export type AudioBilling = 'character' | 'second';
export type DurationRange = { min: number; max: number; initial: number };
export type AudioInputKind = 'text' | 'audio' | 'video';
export type OutputsByInput = Record<AudioInputKind, readonly ConnectorType[]>;

export type AudioOperation = {
  label: string;
  source: AudioSource;
  needsVoice: boolean;
  needsLanguage: boolean;
  duration: DurationRange | null;
  delivery: AudioDelivery;
  billedPer: AudioBilling;
  defaultModel: string;
  usdPerUnit: Record<string, number>;
  inputPorts: readonly ConnectorType[];
  outputPorts: OutputsByInput;
};

const SECONDS_PER_MINUTE = 60;
const CHARACTERS_PER_THOUSAND = 1000;
const perMinute = (usd: number) => usd / SECONDS_PER_MINUTE;
const perThousandCharacters = (usd: number) => usd / CHARACTERS_PER_THOUSAND;

const AUDIO_ONLY: OutputsByInput = { text: ['audios'], audio: ['audios'], video: ['audios'] };
const SAME_MEDIUM_AND_TRACK: OutputsByInput = { text: ['audios'], audio: ['audios'], video: ['videos', 'audios'] };

export const AUDIO_OPERATIONS = {
  text_to_speech: {
    label: 'Text to speech',
    source: 'text',
    needsVoice: true,
    needsLanguage: false,
    duration: null,
    delivery: 'now',
    billedPer: 'character',
    defaultModel: 'eleven_multilingual_v2',
    usdPerUnit: {
      eleven_multilingual_v2: perThousandCharacters(0.08),
      eleven_v3: perThousandCharacters(0.08),
      eleven_flash_v2_5: perThousandCharacters(0.04),
      eleven_turbo_v2_5: perThousandCharacters(0.04)
    },
    inputPorts: ['text'],
    outputPorts: AUDIO_ONLY
  },
  voice_changer: {
    label: 'Voice changer',
    source: 'media',
    needsVoice: true,
    needsLanguage: false,
    duration: null,
    delivery: 'now',
    billedPer: 'second',
    defaultModel: 'eleven_multilingual_sts_v2',
    usdPerUnit: { eleven_multilingual_sts_v2: perMinute(0.12), eleven_english_sts_v2: perMinute(0.12) },
    inputPorts: ['audios', 'videos'],
    outputPorts: AUDIO_ONLY
  },
  dubbing: {
    label: 'Dubbing',
    source: 'media',
    needsVoice: false,
    needsLanguage: true,
    duration: null,
    delivery: 'job',
    billedPer: 'second',
    defaultModel: 'dubbing_v1',
    usdPerUnit: { dubbing_v1: perMinute(0.5) },
    inputPorts: ['videos', 'audios'],
    outputPorts: SAME_MEDIUM_AND_TRACK
  },
  music: {
    label: 'Music',
    source: 'text',
    needsVoice: false,
    needsLanguage: false,
    duration: { min: 3, max: 600, initial: 30 },
    delivery: 'now',
    billedPer: 'second',
    defaultModel: 'music_v1',
    usdPerUnit: { music_v1: perMinute(0.15) },
    inputPorts: ['text'],
    outputPorts: AUDIO_ONLY
  },
  sound_effects: {
    label: 'Sound effect',
    source: 'text',
    needsVoice: false,
    needsLanguage: false,
    duration: { min: 0.5, max: 30, initial: 5 },
    delivery: 'now',
    billedPer: 'second',
    defaultModel: 'eleven_text_to_sound_v2',
    usdPerUnit: { eleven_text_to_sound_v2: perMinute(0.12) },
    inputPorts: ['text'],
    outputPorts: AUDIO_ONLY
  },
  voice_isolation: {
    label: 'Voice isolation',
    source: 'media',
    needsVoice: false,
    needsLanguage: false,
    duration: null,
    delivery: 'now',
    billedPer: 'second',
    defaultModel: 'audio_isolation',
    usdPerUnit: { audio_isolation: perMinute(0.12) },
    inputPorts: ['audios', 'videos'],
    outputPorts: AUDIO_ONLY
  }
} as const satisfies Record<string, AudioOperation>;

export type AudioOperationId = keyof typeof AUDIO_OPERATIONS;

export const AUDIO_OPERATION_IDS = Object.keys(AUDIO_OPERATIONS) as AudioOperationId[];

export const DEFAULT_AUDIO_OPERATION: AudioOperationId = 'text_to_speech';

export const AUDIO_PROVIDER = { provider: 'elevenlabs', providerLabel: 'ElevenLabs' } as const;

export const AUDIO_INPUT_MODALITIES = ['text', 'audio', 'video'];

export const DUBBING_LANGUAGES: Record<string, string> = {
  en: 'English',
  it: 'Italian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  ru: 'Russian',
  tr: 'Turkish'
};

export type AudioParams = {
  operation?: string;
  voiceId?: string;
  voiceName?: string;
  targetLanguage?: string;
  duration?: number;
  stability?: number;
  similarity?: number;
  style?: number;
};

export const DEFAULT_VOICE = { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' } as const;

export function voiceIdOf(params: AudioParams): string {
  return params.voiceId || DEFAULT_VOICE.id;
}

export function isAudioOperation(x: unknown): x is AudioOperationId {
  return typeof x === 'string' && x in AUDIO_OPERATIONS;
}

export function audioOperationOf(params: { operation?: unknown }): AudioOperationId {
  return isAudioOperation(params.operation) ? params.operation : DEFAULT_AUDIO_OPERATION;
}

export function operationSpec(id: AudioOperationId): AudioOperation {
  return AUDIO_OPERATIONS[id];
}

export function audioInputPorts(id: AudioOperationId): ConnectorType[] {
  return [...operationSpec(id).inputPorts];
}

export function audioOutputPorts(id: AudioOperationId, input: AudioInputKind): ConnectorType[] {
  return [...operationSpec(id).outputPorts[input]];
}

export function audioInputKindOf(wired: readonly ConnectorType[]): AudioInputKind {
  if (wired.includes('audios')) {
    return 'audio';
  }
  return wired.includes('videos') ? 'video' : 'text';
}

const OUTPUT_LABEL: Partial<Record<ConnectorType, string>> = { videos: 'Dubbed video', audios: 'Audio' };

export function audioNamedOutputs(id: AudioOperationId, input: AudioInputKind): SelectOutput[] {
  const ports = audioOutputPorts(id, input) as OutputPort[];
  if (ports.length < 2) {
    return [];
  }
  return ports.map((port) => ({
    handle: portHandle(port),
    label: OUTPUT_LABEL[port] ?? port,
    port,
    field: port,
    custom: null,
    incompatible: false
  }));
}

export function dubbedInputKind(mime: string): AudioInputKind {
  return mime.startsWith('video/') ? 'video' : 'audio';
}

const MEDIUM_OF_CONNECTOR: Partial<Record<ConnectorType, 'text' | 'image' | 'video' | 'audio'>> = {
  text: 'text',
  images: 'image',
  videos: 'video',
  audios: 'audio'
};

export function audioInputMediums(id: AudioOperationId): ('text' | 'image' | 'video' | 'audio')[] {
  return audioInputPorts(id).map((port) => MEDIUM_OF_CONNECTOR[port]).filter((m): m is 'text' | 'image' | 'video' | 'audio' => !!m);
}

export function defaultAudioModel(id: AudioOperationId): string {
  return operationSpec(id).defaultModel;
}

export function audioModelsOf(id: AudioOperationId): string[] {
  return Object.keys(operationSpec(id).usdPerUnit);
}

export function audioModelFor(id: AudioOperationId, requested: string | null | undefined): string {
  return requested && audioModelsOf(id).includes(requested) ? requested : defaultAudioModel(id);
}

export function audioDurationOf(id: AudioOperationId, params: AudioParams): number | null {
  const range = operationSpec(id).duration;
  if (!range) {
    return null;
  }
  return typeof params.duration === 'number' ? params.duration : range.initial;
}

export type AudioInputs = { text: string; audio: number; video: number };

export type AudioInputProblem =
  | 'text_required'
  | 'media_required'
  | 'language_required'
  | 'duration_out_of_range';

export function audioInputProblem(id: AudioOperationId, inputs: AudioInputs, params: AudioParams): AudioInputProblem | null {
  const op = operationSpec(id);

  if (op.source === 'text' && !inputs.text.trim()) {
    return 'text_required';
  }
  if (op.source === 'media' && inputs.audio + inputs.video === 0) {
    return 'media_required';
  }
  if (op.needsLanguage && !params.targetLanguage) {
    return 'language_required';
  }

  const seconds = audioDurationOf(id, params);
  if (op.duration && seconds !== null && (seconds < op.duration.min || seconds > op.duration.max)) {
    return 'duration_out_of_range';
  }
  return null;
}

export const AUDIO_PROBLEM_MESSAGE: Record<AudioInputProblem, string> = {
  text_required: 'Write the text or connect a text node',
  media_required: 'Connect an audio or video node',
  language_required: 'Pick a target language',
  duration_out_of_range: 'Duration out of range'
};

export type AudioMeasure = { characters?: number; seconds?: number };

export function audioUsdFor(id: AudioOperationId, model: string, measure: AudioMeasure): number | null {
  const op = operationSpec(id);
  const rate = op.usdPerUnit[model] ?? op.usdPerUnit[op.defaultModel];
  const units = op.billedPer === 'character' ? measure.characters : measure.seconds;
  return typeof units === 'number' ? rate * units : null;
}

export function audioCreditsFor(id: AudioOperationId, model: string, measure: AudioMeasure): number | null {
  const usd = audioUsdFor(id, model, measure);
  return usd === null ? null : Math.round(usd * CREDITS_PER_USD_SUBSCRIPTION_LIST);
}
