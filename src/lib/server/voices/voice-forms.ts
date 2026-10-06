import type { AudioFile } from '$lib/server/canvas/audio-provider';
import type { ConsentBasis } from '$lib/canvas/voices';
import type { LibraryFilters } from './voice-provider';

export const MAX_SAMPLE_BYTES = 10 * 1024 * 1024;
const MAX_NAME = 100;
const TEXT_FILTERS = ['search', 'language', 'gender', 'accent', 'useCase'] as const;

export type CloneForm = { name: string; consentBasis: ConsentBasis; speaker: string; attested: boolean; seconds: number; samples: AudioFile[] };

export type FormError = { error: 'recording_required' | 'recording_too_large' | 'name_required' };

function text(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

export async function cloneFormOf(fd: FormData): Promise<CloneForm | FormError> {
  const sample = fd.get('sample');
  if (!(sample instanceof Blob) || sample.size === 0) {
    return { error: 'recording_required' };
  }
  if (sample.size > MAX_SAMPLE_BYTES) {
    return { error: 'recording_too_large' };
  }
  const name = text(fd, 'name').slice(0, MAX_NAME);
  if (!name) {
    return { error: 'name_required' };
  }
  return {
    name,
    consentBasis: text(fd, 'consent_basis') as ConsentBasis,
    speaker: text(fd, 'speaker'),
    attested: fd.get('attested') === 'on',
    seconds: Number(fd.get('seconds')) || 0,
    samples: [{ bytes: new Uint8Array(await sample.arrayBuffer()), mime: sample.type || 'audio/webm' }]
  };
}

export function libraryFiltersOf(fd: FormData): LibraryFilters {
  const filters: LibraryFilters = { page: Math.max(0, Math.floor(Number(fd.get('page')) || 0)) };
  for (const key of TEXT_FILTERS) {
    const value = text(fd, key);
    if (value) {
      filters[key] = value;
    }
  }
  return filters;
}
