<script lang="ts">
  import { apiEnhance } from '$lib/dashboard/api-enhance';
  import HomeHero from '$lib/components/app/HomeHero.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
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
      <Button variant="secondary" data-testid="home-import" onclick={() => picker?.click()}>import</Button>
      <input bind:this={picker} class="sr-only" type="file" multiple accept={CHAT_ATTACH_ACCEPT} tabindex="-1" aria-hidden="true" onchange={picked} />
    {/if}
    <form method="POST" action="?/project" use:apiEnhance>
      <Button type="submit" data-testid="new-canvas">new canvas</Button>
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
      use:apiEnhance={submit}
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
    display: flex;
    flex-direction: column;
    height: calc(100svh - var(--ui-bar-h) - var(--content-pad-top) - var(--content-pad-bottom));
    color: var(--ui-text);
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

  .column {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-8);
    width: 100%;
    max-width: 720px;
    margin: var(--ui-space-8) auto 0;
    animation: rise var(--ui-dur-slow) var(--ui-ease) both;
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
    gap: var(--ui-space-2);
  }

  h2 {
    margin: 0;
    font-family: var(--sans);
    font-size: var(--ui-type-section);
    font-weight: var(--ui-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--ui-tracking-caps);
    color: var(--ui-text-tertiary);
  }

  @keyframes breathe {
    50% {
      opacity: 0.5;
    }
  }

  .empty {
    margin: 0;
    max-width: 44ch;
    font-size: var(--ui-type-body);
    line-height: var(--ui-leading);
    color: var(--ui-text-tertiary);
  }

  .empty a {
    color: var(--ui-text);
    text-decoration: underline;
    text-decoration-color: var(--ui-divider-strong);
    text-underline-offset: 3px;
  }

  .dock {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding-top: var(--ui-space-4);
  }

  .examples {
    display: flex;
    gap: var(--ui-space-1);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .examples button {
    flex: none;
    height: var(--ui-row);
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: var(--ui-type-label);
    cursor: pointer;
    transition: background var(--ui-dur-fast) var(--ui-ease), color var(--ui-dur-fast) var(--ui-ease);
  }

  .examples button:hover {
    background: var(--ui-input-hover);
    color: var(--ui-text);
  }

  .examples button:focus-visible,
  .send:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
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

  .composer.dragging {
    box-shadow: var(--ui-shadow-float), inset 0 0 0 2px var(--ui-accent);
    background: var(--ui-selected);
  }

  .drop-hint {
    margin: 0;
    font-size: var(--ui-type-label);
    color: var(--ui-text-secondary);
  }

  textarea {
    width: 100%;
    min-height: 48px;
    max-height: 200px;
    padding: var(--ui-space-1) 0 0;
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

  .row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
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
    transition: background var(--ui-dur-fast) var(--ui-ease);
  }

  .send:disabled {
    background: var(--ui-input);
    color: var(--ui-text-disabled);
    cursor: default;
  }

  .progress {
    margin-left: auto;
    font-size: var(--ui-type-label);
    color: var(--ui-text-secondary);
  }

  .progress + .send {
    margin-left: 0;
  }

  .send.busy:disabled {
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
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
    font-size: var(--ui-type-label);
    color: var(--ui-danger);
  }

  @media (prefers-reduced-motion: reduce) {
    .column,
    .send.busy:disabled {
      animation: none;
    }
  }

  @media (pointer: coarse) {
    .examples button {
      height: 44px;
    }

    .send {
      width: 44px;
      height: 44px;
    }
  }

  @media (max-width: 640px) {
    .column {
      gap: var(--ui-space-6);
      margin-top: var(--ui-space-6);
    }

    .dock {
      padding-top: var(--ui-space-3);
    }

    textarea {
      font-size: 16px;
    }
  }
</style>
