import type { PlanKey } from '$lib/plans';
import { ProjectMode } from '$lib/project-mode';

export type VoiceMethod = 'design' | 'instant_clone';

export type ConsentBasis = 'own_voice' | 'consented_speaker';

export const CONSENT_BASES: Readonly<Record<ConsentBasis, string>> = {
  own_voice: 'This is my own voice',
  consented_speaker: 'The speaker gave me explicit consent'
};

export const VOICE_SLOTS_BY_PLAN: Readonly<Record<PlanKey | 'none', number>> = {
  none: 3,
  go: 3,
  starter: 5,
  pro: 10
};

export const VOICE_CREATION_USD: Readonly<Record<VoiceMethod, number>> = {
  design: 0.08,
  instant_clone: 0.1
};

export const CLONE_MIN_SECONDS = 60;
export const CLONE_MAX_SECONDS = 180;

export const CLONE_SCRIPT = [
  'Hello, this is my voice, and I am recording it so I can use it in my own projects.',
  'I am reading this out loud at my normal pace, in a quiet room, without music in the background.',
  'Some days start slowly, with coffee and a long list of things to do; others begin with a phone call and never stop.',
  'Numbers sound different from words: one, two, three, fifteen, forty-two, a hundred and seven.',
  'A question rises at the end, doesn’t it? An exclamation lands with a little more energy!',
  'I like the sound of rain on the window, the smell of fresh bread, and the quiet just before a concert starts.',
  'That is enough for now. Thank you for listening.'
].join(' ');

export const VOICE_GENDERS = ['female', 'male', 'neutral'] as const;

export const VOICE_USE_CASES = [
  'narrative_story',
  'conversational',
  'characters_animation',
  'social_media',
  'entertainment_tv',
  'advertisement',
  'informative_educational'
] as const;

export type VoiceRefusal =
  | 'consent_required'
  | 'speaker_name_required'
  | 'recording_too_short'
  | 'recording_too_long'
  | 'cloning_not_in_this_project'
  | 'voice_slots_full'
  | 'voice_not_yours'
  | 'cloned_voice_not_in_this_project';

export const VOICE_REFUSAL_MESSAGE: Readonly<Record<VoiceRefusal, string>> = {
  consent_required: 'Confirm that this is your voice or that the speaker consented.',
  speaker_name_required: 'Write the name of the person who consented.',
  recording_too_short: `Record at least ${CLONE_MIN_SECONDS} seconds.`,
  recording_too_long: `Keep the recording under ${CLONE_MAX_SECONDS} seconds.`,
  cloning_not_in_this_project: 'Voice cloning is not available in this project.',
  voice_slots_full: 'All your voice slots are in use. Delete a custom voice to make room.',
  voice_not_yours: 'This voice belongs to another workspace.',
  cloned_voice_not_in_this_project: 'Cloned voices cannot be used in this project.'
};

export type CloneRequest = {
  consentBasis: ConsentBasis;
  speaker: string;
  attested: boolean;
  seconds: number;
  mode: ProjectMode;
};

const CLONE_RULES: ReadonlyArray<readonly [VoiceRefusal, (r: CloneRequest) => boolean]> = [
  ['cloning_not_in_this_project', (r) => r.mode === ProjectMode.Uncensored],
  ['consent_required', (r) => !r.attested || !(r.consentBasis in CONSENT_BASES)],
  ['speaker_name_required', (r) => r.consentBasis === 'consented_speaker' && !r.speaker.trim()],
  ['recording_too_short', (r) => r.seconds < CLONE_MIN_SECONDS],
  ['recording_too_long', (r) => r.seconds > CLONE_MAX_SECONDS]
];

export function cloneRefusal(request: CloneRequest): VoiceRefusal | null {
  return CLONE_RULES.find(([, breaks]) => breaks(request))?.[0] ?? null;
}

export type SlotCount = { used: number; limit: number };

export function slotsLeft(input: { plan: PlanKey | null; used: number; account: SlotCount }): number {
  const forOrg = VOICE_SLOTS_BY_PLAN[input.plan ?? 'none'] - input.used;
  const forAccount = input.account.limit - input.account.used;
  return Math.max(0, Math.min(forOrg, forAccount));
}
