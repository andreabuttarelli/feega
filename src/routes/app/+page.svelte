<script lang="ts">
  import HomeHero from '$lib/components/app/HomeHero.svelte';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { enhance } from '$app/forms';
  import { preloadCode } from '$app/navigation';
  import { BriefPhase, briefPhaseAfter, briefProgress } from '$lib/motion/brief-progress';
  import CanvasRows from '$lib/components/app/CanvasRows.svelte';
  import { BRIEF_MAX } from '$lib/motion/video-brief';
  import { ComposerKey, composerKey, rotateTemplates } from '$lib/motion/brief-composer';
  import { composerHeight } from '$lib/components/brand-agent/composer-height';
  import { CHAT_ATTACH_ACCEPT } from '$lib/chat-attachments';
  import { ChatUploads } from '$lib/components/brand-agent/chat-uploads.svelte';
  import ChatAttachments from '$lib/components/brand-agent/ChatAttachments.svelte';
  import IconButton from '$lib/components/motion/IconButton.svelte';
  import { Tool } from '$lib/motion/actions';

  let { data, form } = $props();

  const PLACEHOLDER = 'Describe what you want to make, or paste your website…';
  const EXAMPLES_SHOWN = 3;
  const EXAMPLE_TURN_MS = 6000;
  const EDITOR_ROUTE = '/p/_/c/_/motion/_';

  let phase = $state(BriefPhase.Idle);
  const sending = $derived(phase !== BriefPhase.Idle);
  let brief = $state('');
  let turn = $state(0);
  let dragging = $state(false);
  let field = $state<HTMLTextAreaElement | null>(null);
  let composer = $state<HTMLFormElement | null>(null);
  let picker = $state<HTMLInputElement | null>(null);
  const recents = $derived(data.dashboard.canvases);

  const uploads = $derived(data.attachProjectId ? new ChatUploads(data.attachProjectId) : null);
  const ready = $derived(uploads?.ready ?? []);
  const canSend = $derived(!sending && !uploads?.busy && (!!brief.trim() || ready.length > 0));
  const examples = $derived(rotateTemplates(data.templates, turn, EXAMPLES_SHOWN));

  onMount(() => {
    if (matchMedia('(pointer: fine)').matches) {
      field?.focus();
    }
    const timer = setInterval(() => (turn += 1), EXAMPLE_TURN_MS);
    return () => clearInterval(timer);
  });

  $effect(() => {
    void brief;
    if (!field) {
      return;
    }
    field.style.height = 'auto';
    field.style.height = composerHeight(field.scrollHeight);
  });

  function preloadEditor() {
    void preloadCode(EDITOR_ROUTE);
  }

  function fill(text: string) {
    brief = text;
    field?.focus();
  }

  function keyed(e: KeyboardEvent) {
    if (composerKey(e) !== ComposerKey.Submit) {
      return;
    }
    e.preventDefault();
    if (canSend) {
      composer?.requestSubmit();
    }
  }

  function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    uploads?.add([...(input.files ?? [])]);
    input.value = '';
    field?.focus();
  }

  function pasted(e: ClipboardEvent) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (!uploads || !files.length) {
      return;
    }
    e.preventDefault();
    uploads.add(files);
  }

  function dragged(e: DragEvent) {
    if (!uploads || !e.dataTransfer?.types.includes('Files')) {
      return;
    }
    e.preventDefault();
    dragging = true;
  }

  function dropped(e: DragEvent) {
    dragging = false;
    if (!uploads || !e.dataTransfer?.files.length) {
      return;
    }
    e.preventDefault();
    uploads.add([...e.dataTransfer.files]);
  }

  const submit = ({ cancel }: { cancel: () => void }) => {
    if (!canSend) {
      cancel();
      return;
    }
    phase = BriefPhase.Creating;
    return async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
      phase = briefPhaseAfter(result.type);
      await update();
      phase = BriefPhase.Idle;
    };
  };
</script>

<svelte:head><title>Home · feega</title></svelte:head>

