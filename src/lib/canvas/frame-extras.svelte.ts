import type { SupabaseClient } from '@supabase/supabase-js';
import { loadPageData, postPageAction } from '$lib/api/page-action';
import type { EditorPageData } from '$lib/server/frame-editor/editor-page';
import type { AudioAnalysis } from '$lib/motion/audio-analysis';
import type { MotionDoc } from '$lib/motion/doc';
import { FONT_FILE, MAX_FONT_MB, fontFamilies, missingUploads, type FontFamily, type FontFile, type FontLibrary, type FontUploaded } from '$lib/motion/fonts/library';
import { orgFontPrefix } from '$lib/motion/fonts/upload-path';
import { canvasMediaUploader } from './media-uploader';
import type { MediaUploader } from '$lib/components/motion/media-upload';

const BYTES_PER_MB = 1024 * 1024;
const UNSAFE_NAME = /[^\w.-]+/g;

type Loaded = EditorPageData;
type FrameAsset = Loaded['assets'][number];

export type FrameAt = { projectId: string; canvasId: string; nodeId: string };

export class FrameExtras implements FontLibrary {
  data = $state.raw<Loaded | null>(null);
  made = $state.raw<FrameAsset[]>([]);
  families = $state.raw<FontFamily[]>([]);
  gone = $state.raw<string[]>([]);
  analyses = $state.raw<Record<string, AudioAnalysis>>({});

  readonly editorUrl: string;
  private loading: Promise<void> | null = null;
  private readonly at: FrameAt;
  private readonly supabase: SupabaseClient;
  private readonly docOf: () => MotionDoc;

  constructor(at: FrameAt, supabase: SupabaseClient, docOf: () => MotionDoc) {
    this.at = at;
    this.docOf = docOf;
    this.supabase = supabase;
    this.editorUrl = `/p/${at.projectId}/c/${at.canvasId}/motion/${at.nodeId}`;
  }

  load(): Promise<void> {
    this.loading ??= loadPageData<Loaded>(new URL(this.editorUrl, location.origin)).then((data) => {
      this.data = data;
      this.families = data.fonts;
    });
    return this.loading;
  }

  get assets(): FrameAsset[] {
    const served = this.data?.assets ?? [];
    const known = new Set(served.map((a) => a.id));
    return [...this.made.filter((a) => !known.has(a.id)), ...served].filter((a) => !this.gone.includes(a.id));
  }

  async refresh() {
    this.loading = null;
    await this.load();
  }

  get assetUrls(): Record<string, string> {
    return Object.fromEntries(this.assets.filter((a) => a.url).map((a) => [a.id, a.url as string]));
  }

  readonly uploadMedia: MediaUploader = async (file, progress) => {
    await this.load();
    const send = canvasMediaUploader(this.supabase, {
      orgId: this.data!.orgId,
      projectId: this.at.projectId,
      canvasId: this.at.canvasId
    });
    const outcome = await send(file, progress);
    if (outcome.ok) {
      this.made = [
        {
          seconds: null,
          width: null,
          height: null,
          ...outcome.asset,
          url: outcome.asset.url ?? null
        } as unknown as FrameAsset,
        ...this.made
      ];
      void this.refresh();
    }
    return outcome;
  };

  addAsset(asset: FrameAsset) {
    this.made = [asset, ...this.made];
  }

  async analyse(ids: string[]) {
    const fresh = ids.filter((id) => !this.analyses[id]);
    if (!fresh.length) {
      return;
    }
    const form = new FormData();
    fresh.forEach((id) => form.append('assetId', id));
    const result = await postPageAction(this.editorUrl, 'analyze', form);
    if (result.type === 'success') {
      this.analyses = {
        ...this.analyses,
        ...((result.data as { analyses: Record<string, AudioAnalysis> }).analyses ?? {})
      };
    }
  }

  get missing(): string[] {
    return missingUploads(this.docOf().fonts, this.assetUrls);
  }

  async upload(file: File): Promise<FontUploaded> {
    await this.load();
    if (!FONT_FILE.test(file.name)) {
      return {
        ok: false,
        error: 'Not a font: upload a TTF, OTF, WOFF or WOFF2 file'
      };
    }
    if (file.size > MAX_FONT_MB * BYTES_PER_MB) {
      return { ok: false, error: `A font file is at most ${MAX_FONT_MB}MB` };
    }
    const path = `${orgFontPrefix(this.data!.orgId)}${crypto.randomUUID()}-${file.name.replace(UNSAFE_NAME, '_')}`;
    const up = await this.supabase.storage.from('canvas-assets').upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    });
    if (up.error) {
      return { ok: false, error: up.error.message };
    }
    const form = new FormData();
    form.set('path', path);
    const result = await postPageAction(this.editorUrl, 'uploadFont', form);
    if (result.type !== 'success' || !result.data?.asset) {
      return {
        ok: false,
        error: result.type === 'failure' ? String(result.data?.error ?? 'Upload refused') : 'Upload failed'
      };
    }
    const font = result.data.font as FontFile;
    this.addAsset(result.data.asset as FrameAsset);
    this.families = fontFamilies([...this.families.flatMap((f) => f.variants.map((v) => ({ ...v, family: f.family }))), font]);
    return { ok: true, family: font.family };
  }

  async rename(family: string, to: string): Promise<string | null> {
    const form = new FormData();
    form.set('family', family);
    form.set('to', to);
    const result = await postPageAction(this.editorUrl, 'renameFont', form);
    if (result.type !== 'success') {
      return result.type === 'failure' ? String(result.data?.error ?? 'Rename refused') : 'Rename failed';
    }
    this.families = this.families.map((f) => (f.family === family ? { ...f, family: to } : f));
    return null;
  }

  async remove(family: string): Promise<string | null> {
    const form = new FormData();
    form.set('family', family);
    const result = await postPageAction(this.editorUrl, 'deleteFont', form);
    if (result.type !== 'success') {
      return result.type === 'failure' ? String(result.data?.error ?? 'Delete refused') : 'Delete failed';
    }
    const ids = this.families.find((f) => f.family === family)?.variants.map((v) => v.assetId) ?? [];
    this.gone = [...this.gone, ...ids];
    this.families = this.families.filter((f) => f.family !== family);
    return null;
  }
}
