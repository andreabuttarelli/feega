import type { MediaKind } from '$lib/motion/media/pick';

export type LibraryMedia = { id: string; kind: string; label: string; previewUrl: string; url?: string | null; seconds?: number | null };

export type UploadOutcome = { ok: true; asset: LibraryMedia & { kind: MediaKind } } | { ok: false; error: string };

export type MediaUploader = (file: File, progress: (fraction: number) => void) => Promise<UploadOutcome>;
