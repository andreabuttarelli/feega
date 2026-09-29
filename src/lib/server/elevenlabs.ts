import type { AudioFile, AudioProvider, DubbingStatus, Voice, VoiceSettings } from '$lib/server/canvas/audio-provider';

export const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io';

const MP3_OUTPUT = 'output_format=mp3_44100_128';
const VOICE_PAGE_SIZE = 100;
const MS_PER_SECOND = 1000;
const DUBBED = 'dubbed';
const FAILED = 'failed';
const DEFAULT_AUDIO_MIME = 'audio/mpeg';

type Config = { apiKey: string; baseUrl?: string; fetchFn?: typeof fetch };

type VoiceRow = {
  voice_id: string;
  name: string;
  preview_url?: string | null;
  category?: string | null;
  labels?: Record<string, string> | null;
};

function fileName(mime: string): string {
  const extension = mime.split('/')[1] ?? 'bin';
  return `input.${extension}`;
}

function mediaForm(field: string, media: AudioFile, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append(field, new Blob([media.bytes as BlobPart], { type: media.mime }), fileName(media.mime));
  for (const [key, value] of Object.entries(extra)) {
    form.append(key, value);
  }
  return form;
}

async function readableError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { detail?: { message?: string } | string } | null;
  const detail = body?.detail;
  const message = typeof detail === 'string' ? detail : detail?.message ?? res.statusText;
  return new Error(`ElevenLabs ${res.status}: ${message}`);
}

function hasSettings(settings: VoiceSettings): boolean {
  return Object.keys(settings).length > 0;
}

export function elevenLabs(config: Config): AudioProvider {
  const base = config.baseUrl ?? ELEVENLABS_BASE_URL;
  const fetchFn = config.fetchFn ?? fetch;
  const auth = { 'xi-api-key': config.apiKey };

  async function send(path: string, init: RequestInit): Promise<Response> {
    const headers = { ...auth, ...(init.headers as Record<string, string> | undefined) };
    const res = await fetchFn(`${base}${path}`, { ...init, headers });
    if (!res.ok) {
      throw await readableError(res);
    }
    return res;
  }

  async function audioOf(res: Response): Promise<AudioFile> {
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, mime: res.headers.get('content-type') ?? DEFAULT_AUDIO_MIME };
  }

  function postJson(path: string, body: unknown): Promise<AudioFile> {
    return send(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(audioOf);
  }

  return {
    speak({ text, voiceId, model, settings }) {
      const body = hasSettings(settings)
        ? { text, model_id: model, voice_settings: settings }
        : { text, model_id: model };
      return postJson(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?${MP3_OUTPUT}`, body);
    },

    changeVoice({ media, voiceId, model, settings }) {
      const extra: Record<string, string> = { model_id: model };
      if (hasSettings(settings)) {
        extra.voice_settings = JSON.stringify(settings);
      }
      return send(`/v1/speech-to-speech/${encodeURIComponent(voiceId)}?${MP3_OUTPUT}`, {
        method: 'POST',
        body: mediaForm('audio', media, extra)
      }).then(audioOf);
    },

    isolate({ media }) {
      return send('/v1/audio-isolation', { method: 'POST', body: mediaForm('audio', media) }).then(audioOf);
    },

    compose({ prompt, seconds, model }) {
      return postJson(`/v1/music?${MP3_OUTPUT}`, {
        prompt,
        music_length_ms: Math.round(seconds * MS_PER_SECOND),
        model_id: model
      });
    },

    soundEffect({ prompt, seconds, model }) {
      return postJson(`/v1/sound-generation?${MP3_OUTPUT}`, { text: prompt, duration_seconds: seconds, model_id: model });
    },

    async startDubbing({ media, targetLanguage }) {
      const res = await send('/v1/dubbing', { method: 'POST', body: mediaForm('file', media, { target_lang: targetLanguage }) });
      const body = (await res.json()) as { dubbing_id: string };
      return { jobId: body.dubbing_id };
    },

    async dubbingStatus(jobId): Promise<DubbingStatus> {
      const res = await send(`/v1/dubbing/${encodeURIComponent(jobId)}`, { method: 'GET' });
      const body = (await res.json()) as { status?: string; error?: string | null; media_metadata?: { duration?: number } };
      if (body.status === DUBBED) {
        const seconds = body.media_metadata?.duration;
        return typeof seconds === 'number' ? { state: 'done', seconds } : { state: 'done' };
      }
      if (body.status === FAILED) {
        return { state: 'failed', error: body.error || 'dubbing_failed' };
      }
      return { state: 'pending' };
    },

    dubbedFile(jobId, language) {
      const path = `/v1/dubbing/${encodeURIComponent(jobId)}/audio/${encodeURIComponent(language)}`;
      return send(path, { method: 'GET' }).then(audioOf);
    },

    async voices(): Promise<Voice[]> {
      const res = await send(`/v2/voices?page_size=${VOICE_PAGE_SIZE}`, { method: 'GET' });
      const body = (await res.json()) as { voices?: VoiceRow[] };
      return (body.voices ?? []).map((v) => ({
        id: v.voice_id,
        name: v.name,
        previewUrl: v.preview_url ?? null,
        category: v.category ?? null,
        labels: v.labels ?? {}
      }));
    }
  };
}
