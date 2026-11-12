<script lang="ts">
  import { apiEnhance } from '$lib/dashboard/api-enhance';
  import { Button } from '$lib/components/ui/button/index.js';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { preloadCode } from '$app/navigation';
  import { tick } from 'svelte';
  import { BriefPhase, briefPhaseAfter, briefProgress } from '$lib/motion/brief-progress';
  import AgentCard from '$lib/components/app/AgentCard.svelte';
  import CanvasRows from '$lib/components/app/CanvasRows.svelte';
  import NewCanvasButton from '$lib/components/app/NewCanvasButton.svelte';
  import { BRIEF_MAX } from '$lib/motion/video-brief';
  import { ComposerKey, composerKey, rotateTemplates } from '$lib/motion/brief-composer';
  import { composerHeight } from '$lib/components/brand-agent/composer-height';
  import { CHAT_ATTACH_ACCEPT } from '$lib/chat-attachments';
  import { ChatUploads } from '$lib/components/brand-agent/chat-uploads.svelte';
  import ChatAttachments from '$lib/components/brand-agent/ChatAttachments.svelte';
  import Plus from '@lucide/svelte/icons/plus';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import FeegaFile from '$lib/components/canvas/FeegaFile.svelte';
  import { isFeegaFile } from '$lib/canvas/feega-file';
  import { DashboardPage, EDITOR_PRELOAD, PAGE_PATH } from '$lib/dashboard/pages';
  import PromptKinds from '$lib/components/app/PromptKinds.svelte';
  import PromptSources from '$lib/components/app/PromptSources.svelte';
  import type { PromptSource, SourcePick } from '$lib/home/prompt-sources';
  import { DEFAULT_KIND, PROMPT_KINDS } from '$lib/home/prompt-kinds';
  import { page } from '$app/state';
  import { HANDOFF_PARAMS, HandoffStart, handoffOf } from '$lib/home/handoff';

  let { data, form } = $props();

  const MODEL = 'Opus 5.5';
  const EXAMPLES_SHOWN = 3;
  const EXAMPLE_TURN_MS = 6000;

  let phase = $state(BriefPhase.Idle);
  const sending = $derived(phase !== BriefPhase.Idle);
  let brief = $state('');
  let kind = $state(DEFAULT_KIND);
  let pick = $state<SourcePick | null>(null);
  let pickAgain = $state<PromptSource | null>(null);
  let turn = $state(0);
  let dragging = $state(false);
  let field = $state<HTMLTextAreaElement | null>(null);
  let composer = $state<HTMLFormElement | null>(null);
  let picker = $state<HTMLInputElement | null>(null);
  let feegaFile = $state<FeegaFile | null>(null);
  const placeholder = $derived(PROMPT_KINDS[kind].placeholder);
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
    void prefillHandoff();
    return () => clearInterval(timer);
  });

  async function prefillHandoff() {
    const handoff = handoffOf(page.url.searchParams);
    if (!handoff) {
      return;
    }
    const send = data.handoffStart === HandoffStart.Send;
    forgetHandoff();

    brief = handoff.text;
    kind = handoff.kind;
    pickAgain = handoff.source;
    if (!send) {
      return;
    }
    await tick();
    composer?.requestSubmit();
  }

  function forgetHandoff() {
    const url = new URL(page.url);
    HANDOFF_PARAMS.forEach((name) => url.searchParams.delete(name));
    history.replaceState(history.state, '', url);
  }

  $effect(() => {
    void brief;
    if (!field) {
      return;
    }
    field.style.height = 'auto';
    field.style.height = composerHeight(field.scrollHeight);
  });

  function preloadEditor() {
    void preloadCode(EDITOR_PRELOAD);
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
    if (!e.dataTransfer?.types.includes('Files')) {
      return;
    }
    e.preventDefault();
    dragging = true;
  }

  function dropped(e: DragEvent) {
    dragging = false;
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!files.length) {
      return;
    }
    e.preventDefault();
    const feega = files.find(isFeegaFile);
    if (feega) {
      void feegaFile?.take(feega);
      return;
    }
    uploads?.add(files);
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
    <Button variant="secondary" data-testid="home-import-feega" onclick={() => feegaFile?.pick()}>import .feega</Button>
    <NewCanvasButton projects={data.projects} action="?/project" />
    <FeegaFile bind:this={feegaFile} page={PAGE_PATH[DashboardPage.Home]} />
  </div>

  <div data-testid="home-scroll">
    <div class="column">
      <section class="prompt" aria-labelledby="prompt-heading">
        <h1 id="prompt-heading">what do you want to make?</h1>
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
          <PromptKinds bind:kind />
          <div class="field">
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
              {placeholder}
              aria-label={placeholder}
              maxlength={BRIEF_MAX}
              rows="3"
              enterkeyhint="send"
              bind:value={brief}
              bind:this={field}
              onkeydown={keyed}
              onpaste={pasted}
              onfocus={preloadEditor}
              readonly={sending}
            ></textarea>
            <input type="hidden" name="kind" value={kind} />
            {#if pick}<input type="hidden" name="source" value={pick.source} /><input type="hidden" name="sourceValue" value={pick.value} />{/if}
            {#if data.attachProjectId}<input type="hidden" name="projectId" value={data.attachProjectId} />{/if}
            {#each ready as attachment (attachment.assetId)}<input type="hidden" name="attachment" value={attachment.assetId} />{/each}
            <PromptSources bind:pick projectId={data.attachProjectId} {pickAgain}>
              {#snippet before()}
                {#if uploads}
                  <button type="button" class="tool" aria-label={$_('chat.panel.attach.button')} title={$_('chat.panel.attach.button')} data-testid="chat-attach" onclick={() => picker?.click()}>
                    <Plus size={16} />
                  </button>
                {/if}
              {/snippet}
              {#snippet after()}
                {#if sending}<span class="progress" role="status" data-testid="brief-progress">{briefProgress(phase)}</span>{/if}
                <span class="model" data-testid="composer-model">{MODEL}</span>
                <button type="submit" class="send" class:busy={sending} data-testid="brief-send" disabled={!canSend} aria-label="Start" title="Start">
                  <ArrowUp size={16} />
                </button>
              {/snippet}
            </PromptSources>
          </div>
        </form>
        {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

        <div class="examples" data-testid="brief-examples" aria-label="Suggestions">
          {#each examples as template (template.id)}
            <button type="button" data-brief={template.brief} onclick={() => fill(template.brief)}>{template.name}</button>
          {/each}
        </div>
      </section>

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
      <AgentCard />
    </div>
  </div>
</div>

<style>
  .home {
    display: flex;
    flex-direction: column;
    color: var(--ui-text);
  }

  .create {
    display: flex;
    margin-bottom: var(--ui-space-4);
    justify-content: flex-end;
    gap: var(--ui-space-2);
  }

  @media (max-width: 640px) {
    .create {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      justify-content: stretch;
    }

    .create :global(button),
    .create form {
      width: 100%;
    }
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-8);
    width: 100%;
    max-width: 720px;
    margin: var(--ui-space-8) auto 0;
    padding-bottom: var(--ui-space-8);
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

  .prompt {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    padding: var(--ui-space-8) 0 var(--ui-space-4);
  }

  h1 {
    margin: 0 0 var(--ui-space-2);
    text-align: center;
    font-size: clamp(32px, 3.2vw, 48px);
    font-weight: 600;
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: var(--ui-text);
  }

  .examples {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--ui-space-1);
  }

  .examples button {
    flex: none;
    height: var(--ui-row);
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: var(--ui-radius-full);
    background: transparent;
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
  .tool:focus-visible,
  .send:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-2);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3);
    border: 1px solid transparent;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-sunken);
    transition: border-color var(--ui-dur-fast) var(--ui-ease), background var(--ui-dur-fast) var(--ui-ease);
  }

  .field:focus-within {
    border-color: color-mix(in srgb, var(--ui-accent) 45%, transparent);
  }

  .composer.dragging .field {
    border-color: var(--ui-accent);
    background: var(--ui-selected);
  }

  .drop-hint {
    margin: 0;
    font-size: var(--ui-type-label);
    color: var(--ui-text-secondary);
  }

  textarea {
    width: 100%;
    min-height: 72px;
    max-height: 240px;
    padding: 0;
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

  .tool {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--ui-row);
    height: var(--ui-row);
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    cursor: pointer;
  }

  .tool:hover {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .model {
    flex: none;
    margin: 0 var(--ui-space-1) 0 auto;
    font-size: var(--ui-type-label);
    color: var(--ui-text-tertiary);
  }

  .send {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--ui-row-lg);
    height: var(--ui-row-lg);
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
    flex: none;
    margin-left: auto;
    font-size: var(--ui-type-label);
    color: var(--ui-text-secondary);
  }

  .progress + .model {
    margin-left: var(--ui-space-2);
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

    .prompt {
      padding-top: var(--ui-space-4);
    }

    h1 {
      font-size: clamp(28px, 8vw, 36px);
    }

    textarea {
      font-size: 16px;
    }
  }
</style>
