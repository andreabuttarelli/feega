import type { AudioFile, Voice } from '$lib/server/canvas/audio-provider';
import type { SlotCount } from '$lib/canvas/voices';

export type LibraryFilters = { search?: string; language?: string; gender?: string; accent?: string; useCase?: string; page?: number };

export type LibraryVoice = Voice & { ownerId: string; language: string | null; gender: string | null; accent: string | null; useCase: string | null };

export type DesignedPreview = { generatedVoiceId: string; audioBase64: string; mime: string };

export type VoiceProvider = {
  library(filters: LibraryFilters): Promise<{ voices: LibraryVoice[]; hasMore: boolean }>;
  design(input: { description: string }): Promise<DesignedPreview[]>;
  saveDesign(input: { generatedVoiceId: string; name: string; description: string; labels: Record<string, string> }): Promise<string>;
  clone(input: { name: string; samples: AudioFile[]; labels: Record<string, string> }): Promise<string>;
  sampleIds(voiceId: string): Promise<string[]>;
  deleteSample(voiceId: string, sampleId: string): Promise<void>;
  remove(voiceId: string): Promise<void>;
  labelled(label: string): Promise<{ voiceId: string; value: string }[]>;
  slots(): Promise<SlotCount>;
};
