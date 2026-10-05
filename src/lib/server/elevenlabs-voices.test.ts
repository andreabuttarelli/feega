import { describe, expect, it, vi } from 'vitest';
import { elevenLabsVoices } from './elevenlabs-voices';

function recorder(reply: (url: string) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return reply(String(url));
  });
  return { calls, voices: elevenLabsVoices({ apiKey: 'k', baseUrl: 'https://api.test', fetchFn: fetchFn as typeof fetch }) };
}

describe('elevenLabs voices adapter', () => {
  it('searches the shared library with the picked filters', async () => {
    const { calls, voices } = recorder(() =>
      Response.json({
        has_more: true,
        voices: [{ public_owner_id: 'o1', voice_id: 'v1', name: 'Aria', preview_url: 'https://p', gender: 'female', accent: 'british', language: 'en', use_case: 'narrative_story', category: 'professional' }]
      })
    );
    const out = await voices.library({ search: 'calm', language: 'en', gender: 'female', accent: 'british', useCase: 'narrative_story', page: 2 });

    const url = new URL(calls[0].url);
    expect(url.pathname).toBe('/v1/shared-voices');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ search: 'calm', language: 'en', gender: 'female', accent: 'british', use_cases: 'narrative_story', page: '2' });
    expect(out.hasMore).toBe(true);
    expect(out.voices[0]).toMatchObject({ id: 'v1', ownerId: 'o1', name: 'Aria', previewUrl: 'https://p', gender: 'female', useCase: 'narrative_story' });
  });

  it('designs previews from a description', async () => {
    const { calls, voices } = recorder(() =>
      Response.json({ previews: [{ generated_voice_id: 'g1', audio_base_64: 'QUJD', media_type: 'audio/mpeg' }] })
    );
    const out = await voices.design({ description: 'a warm older narrator' });

    expect(calls[0].url).toBe('https://api.test/v1/text-to-voice/design');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ voice_description: 'a warm older narrator', auto_generate_text: true });
    expect(out).toEqual([{ generatedVoiceId: 'g1', audioBase64: 'QUJD', mime: 'audio/mpeg' }]);
  });

  it('saves a designed preview as a voice with our labels', async () => {
    const { calls, voices } = recorder(() => Response.json({ voice_id: 'v9' }));
    const id = await voices.saveDesign({ generatedVoiceId: 'g1', name: 'Narrator', description: 'warm', labels: { feega_org: 'o' } });

    expect(calls[0].url).toBe('https://api.test/v1/text-to-voice');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ voice_name: 'Narrator', voice_description: 'warm', generated_voice_id: 'g1', labels: { feega_org: 'o' } });
    expect(id).toBe('v9');
  });

  it('clones from samples as multipart with labels', async () => {
    const { calls, voices } = recorder(() => Response.json({ voice_id: 'v7', requires_verification: false }));
    const id = await voices.clone({ name: 'Me', samples: [{ bytes: new Uint8Array([1]), mime: 'audio/webm' }], labels: { feega_org: 'o' } });

    expect(calls[0].url).toBe('https://api.test/v1/voices/add');
    const form = calls[0].init.body as FormData;
    expect(form.get('name')).toBe('Me');
    expect(form.getAll('files')).toHaveLength(1);
    expect(JSON.parse(String(form.get('labels')))).toEqual({ feega_org: 'o' });
    expect(form.get('remove_background_noise')).toBe('true');
    expect(id).toBe('v7');
  });

  it('lists and deletes the samples of a voice', async () => {
    const { calls, voices } = recorder((url) => (url.endsWith('/v1/voices/v7') ? Response.json({ samples: [{ sample_id: 's1' }, { sample_id: 's2' }] }) : new Response(null, { status: 200 })));
    expect(await voices.sampleIds('v7')).toEqual(['s1', 's2']);
    await voices.deleteSample('v7', 's1');
    expect(calls[1]).toMatchObject({ url: 'https://api.test/v1/voices/v7/samples/s1', init: { method: 'DELETE' } });
  });

  it('deletes a voice and treats one already gone as deleted', async () => {
    const { calls, voices } = recorder(() => new Response(null, { status: 404 }));
    await voices.remove('v7');
    expect(calls[0]).toMatchObject({ url: 'https://api.test/v1/voices/v7', init: { method: 'DELETE' } });
  });

  it('lists the account voices carrying one of our labels', async () => {
    const { voices } = recorder(() =>
      Response.json({
        voices: [
          { voice_id: 'a', labels: { feega_org: 'o1' } },
          { voice_id: 'b', labels: {} },
          { voice_id: 'c', labels: null }
        ],
        has_more: false
      })
    );
    expect(await voices.labelled('feega_org')).toEqual([{ voiceId: 'a', value: 'o1' }]);
  });

  it('reads the voice slots of the account subscription', async () => {
    const { calls, voices } = recorder(() => Response.json({ voice_slots_used: 4, voice_limit: 30 }));
    expect(await voices.slots()).toEqual({ used: 4, limit: 30 });
    expect(calls[0].url).toBe('https://api.test/v1/user/subscription');
  });
});
