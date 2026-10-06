import { CLONE_MAX_SECONDS, CLONE_MIN_SECONDS } from './voices';

const PREFERRED_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'] as const;

export function recorderMime(isSupported: (mime: string) => boolean): string {
  return PREFERRED_MIMES.find((mime) => isSupported(mime)) ?? '';
}

export type MicProblem = 'denied' | 'no_microphone' | 'unsupported' | 'unavailable';

export const MIC_PROBLEM_MESSAGE: Readonly<Record<MicProblem, string>> = {
  denied: 'Microphone access is blocked. Allow it in your browser or system settings, then try again.',
  no_microphone: 'No microphone found. Connect one and try again.',
  unsupported: 'This browser cannot record audio. Upload a recording instead.',
  unavailable: 'The microphone could not start. Close other apps using it and try again.'
};

const PROBLEM_OF_ERROR: Readonly<Record<string, MicProblem>> = {
  NotAllowedError: 'denied',
  SecurityError: 'denied',
  NotFoundError: 'no_microphone',
  OverconstrainedError: 'no_microphone'
};

export function micProblemOf(error: { name?: string } | null, env: { hasMediaDevices: boolean } = { hasMediaDevices: true }): MicProblem {
  if (!env.hasMediaDevices) {
    return 'unsupported';
  }
  return PROBLEM_OF_ERROR[error?.name ?? ''] ?? 'unavailable';
}

export function recordingReady(seconds: number): boolean {
  return seconds >= CLONE_MIN_SECONDS && seconds <= CLONE_MAX_SECONDS;
}
