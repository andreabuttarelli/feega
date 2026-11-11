import { kindOf, type PromptKind } from '$lib/home/prompt-kinds';
import { OverLogin, PROMPT_SOURCES, sourceOf, type PromptSource, type SourcePick } from '$lib/home/prompt-sources';

export const HOME_DRAFT_COOKIE = 'feega_home_draft';

const DRAFT_KEY = 'feega.home.draft';
const DRAFT_COOKIE_MAX_AGE_S = 60 * 60;
const MAX_DRAFT_BYTES = 4_000_000;

export type HomeDraft = { text: string; kind: PromptKind; files: File[]; pick: SourcePick | null };

export type ResumedDraft = HomeDraft & { pickAgain: PromptSource | null };

type StoredFile = { name: string; type: string; data: string };
type Stored = { text: string; kind: string; files: StoredFile[]; source?: string; sourceValue?: string };

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
  const kept = draft.pick && PROMPT_SOURCES[draft.pick.source].overLogin === OverLogin.Kept ? draft.pick.value : undefined;
  const stored: Stored = { text: draft.text, kind: draft.kind, files: await fitting(draft.files), source: draft.pick?.source, sourceValue: kept };
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

function resumedPick(stored: Stored): { pick: SourcePick | null; pickAgain: PromptSource | null } {
  const source = sourceOf(stored.source);
  if (!source) {
    return { pick: null, pickAgain: null };
  }
  return stored.sourceValue ? { pick: { source, value: stored.sourceValue }, pickAgain: null } : { pick: null, pickAgain: source };
}

export async function takeDraft(store: DraftStore): Promise<ResumedDraft | null> {
  const stored = parsed(store.getItem(DRAFT_KEY));
  store.removeItem(DRAFT_KEY);
  const kind = stored ? kindOf(stored.kind) : null;
  if (!stored || !kind) {
    return null;
  }

  return { text: stored.text, kind, files: await Promise.all((stored.files ?? []).map(asFile)), ...resumedPick(stored) };
}
