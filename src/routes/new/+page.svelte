<script lang="ts">
  import { goto } from '$app/navigation';
  import PromptKinds from '$lib/components/app/PromptKinds.svelte';
  import { DEFAULT_KIND } from '$lib/home/prompt-kinds';
  import { saveDraft } from '$lib/home/home-draft';
  import { BRIEF_MAX } from '$lib/motion/video-brief';
  import { CHAT_ATTACH_ACCEPT } from '$lib/chat-attachments';
  import { ComposerKey, composerKey } from '$lib/motion/brief-composer';

  const PLACEHOLDER = 'Describe what you want to make, or paste your website…';
  const SIGN_IN = '/login';

  let brief = $state('');
  let kind = $state(DEFAULT_KIND);
  let files = $state<File[]>([]);
  let saving = $state(false);
  let picker = $state<HTMLInputElement | null>(null);
  const canSend = $derived(!saving && (!!brief.trim() || files.length > 0));

  function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    files = [...files, ...(input.files ?? [])];
    input.value = '';
  }

  function keyed(e: KeyboardEvent) {
    if (composerKey(e) !== ComposerKey.Submit) {
      return;
    }
    e.preventDefault();
    void send();
  }

  async function send(e?: SubmitEvent) {
    e?.preventDefault();
    if (!canSend) {
      return;
    }
    saving = true;
    await saveDraft(sessionStorage, { text: brief, kind, files });
    await goto(SIGN_IN);
  }
</script>

<svelte:head><title>Make something · feega</title></svelte:head>

<main class="new">
  <section class="prompt" aria-labelledby="new-heading">
    <h1 id="new-heading">what do you want to make?</h1>
    <PromptKinds bind:kind />

    <form class="composer" onsubmit={send} data-testid="new-prompt">
      {#if files.length}
        <ul class="files" data-testid="new-files">
          {#each files as file, i (i)}
            <li>
              <span>{file.name}</span>
              <button type="button" aria-label={`Remove ${file.name}`} onclick={() => (files = files.filter((_, at) => at !== i))}>×</button>
            </li>
          {/each}
        </ul>
      {/if}
      <textarea name="brief" data-testid="video-brief" placeholder={PLACEHOLDER} aria-label={PLACEHOLDER} maxlength={BRIEF_MAX} rows="3" bind:value={brief} onkeydown={keyed}></textarea>
      <input bind:this={picker} class="sr-only" type="file" multiple accept={CHAT_ATTACH_ACCEPT} tabindex="-1" aria-hidden="true" onchange={picked} />
      <div class="row">
        <button type="button" class="attach" onclick={() => picker?.click()}>attach</button>
        <button type="submit" class="send" data-testid="brief-send" disabled={!canSend} aria-label="Start" title="Start">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" /></svg>
        </button>
      </div>
    </form>
    <p class="note">You sign in next; your prompt waits and starts as soon as you are in.</p>
  </section>
</main>

<style>
  .new {
    display: grid;
    place-items: center;
    min-height: 100svh;
    padding: 0 16px;
    background: var(--ui-canvas, var(--ui-panel));
    color: var(--ui-text);
  }

  .prompt {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    width: 100%;
    max-width: 720px;
  }

  h1 {
    margin: 0 0 var(--ui-space-2);
    text-align: center;
    font-size: clamp(40px, 4.5vw, 72px);
    font-weight: 600;
    line-height: 0.95;
    letter-spacing: -0.04em;
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-2) var(--ui-space-4);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  textarea {
    width: 100%;
    min-height: 72px;
    border: 0;
    resize: none;
    background: transparent;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-lg);
    line-height: var(--ui-leading);
  }

  textarea:focus {
    outline: none;
  }

  textarea::placeholder {
    color: var(--ui-text-tertiary);
  }

  .files {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-1);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--ui-type-label);
  }

  .files li {
    display: flex;
    align-items: center;
    gap: var(--ui-space-1);
    padding: 0 var(--ui-space-2);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .files button,
  .attach {
    border: 0;
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: var(--ui-type-label);
    cursor: pointer;
  }

  .row {
    display: flex;
    align-items: center;
  }

  .send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--ui-row-lg);
    height: var(--ui-row-lg);
    margin-left: auto;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
    cursor: pointer;
  }

  .send:disabled {
    background: var(--ui-input);
    color: var(--ui-text-disabled);
    cursor: default;
  }

  .note {
    margin: 0;
    text-align: center;
    font-size: var(--ui-type-label);
    color: var(--ui-text-tertiary);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    h1 {
      font-size: clamp(36px, 10vw, 64px);
    }

    textarea {
      font-size: 16px;
    }
  }
</style>