<div class="home">
  <div class="create" data-testid="home-create">
    {#if uploads}
      <button type="button" class="pill" data-testid="home-import" onclick={() => picker?.click()}>import</button>
      <input bind:this={picker} class="sr-only" type="file" multiple accept={CHAT_ATTACH_ACCEPT} tabindex="-1" aria-hidden="true" onchange={picked} />
    {/if}
    <form method="POST" action="?/project">
      <button type="submit" class="pill primary" data-testid="new-canvas">new canvas</button>
    </form>
  </div>

  <div class="scroll" data-testid="home-scroll">
    <HomeHero />

    <div class="column">
      {#if recents.length}
        <section class="recents" aria-labelledby="recents-heading">
          <h2 id="recents-heading">recents</h2>
          <CanvasRows canvases={recents} testid="home-recents" />
        </section>
      {:else}
        <p class="empty" data-testid="home-empty">
          nothing here yet. <a href="#video-brief">describe what you want</a> and feega opens a canvas for it, or start a blank one with new canvas.
        </p>
      {/if}
    </div>
  </div>

  <div class="dock">
    <div class="examples" data-testid="brief-examples" aria-label="Suggestions">
      {#each examples as template (template.id)}
        <button type="button" data-brief={template.brief} onclick={() => fill(template.brief)}>{template.name}</button>
      {/each}
    </div>

    <form
      method="POST"
      action="?/video"
      class="composer"
      class:dragging
      aria-busy={sending}
      bind:this={composer}
      use:enhance={submit}
      ondragover={dragged}
      ondragleave={() => (dragging = false)}
      ondrop={dropped}
    >
      {#if uploads?.items.length}
        <ChatAttachments items={uploads.items} onremove={(id) => uploads?.remove(id)} />
      {/if}
      {#if dragging}
        <p class="drop-hint" aria-hidden="true">{$_('chat.panel.attach.drop')}</p>
      {/if}
      <textarea
        name="brief"
        id="video-brief"
        data-testid="video-brief"
        placeholder={PLACEHOLDER}
        aria-label={PLACEHOLDER}
        maxlength={BRIEF_MAX}
        rows="2"
        enterkeyhint="send"
        bind:value={brief}
        bind:this={field}
        onkeydown={keyed}
        onpaste={pasted}
        onfocus={preloadEditor}
        readonly={sending}
      ></textarea>
      {#if data.attachProjectId}<input type="hidden" name="projectId" value={data.attachProjectId} />{/if}
      {#each ready as attachment (attachment.assetId)}<input type="hidden" name="attachment" value={attachment.assetId} />{/each}
      <div class="row">
        {#if uploads}
          <IconButton action={Tool.Attach} label={$_('chat.panel.attach.button')} data-testid="chat-attach" onclick={() => picker?.click()} />
        {/if}
        {#if sending}<span class="progress" role="status" data-testid="brief-progress">{briefProgress(phase)}</span>{/if}
        <button type="submit" class="send" class:busy={sending} data-testid="brief-send" disabled={!canSend} aria-label="Start" title="Start">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" /></svg>
        </button>
      </div>
    </form>
    {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
  </div>
</div>

<style>
  .home {
    --ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    height: calc(100svh - var(--ui-bar-h) - var(--content-pad-top) - var(--content-pad-bottom));
    color: var(--ui-ink);
  }

  .scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .create {
    display: flex;
    margin-bottom: var(--ui-space-4);
    justify-content: flex-end;
    gap: var(--ui-space-2);
  }

  .pill {
    height: 36px;
    padding: 0 var(--ui-space-4);
    border: 0;
    border-radius: 9999px;
    background: var(--ui-field);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
    transition: background 0.2s var(--ease-expo);
  }

  .pill:hover {
    background: var(--ui-hover);
  }

  .pill.primary {
    background: var(--ui-accent);
    color: #fff;
  }

  .pill.primary:hover {
    opacity: 0.9;
  }

  .pill:focus-visible,
  .send:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: 48px;
    width: 100%;
    max-width: 720px;
    margin: 48px auto 0;
    animation: rise 0.6s var(--ease-expo) both;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  .recents {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
  }

  h2 {
    margin: 0;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    font-weight: 400;
    letter-spacing: 0.04em;
    color: var(--ui-text-3);
  }

  @keyframes breathe {
    50% {
      opacity: 0.5;
    }
  }




  .empty {
    margin: 0;
    max-width: 44ch;
    font-size: var(--ui-text-md);
    line-height: 1.5;
    color: var(--ui-text-3);
  }

  .empty a {
    color: var(--ui-ink);
    text-decoration: underline;
    text-decoration-color: var(--ui-text-3);
    text-underline-offset: 3px;
  }

  .dock {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding-top: var(--ui-space-4);
  }

  .examples {
    display: flex;
    gap: var(--ui-space-2);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .examples button {
    flex: none;
    height: 32px;
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: 9999px;
    background: var(--ui-field);
    color: var(--ui-ink-2);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
    transition: background 0.2s var(--ease-expo);
  }

  .examples button:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-4) var(--ui-space-4) var(--ui-space-3);
    background: var(--ui-bg);
    border: 1px solid var(--ui-line-strong);
    transition: border-color 0.2s var(--ease-expo);
  }

  .composer:focus-within,
  .composer.dragging {
    border-color: var(--ui-accent);
  }

  .composer.dragging {
    border-style: dashed;
  }

  .drop-hint {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  textarea {
    width: 100%;
    min-height: 48px;
    max-height: 200px;
    padding: 0;
    border: 0;
    resize: none;
    background: transparent;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-lg);
    line-height: 1.5;
  }

  textarea:focus {
    outline: none;
  }

  textarea::placeholder {
    color: var(--ui-ink-3);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }

  .send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-left: auto;
    border: 0;
    border-radius: 9999px;
    background: var(--ui-accent);
    color: #fff;
    cursor: pointer;
  }

  .send:disabled {
    background: var(--ui-field);
    color: var(--ui-ink-3);
    cursor: default;
  }

  .progress {
    margin-left: auto;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
  }

  .progress + .send {
    margin-left: 0;
  }

  .send.busy:disabled {
    background: var(--ui-accent);
    color: #fff;
    animation: breathe 1s ease-in-out infinite;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .error {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-danger);
  }

  @media (prefers-reduced-motion: reduce) {
    .column,
    .send.busy:disabled {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .column {
      gap: 32px;
      margin-top: 32px;
    }

    .dock {
      padding-top: var(--ui-space-3);
    }

    textarea {
      font-size: 16px;
    }
  }
</style>
