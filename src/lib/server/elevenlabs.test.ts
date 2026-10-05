import { describe, expect, it, vi } from 'vitest';
import { elevenLabs } from './elevenlabs';

const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00]);

function audioReply(mime = 'audio/mpeg') {
  return new Response(MP3, { status: 200, headers: { 'content-type': mime } });
}

function recorder(reply: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return reply();
  });
  return { calls, provider: elevenLabs({ apiKey: 'k', baseUrl: 'https://api.test', fetchFn: fetchFn as typeof fetch }) };
}

describe('elevenLabs adapter', () => {
  it('speaks: POST /v1/text-to-speech/{voice} with model and voice settings, mp3 out', async () => {
    const { calls, provider } = recorder(() => audioReply());
    const out = await provider.speak({ text: 'Ciao', voiceId: 'v1', model: 'eleven_multilingual_v2', settings: { stability: 0.4 } });

    expect(calls[0].url).toBe('https://api.test/v1/text-to-speech/v1?output_format=mp3_44100_128');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['xi-api-key']).toBe('k');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      text: 'Ciao',
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4 }
    });
    expect(out.mime).toBe('audio/mpeg');
    expect(out.bytes.byteLength).toBe(MP3.byteLength);
  });

  it('changes a voice with multipart audio to /v1/speech-to-speech/{voice}', async () => {
    const { calls, provider } = recorder(() => audioReply());
    await provider.changeVoice({ media: { bytes: MP3, mime: 'audio/mpeg' }, voiceId: 'v2', model: 'eleven_multilingual_sts_v2', settings: {} });

    expect(calls[0].url).toBe('https://api.test/v1/speech-to-speech/v2?output_format=mp3_44100_128');
    const form = calls[0].init.body as FormData;
    expect(form.get('model_id')).toBe('eleven_multilingual_sts_v2');
    expect(form.get('audio')).toBeInstanceOf(Blob);
  });

  it('isolates a voice at /v1/audio-isolation', async () => {
    const { calls, provider } = recorder(() => audioReply());
    await provider.isolate({ media: { bytes: MP3, mime: 'audio/mpeg' } });
    expect(calls[0].url).toBe('https://api.test/v1/audio-isolation');
    expect((calls[0].init.body as FormData).get('audio')).toBeInstanceOf(Blob);
  });

  it('composes music with the length in milliseconds', async () => {
    const { calls, provider } = recorder(() => audioReply());
    await provider.compose({ prompt: 'lofi', seconds: 30, model: 'music_v1' });
    expect(calls[0].url).toBe('https://api.test/v1/music?output_format=mp3_44100_128');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ prompt: 'lofi', music_length_ms: 30000, model_id: 'music_v1' });
  });

  it('makes a sound effect with the duration in seconds', async () => {
    const { calls, provider } = recorder(() => audioReply());
    await provider.soundEffect({ prompt: 'door', seconds: 5, model: 'eleven_text_to_sound_v2' });
    expect(calls[0].url).toBe('https://api.test/v1/sound-generation?output_format=mp3_44100_128');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ text: 'door', duration_seconds: 5, model_id: 'eleven_text_to_sound_v2' });
  });

  it('starts dubbing and returns the job id', async () => {
    const { calls, provider } = recorder(() => Response.json({ dubbing_id: 'd1', expected_duration_sec: 12 }));
    const job = await provider.startDubbing({ media: { bytes: MP3, mime: 'video/mp4' }, targetLanguage: 'it' });
    expect(calls[0].url).toBe('https://api.test/v1/dubbing');
    const form = calls[0].init.body as FormData;
    expect(form.get('target_lang')).toBe('it');
    expect(form.get('file')).toBeInstanceOf(Blob);
    expect(job).toEqual({ jobId: 'd1' });
  });

  it('reads dubbing status as pending, done with seconds, or failed with the reason', async () => {
    const pending = recorder(() => Response.json({ status: 'dubbing' }));
    expect(await pending.provider.dubbingStatus('d1')).toEqual({ state: 'pending' });
    expect(pending.calls[0].url).toBe('https://api.test/v1/dubbing/d1');

    const done = recorder(() => Response.json({ status: 'dubbed', media_metadata: { duration: 12.5, content_type: 'video/mp4' } }));
    expect(await done.provider.dubbingStatus('d1')).toEqual({ state: 'done', seconds: 12.5 });

    const failed = recorder(() => Response.json({ status: 'failed', error: 'no speech' }));
    expect(await failed.provider.dubbingStatus('d1')).toEqual({ state: 'failed', error: 'no speech' });
  });

  it('downloads the dubbed file for the language', async () => {
    const { calls, provider } = recorder(() => audioReply('video/mp4'));
    const file = await provider.dubbedFile('d1', 'it');
    expect(calls[0].url).toBe('https://api.test/v1/dubbing/d1/audio/it');
    expect(file.mime).toBe('video/mp4');
  });

  it('lists voices with their preview', async () => {
    const { calls, provider } = recorder(() =>
      Response.json({ voices: [{ voice_id: 'v1', name: 'Rachel', preview_url: 'https://p/1.mp3', category: 'premade', labels: { accent: 'american' } }] })
    );
    expect(await provider.voices()).toEqual([
      { id: 'v1', name: 'Rachel', previewUrl: 'https://p/1.mp3', category: 'premade', labels: { accent: 'american' } }
    ]);
    expect(calls[0].url).toBe('https://api.test/v2/voices?page_size=100');
  });

  it('lists only premade voices, never the custom voices other workspaces made on the shared account', async () => {
    const { provider } = recorder(() =>
      Response.json({
        voices: [
          { voice_id: 'v1', name: 'Rachel', category: 'premade' },
          { voice_id: 'c1', name: 'Someone else', category: 'cloned' },
          { voice_id: 'g1', name: 'Designed', category: 'generated' }
        ]
      })
    );
    expect((await provider.voices()).map((v) => v.id)).toEqual(['v1']);
  });

  it('turns an API error into a readable message', async () => {
    const { provider } = recorder(() =>
      Response.json({ detail: { status: 'quota_exceeded', message: 'This request exceeds your quota.' } }, { status: 401 })
    );
    await expect(provider.speak({ text: 'x', voiceId: 'v', model: 'm', settings: {} })).rejects.toThrow(
      'ElevenLabs 401: This request exceeds your quota.'
    );
  });

  it('carries the history item id ElevenLabs keeps for a generation', async () => {
    const { provider } = recorder(() => new Response(MP3, { status: 200, headers: { 'content-type': 'audio/mpeg', 'history-item-id': 'h1' } }));
    const out = await provider.speak({ text: 'Ciao', voiceId: 'v1', model: 'm', settings: {} });
    expect(out.historyItemId).toBe('h1');
  });

  it('deletes a dubbing project with DELETE /v1/dubbing/{id}', async () => {
    const { calls, provider } = recorder(() => Response.json({ status: 'ok' }));
    await provider.forgetDubbing('dub1');
    expect(calls[0].url).toBe('https://api.test/v1/dubbing/dub1');
    expect(calls[0].init.method).toBe('DELETE');
  });

  it('deletes a history item with DELETE /v1/history/{id}', async () => {
    const { calls, provider } = recorder(() => Response.json({ status: 'ok' }));
    await provider.forgetHistoryItem('h1');
    expect(calls[0].url).toBe('https://api.test/v1/history/h1');
    expect(calls[0].init.method).toBe('DELETE');
  });

  it('a delete of something already gone counts as done', async () => {
    const { provider } = recorder(() => Response.json({ detail: 'not found' }, { status: 404 }));
    await expect(provider.forgetDubbing('gone')).resolves.toBeUndefined();
  });

  it('a delete ElevenLabs refuses throws, so the caller retries', async () => {
    const { provider } = recorder(() => Response.json({ detail: 'boom' }, { status: 500 }));
    await expect(provider.forgetHistoryItem('h1')).rejects.toThrow(/500/);
  });
});
