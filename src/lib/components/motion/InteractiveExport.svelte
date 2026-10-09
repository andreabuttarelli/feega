<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { AudioAnalysis } from '$lib/motion/audio-analysis';
  import { interactiveBundle, type InteractiveBundle } from '$lib/motion/interactive/bundle';
  import { snippetOf } from '$lib/motion/interactive/loader';
  import { interactiveOf, type Interactive } from '$lib/motion/interactive/settings';
  import { reactionsOf } from '$lib/motion/interactive/summary';
  import EmbedView from './EmbedView.svelte';

  let {
    doc,
    tokens,
    assetUrls,
    analyses = {},
    fileName,
    editorUrl,
    onpresets
  }: { doc: MotionDoc; tokens: BrandTokens; assetUrls: Record<string, string>; analyses?: Record<string, AudioAnalysis>; fileName: string; editorUrl: string; onpresets?: () => void } = $props();

  type Hosted = { published: boolean; url: string };
  type Slot = { ok: true; url: string; upload: { url: string; headers: Record<string, string> } } | { ok: false; error: string };

  let settings = $state<Interactive>({ ...interactiveOf(doc) });
  let bundle = $state<InteractiveBundle | null>(null);
  let error = $state('');
  let hosted = $state<Hosted | null>(null);
  let hosting = $state(false);
  let updated = $state(false);
  const embedEndpoint = $derived(`${editorUrl}/embed`);
  const hostedSnippet = $derived(hosted?.published ? snippetOf(hosted.url) : '');
  const reactions = $derived(reactionsOf({ ...doc, interactive: settings }));
  const blobs = new Map<string, Promise<Blob>>();
  const fetchBlob = (url: string) => {
    if (!blobs.has(url)) {
      blobs.set(url, fetch(url).then((r) => r.blob()));
    }
    return blobs.get(url)!;
  };

  const href = $derived(bundle ? URL.createObjectURL(new Blob([bundle.html], { type: 'text/html' })) : '');

  $effect(() => {
    const wanted = { ...settings };
    bundle = null;
    error = '';
    interactiveBundle({ doc, tokens, assetUrls, analyses, settings: wanted, title: fileName, fetchBlob }).then(
      (b) => (bundle = b),
      (e) => (error = e instanceof Error ? e.message : String(e))
    );
  });

  $effect(() => {
    fetch(embedEndpoint).then(
      async (r) => (hosted = r.ok ? await r.json() : null),
      () => (hosted = null)
    );
  });

  async function publish() {
    if (!bundle) {
      return;
    }
    hosting = true;
    error = '';
    try {
      const slot: Slot = await (await fetch(embedEndpoint, { method: 'POST' })).json();
      if (!slot.ok) {
        throw new Error(slot.error);
      }
      const put = await fetch(slot.upload.url, { method: 'PUT', headers: slot.upload.headers, body: bundle.html });
      if (!put.ok) {
        throw new Error(`Publishing failed (${put.status})`);
      }
      updated = Boolean(hosted?.published);
      hosted = { published: true, url: slot.url };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      hosting = false;
    }
  }

  async function unpublish() {
    hosting = true;
    const res = await fetch(embedEndpoint, { method: 'DELETE' });
    hosting = false;
    if (!res.ok) {
      error = 'Unpublishing failed';
      return;
    }
    updated = false;
    hosted = hosted && { ...hosted, published: false };
  }
</script>

<EmbedView {doc} {bundle} {href} {hosted} {hostedSnippet} {reactions} bind:settings busy={hosting} {error} {updated} onpublish={publish} onunpublish={unpublish} {onpresets} />
