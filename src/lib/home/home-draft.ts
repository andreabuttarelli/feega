import { kindOf, type PromptKind } from '$lib/home/prompt-kinds';

export const HOME_DRAFT_COOKIE = 'feega_home_draft';

const DRAFT_KEY = 'feega.home.draft';
const DRAFT_COOKIE_MAX_AGE_S = 60 * 60;
const MAX_DRAFT_BYTES = 4_000_000;

export type HomeDraft = { text: string; kind: PromptKind; files: File[] };

type StoredFile = { name: string; type: string; data: string };
type Stored = { text: string; kind: string; files: StoredFile[] };

export type DraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const CHUNK = 0x8000;

async function asDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

async function asFile(stored: StoredFile): Promise<File> {
  const blob = await (await fetch(stored.data)).blob();
  return new File([blob], stored.name, { type: stored.type });
}

async function fitting(files: readonly File[]): Promise<StoredFile[]> {
  const kept: StoredFile[] = [];
  let bytes = 0;
  for (const file of files) {
    const data = await asDataUrl(file);
    if (bytes + data.length > MAX_DRAFT_BYTES) {
      continue;
    }
    bytes += data.length;
    kept.push({ name: file.name, type: file.type, data });
  }
  return kept;
}

export async function saveDraft(store: DraftStore, draft: HomeDraft): Promise<void> {
  const stored: Stored = { text: draft.text, kind: draft.kind, files: await fitting(draft.files) };
  store.setItem(DRAFT_KEY, JSON.stringify(stored));
  document.cookie = `${HOME_DRAFT_COOKIE}=1; path=/; max-age=${DRAFT_COOKIE_MAX_AGE_S}; samesite=lax`;
}

function parsed(raw: string | null): Stored | null {
  try {
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export async function takeDraft(store: DraftStore): Promise<HomeDraft | null> {
  const stored = parsed(store.getItem(DRAFT_KEY));
  store.removeItem(DRAFT_KEY);
  const kind = stored ? kindOf(stored.kind) : null;
  if (!stored || !kind) {
    return null;
  }

  return { text: stored.text, kind, files: await Promise.all((stored.files ?? []).map(asFile)) };
}
