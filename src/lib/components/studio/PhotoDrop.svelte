<script lang="ts" module>
  import type { QualityVerdict } from '$lib/studio/photo-quality';

  export type Checked = { file: File; previewUrl: string; width: number; height: number; verdict: QualityVerdict };
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { Camera, ImageUp, Check, TriangleAlert, CircleX } from '@lucide/svelte';
  import { photoQuality, Severity } from '$lib/studio/photo-quality';

  let { busy, stage, onpick }: { busy: boolean; stage: string | null; onpick: (photo: Checked) => void } = $props();

  let dragging = $state(false);
  let checked = $state<Checked | null>(null);
  let library = $state<HTMLInputElement | null>(null);
  let camera = $state<HTMLInputElement | null>(null);

  function dimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
    });
  }

  async function take(file: File | null | undefined) {
    if (!file || busy) {
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    const { width, height } = await dimensions(previewUrl);
    const verdict = photoQuality({ width, height, bytes: file.size, mimeType: file.type });
    checked = { file, previewUrl, width, height, verdict };
    if (verdict.ok) {
      onpick(checked);
    }
  }

  function fromInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    void take(input.files?.[0]);
    input.value = '';
  }

  function fromDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    void take(e.dataTransfer?.files?.[0]);
  }

  onMount(() => {
    const paste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        void take(file);
      }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  });
</script>

<div
  class="drop"
  class:dragging
  role="region"
  aria-label="Add a product photo"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={fromDrop}
  data-testid="studio-drop"
>
  {#if checked}
    <div class="checked">
      <img src={checked.previewUrl} alt="Your product" />
      <ul class="checks" aria-live="polite">
        {#if !checked.verdict.issues.length}
          <li class="ok"><Check size={16} /> Good photo: sharp and big enough.</li>
        {/if}
        {#each checked.verdict.issues as issue (issue.id)}
          <li class={issue.severity === Severity.Block ? 'block' : 'warn'}>
            {#if issue.severity === Severity.Block}<CircleX size={16} />{:else}<TriangleAlert size={16} />{/if}
            <span><strong>{issue.problem}</strong> {issue.fix}</span>
          </li>
        {/each}
        {#if stage}<li class="stage" data-testid="studio-upload-stage">{stage}</li>{/if}
      </ul>
    </div>
  {:else}
    <ImageUp size={32} strokeWidth={1.5} />
    <p class="lead">Drop a product photo here</p>
    <p class="muted">or paste it with Ctrl/⌘ V. JPG, PNG or WebP, up to 4 MB.</p>
  {/if}

  <div class="buttons">
    <button type="button" class="primary" disabled={busy} onclick={() => library?.click()}><ImageUp size={16} /> {checked ? 'Choose another photo' : 'Choose a photo'}</button>
    <button type="button" class="camera" disabled={busy} onclick={() => camera?.click()}><Camera size={16} /> Take a photo</button>
  </div>
  <input bind:this={library} type="file" accept="image/jpeg,image/png,image/webp" hidden onchange={fromInput} data-testid="studio-file" />
  <input bind:this={camera} type="file" accept="image/*" capture="environment" hidden onchange={fromInput} />
</div>

<style>
  .drop {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ui-space-2);
    padding: var(--ui-space-8) var(--ui-space-4);
    border: 1px dashed var(--ui-line-strong);
    background: var(--ui-surface);
    color: var(--ui-ink-2);
    text-align: center;
  }
  .drop.dragging {
    border-color: var(--ui-accent);
    background: var(--ui-accent-wash);
  }
  .lead {
    margin: 0;
    font-size: var(--ui-text-lg);
    font-weight: 600;
    color: var(--ui-ink);
  }
  .muted {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--ui-space-2);
    margin-top: var(--ui-space-2);
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-2);
    min-height: 40px;
    padding: 0 var(--ui-space-4);
    font-size: var(--ui-text-md);
    font-weight: 600;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    cursor: pointer;
  }
  button.primary {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
    color: var(--ui-accent-ink);
  }
  button:disabled {
    opacity: 0.5;
    cursor: progress;
  }
  .camera {
    display: none;
  }
  @media (pointer: coarse) {
    .camera {
      display: inline-flex;
    }
  }
  .checked {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--ui-space-4);
    text-align: left;
  }
  .checked img {
    width: 160px;
    height: 160px;
    object-fit: contain;
    background: var(--ui-bg);
    border: 1px solid var(--ui-line);
  }
  .checks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    max-width: 360px;
    font-size: var(--ui-text-md);
    color: var(--ui-ink);
  }
  .checks li {
    display: flex;
    gap: var(--ui-space-2);
    align-items: flex-start;
  }
  .checks :global(svg) {
    flex: none;
    margin-top: 2px;
  }
  .ok :global(svg) {
    color: var(--ui-ok);
  }
  .warn :global(svg) {
    color: var(--ui-warn);
  }
  .block :global(svg) {
    color: var(--ui-danger);
  }
  .stage {
    color: var(--ui-ink-2);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-sm);
  }
</style>
