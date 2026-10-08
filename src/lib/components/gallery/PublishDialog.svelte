<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import { deserialize } from '$app/forms';
  import CompositionPlayer from '$lib/components/motion/CompositionPlayer.svelte';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';
  import { DESCRIPTION_MAX, itemPath, TAGS_MAX, TITLE_MAX } from '$lib/gallery/model';

  export type Listed = { id: string; title: string };

  let {
    actionUrl,
    doc,
    assets,
    tokens,
    name,
    listed,
    saved,
    onlisted,
    onclose
  }: {
    actionUrl: string;
    doc: MotionDoc;
    assets: Record<string, string>;
    tokens: BrandTokens;
    name: string;
    listed: Listed | null;
    saved: boolean;
    onlisted: (item: Listed | null) => void;
    onclose: () => void;
  } = $props();

  let title = $state(name);
  let description = $state('');
  let tags = $state('');
  let busy = $state(false);
  let error = $state('');

  async function post(action: string, form: FormData): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(`${actionUrl}${actionUrl.includes('?') ? '&' : '?'}/${action}`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
    const result = deserialize(await res.text());
    if (result.type === 'success') {
      return { ok: true, data: (result.data ?? {}) as Record<string, unknown> };
    }
    return { ok: false, data: (result.type === 'failure' ? result.data : { error: 'The request failed.' }) as Record<string, unknown> };
  }

  async function publish() {
    busy = true;
    error = '';
    const form = new FormData();
    form.set('title', title);
    form.set('description', description);
    form.set('tags', tags);
    const done = await post('publishGallery', form).catch(() => ({ ok: false, data: { error: 'The request failed.' } as Record<string, unknown> }));
    busy = false;
    if (!done.ok) {
      error = String(done.data.error ?? 'Refused.');
      return;
    }
    onlisted({ id: String(done.data.id), title });
  }

  async function withdraw() {
    if (!listed) {
      return;
    }
    busy = true;
    const form = new FormData();
    form.set('id', listed.id);
    const done = await post('withdrawGallery', form).catch(() => ({ ok: false, data: { error: 'The request failed.' } as Record<string, unknown> }));
    busy = false;
    if (!done.ok) {
      error = String(done.data.error ?? 'Refused.');
      return;
    }
    onlisted(null);
  }
</script>

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Publish to gallery" data-testid="publish-dialog">
  <header><span>Publish to gallery</span><button type="button" aria-label="Close" onclick={onclose}><X size={16} /></button></header>

  <div class="preview" style={`aspect-ratio: ${doc.width} / ${doc.height};`}><CompositionPlayer {doc} {assets} {tokens} /></div>

  {#if listed}
    <p>
      <strong>{listed.title}</strong> is in the gallery.
      <a href={itemPath(listed.id)} target="_blank" rel="noopener" data-testid="publish-link">Open <ExternalLink size={12} /></a>
    </p>
    <p class="muted">Withdrawing takes it and its files down. Copies people already remixed stay theirs.</p>
    <button type="button" class="secondary" onclick={withdraw} disabled={busy} data-testid="publish-withdraw">Withdraw</button>
  {:else}
    <label><span>Title</span><input bind:value={title} maxlength={TITLE_MAX} data-testid="publish-title" /></label>
    <label><span>Description</span><textarea rows="3" bind:value={description} maxlength={DESCRIPTION_MAX}></textarea></label>
    <label><span>Tags, up to {TAGS_MAX}, separated by commas</span><input bind:value={tags} placeholder="launch, ui, glass" data-testid="publish-tags" /></label>
    <p class="muted">Anyone can watch it and remix it for free, credited to your workspace. Its files are copied to a public folder. Not allowed: uncensored projects, real brands (their logo, a real-brand script, logos or pictures imported from a website), and anything the moderation refuses.</p>
    <button type="button" class="primary" onclick={publish} disabled={busy || !saved || !title.trim()} data-testid="publish-submit">{!saved ? 'Saving your changes…' : busy ? 'Checking and publishing…' : 'Publish'}</button>
  {/if}

  {#if error}<p class="warn" role="alert" data-testid="publish-error">{error}</p>{/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 40;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(480px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow: auto;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
    font-size: 13px;
  }

  header {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }

  .preview {
    align-self: center;
    height: 240px;
    max-width: 100%;
    background: var(--ui-surface);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--ui-ink-2);
  }

  input,
  textarea {
    padding: 6px 8px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    text-decoration: underline;
  }

  .muted {
    color: var(--ui-ink-3);
    font-size: 12px;
  }

  .warn {
    color: var(--ui-danger);
  }

  .primary,
  .secondary {
    height: 36px;
    padding: 0 12px;
    border: 0;
    font-weight: 600;
  }

  .primary {
    background: var(--ui-ink);
    color: var(--ui-bg);
  }

  .secondary {
    background: var(--ui-surface);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
  }

  .primary:disabled,
  .secondary:disabled {
    opacity: 0.5;
  }
</style>
