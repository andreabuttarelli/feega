export type AudioFile = { bytes: Uint8Array; mime: string; historyItemId?: string };

export type VoiceSettings = { stability?: number; similarity_boost?: number; style?: number };

export type Voice = {
  id: string;
  name: string;
  previewUrl: string | null;
  category: string | null;
  labels: Record<string, string>;
};

export type DubbingStatus =
  | { state: 'pending' }
  | { state: 'done'; seconds?: number }
  | { state: 'failed'; error: string };

export type AudioProvider = {
  speak(input: { text: string; voiceId: string; model: string; settings: VoiceSettings }): Promise<AudioFile>;
  changeVoice(input: { media: AudioFile; voiceId: string; model: string; settings: VoiceSettings }): Promise<AudioFile>;
  isolate(input: { media: AudioFile }): Promise<AudioFile>;
  compose(input: { prompt: string; seconds: number; model: string }): Promise<AudioFile>;
  soundEffect(input: { prompt: string; seconds: number; model: string }): Promise<AudioFile>;
  startDubbing(input: { media: AudioFile; targetLanguage: string }): Promise<{ jobId: string }>;
  dubbingStatus(jobId: string): Promise<DubbingStatus>;
  dubbedFile(jobId: string, language: string): Promise<AudioFile>;
  voices(): Promise<Voice[]>;
  forgetDubbing(jobId: string): Promise<void>;
  forgetHistoryItem(historyItemId: string): Promise<void>;
};
