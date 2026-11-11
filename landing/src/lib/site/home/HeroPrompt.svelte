<script lang="ts">
  import { handoffLink, PROMPT_KINDS, PROMPT_SOURCES, PromptKind, PromptSource } from '../prompt/handoff';
  import Icon, { type IconName } from '../prompt/Icon.svelte';
  import SourceMenu from '../prompt/SourceMenu.svelte';

  const MODEL = 'Opus 5.5';
  const KIND_ICONS: Record<PromptKind, IconName> = { [PromptKind.Motion]: 'motion', [PromptKind.Website]: 'website' };
  const SOURCE_ICONS: Record<PromptSource, IconName> = {
    [PromptSource.GitHub]: 'github',
    [PromptSource.Folder]: 'folder',
    [PromptSource.Figma]: 'figma'
  };

  let text = $state('');
  let kind = $state(PromptKind.Motion);
  let source = $state<PromptSource | null>(null);
  let images = $state<File[]>([]);
  let picker = $state<HTMLInputElement | null>(null);
  const placeholder = $derived(PROMPT_KINDS.find((row) => row.kind === kind)?.placeholder ?? '');
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
      <button type="button" class="kind" aria-pressed={kind === row.kind} onclick={() => (kind = row.kind)}>
        <Icon name={KIND_ICONS[row.kind]} />
        <span>{row.label}</span>
      </button>
    {/each}
  </div>

  <div class="field">
    <textarea aria-label={placeholder} {placeholder} rows="3" bind:value={text} onkeydown={keyed}></textarea>

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
        <Icon name="plus" />
      </button>

      <div class="sources" role="group" aria-label="Start from">
        {#each PROMPT_SOURCES as row (row.source)}
          <button type="button" class="tool source" aria-pressed={source === row.source} aria-label={row.label} title={row.label} onclick={() => (source = source === row.source ? null : row.source)}>
            <Icon name={SOURCE_ICONS[row.source]} size={14} />
            <span class="label">{row.label}</span>
          </button>
        {/each}
      </div>

      <div class="compact">
        <SourceMenu bind:source icons={SOURCE_ICONS} />
      </div>

      <span class="model">{MODEL}</span>

      <button type="submit" class="send" disabled={!canSend} aria-label="Start" title="Start">
        <Icon name="send" />
      </button>
    </div>
  </div>
</form>

<style>
  .composer {
    --line: rgba(255, 255, 255, 0.1);
    --wash: rgba(255, 255, 255, 0.07);
    --muted: rgba(255, 255, 255, 0.55);
    --brand: #ff5100;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 20px;
    background: #121212;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3);
    color: #fff;
    text-align: left;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  .kinds {
    display: flex;
    gap: 2px;
    padding: 2px 2px 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .kinds::-webkit-scrollbar {
    display: none;
  }

  .kind {
    display: flex;
    flex: none;
    align-items: center;
    gap: 7px;
    height: 34px;
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .kind:hover {
    color: #fff;
  }

  .kind[aria-pressed='true'] {
    background: var(--wash);
    color: #fff;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid transparent;
    border-radius: 14px;
    background: #1b1b1b;
    transition: border-color 0.2s;
  }

  .field:focus-within {
    border-color: color-mix(in srgb, var(--brand) 45%, transparent);
  }

  textarea {
    width: 100%;
    min-height: 84px;
    padding: 2px;
    border: 0;
    resize: none;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 16px;
    line-height: 1.45;
    outline: none;
  }

  textarea::placeholder {
    color: rgba(255, 255, 255, 0.38);
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
    gap: 4px;
  }

  .sources {
    display: flex;
    flex: 1 1 auto;
    gap: 2px;
    min-width: 0;
  }

  .tool {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: 30px;
    height: 30px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }

  .tool:hover {
    color: #fff;
    background: var(--wash);
  }

  .source[aria-pressed='true'] {
    background: color-mix(in srgb, var(--brand) 16%, transparent);
    color: #fff;
  }

  .compact {
    display: none;
    flex: 1 1 auto;
    min-width: 0;
  }

  .model {
    flex: none;
    margin-right: 6px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
  }

  .send {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.6);
    transition: background 0.15s, color 0.15s;
  }

  .send:not(:disabled) {
    background: var(--brand);
    color: #fff;
  }

  .send:disabled {
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

  @media (max-width: 809.98px) {
    .composer {
      border-radius: 16px;
    }

    .sources {
      display: none;
    }

    .compact {
      display: block;
    }

    .tool {
      padding: 0;
    }
  }
</style>
