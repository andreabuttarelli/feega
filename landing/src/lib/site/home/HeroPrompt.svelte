<script lang="ts">
  import { handoffLink, PROMPT_KINDS, PROMPT_SOURCES, PromptKind, type PromptSource } from '../prompt/handoff';

  const PLACEHOLDER = 'Describe what you want to make, or paste your website…';

  let text = $state('');
  let kind = $state(PromptKind.Motion);
  let source = $state<PromptSource | null>(null);
  let images = $state<File[]>([]);
  let picker = $state<HTMLInputElement | null>(null);
  const canSend = $derived(!!text.trim() || images.length > 0 || source !== null);

  function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    images = [...images, ...(input.files ?? [])];
    input.value = '';
  }

  function send(e?: SubmitEvent) {
    e?.preventDefault();
    if (!canSend) {
      return;
    }
    window.location.href = handoffLink({ text, kind, source, images: images.length });
  }

  function keyed(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) {
      return;
    }
    e.preventDefault();
    send();
  }
</script>

<form class="composer" onsubmit={send} data-testid="hero-prompt">
  <div class="kinds" role="group" aria-label="What to make">
    {#each PROMPT_KINDS as row (row.kind)}
      <button type="button" class="kind" aria-pressed={kind === row.kind} onclick={() => (kind = row.kind)}>{row.label}</button>
    {/each}
  </div>

  <textarea aria-label={PLACEHOLDER} placeholder={PLACEHOLDER} rows="3" bind:value={text} onkeydown={keyed}></textarea>

  {#if images.length}
    <ul class="files">
      {#each images as file, i (i)}
        <li>
          <span>{file.name}</span>
          <button type="button" aria-label={`Remove ${file.name}`} onclick={() => (images = images.filter((_, at) => at !== i))}>×</button>
        </li>
      {/each}
    </ul>
    <p class="note">You add images again in the app, after signing in.</p>
  {/if}

  <input bind:this={picker} class="sr" type="file" multiple accept="image/*" tabindex="-1" aria-hidden="true" onchange={picked} />

  <div class="bar">
    <button type="button" class="tool" aria-label="Attach images" title="Attach images" onclick={() => picker?.click()}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
    </button>

    <div class="sources" role="group" aria-label="Start from">
      {#each PROMPT_SOURCES as row (row.source)}
        <button type="button" class="source" aria-pressed={source === row.source} onclick={() => (source = source === row.source ? null : row.source)}>{row.label}</button>
      {/each}
    </div>

    <button type="submit" class="send" disabled={!canSend} aria-label="Start" title="Start">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
  </div>
</form>

<style>
  .composer {
    --line: rgba(255, 255, 255, 0.12);
    --wash: rgba(255, 255, 255, 0.06);
    --muted: rgba(255, 255, 255, 0.6);
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #0d0d0d;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
    color: #fff;
    text-align: left;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .composer:focus-within {
    border-color: color-mix(in srgb, #ff5100 55%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, #ff5100 18%, transparent), 0 24px 60px rgba(0, 0, 0, 0.5);
  }

  .kinds,
  .sources {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  .kind,
  .source {
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .kind:hover,
  .source:hover {
    color: #fff;
    background: var(--wash);
  }

  .kind[aria-pressed='true'] {
    border-color: #fff;
    background: #fff;
    color: #000;
  }

  .source[aria-pressed='true'] {
    border-color: color-mix(in srgb, #ff5100 60%, transparent);
    background: color-mix(in srgb, #ff5100 16%, transparent);
    color: #fff;
  }

  textarea {
    width: 100%;
    min-height: 96px;
    padding: 4px 4px 0;
    border: 0;
    resize: none;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 17px;
    line-height: 1.45;
    outline: none;
  }

  textarea::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .files {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 13px;
  }

  .files li {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 220px;
    height: 28px;
    padding: 0 4px 0 10px;
    border-radius: 4px;
    background: var(--wash);
  }

  .files span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .files button {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--muted);
  }

  .note {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sources {
    flex: 1 1 auto;
    min-width: 0;
  }

  .tool,
  .send {
    display: grid;
    flex: none;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 999px;
  }

  .tool {
    align-self: flex-start;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
  }

  .tool:hover {
    color: #fff;
    background: var(--wash);
  }

  .send {
    align-self: flex-end;
    border: 0;
    background: #ff5100;
    color: #fff;
    transition: filter 0.15s, opacity 0.15s;
  }

  .send:hover:not(:disabled) {
    filter: brightness(1.12);
  }

  .send:disabled {
    opacity: 0.35;
    cursor: default;
  }

  button:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
