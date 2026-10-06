import { describe, expect, it } from 'vitest';
import { cloneFormOf, libraryFiltersOf, MAX_SAMPLE_BYTES } from './voice-forms';

function form(entries: Record<string, string | Blob>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.append(k, v);
  }
  return fd;
}

describe('the clone form', () => {
  it('reads name, consent, seconds and the recording', async () => {
    const out = await cloneFormOf(
      form({ name: ' Me ', consent_basis: 'own_voice', speaker: '', attested: 'on', seconds: '64.5', sample: new Blob([new Uint8Array([1, 2])], { type: 'audio/webm;codecs=opus' }) })
    );
    expect(out).toMatchObject({ name: 'Me', consentBasis: 'own_voice', attested: true, seconds: 64.5 });
    expect(out && 'samples' in out && out.samples[0]).toMatchObject({ mime: 'audio/webm;codecs=opus' });
  });

  it('refuses a missing recording or name', async () => {
    expect(await cloneFormOf(form({ name: 'x' }))).toEqual({ error: 'recording_required' });
    expect(await cloneFormOf(form({ sample: new Blob([new Uint8Array([1])]) }))).toEqual({ error: 'name_required' });
  });

  it('refuses an oversized recording', async () => {
    const big = new Blob([new Uint8Array(MAX_SAMPLE_BYTES + 1)]);
    expect(await cloneFormOf(form({ name: 'x', sample: big }))).toEqual({ error: 'recording_too_large' });
  });

  it('treats an unchecked attestation as not attested', async () => {
    const out = await cloneFormOf(form({ name: 'x', consent_basis: 'own_voice', seconds: '70', sample: new Blob([new Uint8Array([1])]) }));
    expect(out).toMatchObject({ attested: false });
  });
});

describe('library filters', () => {
  it('keep only known fields and a positive page', () => {
    expect(libraryFiltersOf(form({ search: 'calm', gender: 'female', page: '-3', evil: 'x' }))).toEqual({ search: 'calm', gender: 'female', page: 0 });
  });
});
