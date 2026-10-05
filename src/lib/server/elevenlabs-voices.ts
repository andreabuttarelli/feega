import { ELEVENLABS_BASE_URL, readableError } from './elevenlabs';
import type { LibraryFilters, LibraryVoice, VoiceProvider } from './voices/voice-provider';

const LIBRARY_PAGE_SIZE = 30;
const ACCOUNT_PAGE_SIZE = 100;
const DESIGN_MODEL = 'eleven_multilingual_ttv_v2';
const HTTP_NOT_FOUND = 404;

type Config = { apiKey: string; baseUrl?: string; fetchFn?: typeof fetch };

type SharedRow = {
  public_owner_id: string;
  voice_id: string;
  name: string;
  preview_url?: string | null;
  category?: string | null;
  gender?: string | null;
  accent?: string | null;
  language?: string | null;
  use_case?: string | null;
};

type AccountRow = { voice_id: string; labels?: Record<string, string> | null };

const LIBRARY_PARAM: Readonly<Record<keyof LibraryFilters, string>> = {
  search: 'search',
  language: 'language',
  gender: 'gender',
  accent: 'accent',
  useCase: 'use_cases',
  page: 'page'
};

function libraryQuery(filters: LibraryFilters): string {
  const query = new URLSearchParams({ page_size: String(LIBRARY_PAGE_SIZE) });
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') {
      continue;
    }
    query.set(LIBRARY_PARAM[key as keyof LibraryFilters], String(value));
  }
  return query.toString();
}

function libraryVoice(row: SharedRow): LibraryVoice {
  return {
    id: row.voice_id,
    ownerId: row.public_owner_id,
    name: row.name,
    previewUrl: row.preview_url ?? null,
    category: row.category ?? null,
    labels: {},
    language: row.language ?? null,
    gender: row.gender ?? null,
    accent: row.accent ?? null,
    useCase: row.use_case ?? null
  };
}

export function elevenLabsVoices(config: Config): VoiceProvider {
  const base = config.baseUrl ?? ELEVENLABS_BASE_URL;
  const fetchFn = config.fetchFn ?? fetch;
  const auth = { 'xi-api-key': config.apiKey };

  async function send(path: string, init: RequestInit = { method: 'GET' }): Promise<Response> {
    const headers = { ...auth, ...(init.headers as Record<string, string> | undefined) };
    const res = await fetchFn(`${base}${path}`, { ...init, headers });
    if (!res.ok) {
      throw await readableError(res);
    }
    return res;
  }

  async function sendJson<T>(path: string, body: unknown): Promise<T> {
    const res = await send(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()) as T;
  }

  async function forget(path: string): Promise<void> {
    const res = await fetchFn(`${base}${path}`, { method: 'DELETE', headers: auth });
    if (!res.ok && res.status !== HTTP_NOT_FOUND) {
      throw await readableError(res);
    }
  }

  return {
    async library(filters) {
      const res = await send(`/v1/shared-voices?${libraryQuery(filters)}`);
      const body = (await res.json()) as { voices?: SharedRow[]; has_more?: boolean };
      return { voices: (body.voices ?? []).map(libraryVoice), hasMore: Boolean(body.has_more) };
    },

    async design({ description }) {
      const body = await sendJson<{ previews?: { generated_voice_id: string; audio_base_64: string; media_type?: string }[] }>(
        '/v1/text-to-voice/design',
        { voice_description: description, model_id: DESIGN_MODEL, auto_generate_text: true }
      );
      return (body.previews ?? []).map((p) => ({ generatedVoiceId: p.generated_voice_id, audioBase64: p.audio_base_64, mime: p.media_type ?? 'audio/mpeg' }));
    },

    async saveDesign({ generatedVoiceId, name, description, labels }) {
      const body = await sendJson<{ voice_id: string }>('/v1/text-to-voice', {
        voice_name: name,
        voice_description: description,
        generated_voice_id: generatedVoiceId,
        labels
      });
      return body.voice_id;
    },

    async clone({ name, samples, labels }) {
      const form = new FormData();
      form.append('name', name);
      form.append('remove_background_noise', 'true');
      form.append('labels', JSON.stringify(labels));
      samples.forEach((sample, index) => {
        const extension = sample.mime.split('/')[1]?.split(';')[0] ?? 'bin';
        form.append('files', new Blob([sample.bytes as BlobPart], { type: sample.mime }), `sample-${index}.${extension}`);
      });
      const res = await send('/v1/voices/add', { method: 'POST', body: form });
      return ((await res.json()) as { voice_id: string }).voice_id;
    },

    async sampleIds(voiceId) {
      const res = await send(`/v1/voices/${encodeURIComponent(voiceId)}`);
      const body = (await res.json()) as { samples?: { sample_id: string }[] | null };
      return (body.samples ?? []).map((s) => s.sample_id);
    },

    deleteSample(voiceId, sampleId) {
      return forget(`/v1/voices/${encodeURIComponent(voiceId)}/samples/${encodeURIComponent(sampleId)}`);
    },

    remove(voiceId) {
      return forget(`/v1/voices/${encodeURIComponent(voiceId)}`);
    },

    async labelled(label) {
      const found: { voiceId: string; value: string }[] = [];
      let token: string | null = null;
      do {
        const query = new URLSearchParams({ page_size: String(ACCOUNT_PAGE_SIZE) });
        if (token) {
          query.set('next_page_token', token);
        }
        const res = await send(`/v2/voices?${query}`);
        const body = (await res.json()) as { voices?: AccountRow[]; has_more?: boolean; next_page_token?: string | null };
        for (const row of body.voices ?? []) {
          const value = row.labels?.[label];
          if (value) {
            found.push({ voiceId: row.voice_id, value });
          }
        }
        token = body.has_more ? body.next_page_token ?? null : null;
      } while (token);
      return found;
    },

    async slots() {
      const res = await send('/v1/user/subscription');
      const body = (await res.json()) as { voice_slots_used?: number; voice_limit?: number };
      return { used: body.voice_slots_used ?? 0, limit: body.voice_limit ?? 0 };
    }
  };
}
