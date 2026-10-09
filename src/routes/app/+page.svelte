<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import Film from '@lucide/svelte/icons/film';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { enhance } from '$app/forms';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';
  import { TOOL_STATUS_LABEL, toolHref } from '$lib/tools';
  import { TOOL_ICONS } from '$lib/components/app/tool-icons';
  import { GALLERY_PATH, byline, itemPath } from '$lib/gallery/model';
  import { BRIEF_MAX } from '$lib/motion/video-brief';
  import { ComposerKey, composerKey, rotateTemplates } from '$lib/motion/brief-composer';
  import { composerHeight } from '$lib/components/brand-agent/composer-height';
  import { CHAT_ATTACH_ACCEPT } from '$lib/chat-attachments';
  import { ChatUploads } from '$lib/components/brand-agent/chat-uploads.svelte';
  import ChatAttachments from '$lib/components/brand-agent/ChatAttachments.svelte';
  import IconButton from '$lib/components/motion/IconButton.svelte';
  import { Tool } from '$lib/motion/actions';

  let { data, form } = $props();

  const PLACEHOLDER = 'Paste your website or describe the video you want…';
  const EXAMPLES_SHOWN = 3;
  const EXAMPLE_TURN_MS = 6000;

  let sending = $state(false);
  let brief = $state('');
  let turn = $state(0);
  let dragging = $state(false);
  let field = $state<HTMLTextAreaElement | null>(null);
  let composer = $state<HTMLFormElement | null>(null);
  let picker = $state<HTMLInputElement | null>(null);

  const uploads = $derived(data.attachProjectId ? new ChatUploads(data.attachProjectId) : null);
  const ready = $derived(uploads?.ready ?? []);
  const canSend = $derived(!sending && !uploads?.busy && (!!brief.trim() || ready.length > 0));
  const examples = $derived(rotateTemplates(data.templates, turn, EXAMPLES_SHOWN));
  const recentProjectId = $derived(data.dashboard.projects[0]?.id ?? null);

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
    sending = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      sending = false;
    };
  };
</script>

<svelte:head><title>Make a video · feega</title></svelte:head>

<div class="home">
  <section class="hero" aria-labelledby="create-heading" data-testid="home-hero">
    <div class="center">
      <PageTitle id="create-heading" text="make a video." />

      <form
        method="POST"
        action="?/video"
        class="composer"
        class:dragging
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
        ></textarea>
        {#if data.attachProjectId}<input type="hidden" name="projectId" value={data.attachProjectId} />{/if}
        {#each ready as attachment (attachment.assetId)}<input type="hidden" name="attachment" value={attachment.assetId} />{/each}
        <div class="row">
          {#if uploads}
            <span class="attach">
              <IconButton action={Tool.Attach} label={$_('chat.panel.attach.button')} data-testid="chat-attach" onclick={() => picker?.click()} />
              <input bind:this={picker} class="sr-only" type="file" multiple accept={CHAT_ATTACH_ACCEPT} tabindex="-1" aria-hidden="true" onchange={picked} />
            </span>
          {/if}
          <button type="submit" class="send" data-testid="brief-send" disabled={!canSend} aria-label="Make the video" title="Make the video">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" /></svg>
          </button>
        </div>
      </form>
      {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

      <div class="examples" data-testid="brief-examples" aria-label="Example prompts">
        {#each examples as template (template.id)}
          <button type="button" data-brief={template.brief} onclick={() => fill(template.brief)}>{template.name}</button>
        {/each}
      </div>

      <p class="helper" data-testid="brief-helper">feega reads your site and makes a launch video · or describe any motion</p>
    </div>
  </section>

  {#if data.dashboard.motions.length}
    <section aria-labelledby="videos-heading">
      <div class="head">
        <h2 id="videos-heading">Your videos</h2>
      </div>
      <ul class="grid" data-testid="home-videos">
        {#each data.dashboard.motions as motion (motion.id)}
          <li>
            <a href={motion.href} class="card">
              <span class="poster">
                {#if motion.poster}<img src={motion.poster} alt="" loading="lazy" />{:else}<Film size={18} strokeWidth={1.4} />{/if}
              </span>
              <span class="name">{motion.name}</span>
              <span class="muted">{formatLastEdited(motion.updatedAt)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if data.gallery.length}
    <section aria-labelledby="gallery-heading">
      <div class="head">
        <h2 id="gallery-heading">Remix from the gallery</h2>
        <a class="more" href={GALLERY_PATH} data-sveltekit-reload>All</a>
      </div>
      <ul class="grid gallery" data-testid="home-gallery">
        {#each data.gallery as card (card.id)}
          <li>
            <a href={itemPath(card.id)} class="card" data-sveltekit-reload>
              <span class="poster">
                {#if card.posterUrl}<img src={card.posterUrl} alt="" loading="lazy" />{:else}<Film size={18} strokeWidth={1.4} />{/if}
              </span>
              <span class="name">{card.title}</span>
              <span class="muted">{byline(card)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if data.dashboard.projects.length}
    <section aria-labelledby="projects-heading">
      <div class="head">
        <h2 id="projects-heading">Projects</h2>
      </div>
      <ul class="projects" data-testid="home-projects">
        {#each data.dashboard.projects as project (project.id)}
          <li><a href={project.href} class="tool">{project.name}</a></li>
        {/each}
      </ul>
    </section>
  {/if}

  <section aria-labelledby="tools-heading">
    <div class="head">
      <h2 id="tools-heading">More tools</h2>
    </div>
    <ul class="tools" data-testid="dashboard-tools">
      {#each data.tools as tool (tool.id)}
        {@const Icon = TOOL_ICONS[tool.icon]}
        {@const href = toolHref(tool, recentProjectId)}
        {@const badge = TOOL_STATUS_LABEL[tool.status]}
        <li>
          <svelte:element this={href ? 'a' : 'div'} class="tool" {href}>
            <Icon size={16} strokeWidth={1.5} />
            <span class="name">{tool.name}</span>
            {#if badge}<span class="badge">{badge}</span>{/if}
          </svelte:element>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  .home {
    max-width: 960px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 64px;
    color: var(--ui-ink);
  }

  .hero {
    --hero-chrome: calc(var(--ui-bar-h) + var(--content-pad-top));
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100svh - var(--hero-chrome));
    padding-bottom: var(--hero-chrome);
    text-align: center;
  }

  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ui-space-4);
    width: 100%;
    max-width: 720px;
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    width: 100%;
    margin-top: var(--ui-space-6);
    padding: var(--ui-space-4) var(--ui-space-4) var(--ui-space-3);
    background: var(--ui-bg);
    border: 1px solid var(--ui-line-strong);
    text-align: left;
    transition: border-color 0.14s ease;
  }

  .composer:focus-within {
    border-color: var(--ui-accent);
  }

  .composer.dragging {
    border-color: var(--ui-accent);
    border-style: dashed;
  }

  .drop-hint {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  textarea {
    width: 100%;
    min-height: 56px;
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

  .attach {
    flex: 0 0 auto;
  }

  .send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-left: auto;
    border: 0;
    border-radius: 9999px;
    background: var(--ui-accent);
    color: #fff;
    cursor: pointer;
    transition: opacity 0.14s ease;
  }

  .send:disabled {
    background: var(--ui-field);
    color: var(--ui-ink-3);
    cursor: default;
  }

  .send:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
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

  .examples {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--ui-space-2);
  }

  .examples button {
    height: 32px;
    padding: 0 var(--ui-space-3);
    border: 1px solid var(--ui-line);
    border-radius: 9999px;
    background: transparent;
    color: var(--ui-ink-2);
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .examples button:hover {
    border-color: var(--ui-ink-3);
    color: var(--ui-ink);
  }

  .helper {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--ui-space-4);
  }

  h2 {
    margin: 0;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ui-ink-3);
  }

  .more {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
    text-decoration: none;
  }

  .more:hover {
    color: var(--ui-ink);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--ui-space-6) var(--ui-space-4);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .poster {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 10;
    margin-bottom: var(--ui-space-2);
    overflow: hidden;
    background: var(--ui-surface);
    color: var(--ui-ink-3);
  }

  .poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 120ms;
  }

  .card:hover img {
    opacity: 0.88;
  }

  .name {
    font-size: var(--ui-text-md);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  .tools,
  .projects {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
  }

  .tool {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-2);
    height: 36px;
    padding: 0 var(--ui-space-3);
    background: var(--ui-surface);
    color: var(--ui-ink-2);
    text-decoration: none;
  }

  a.tool:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .badge {
    font-family: var(--ui-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ui-ink-3);
  }

  @media (min-width: 1024px) {
    .hero {
      --hero-chrome: var(--ui-space-8);
    }
  }

  @media (max-width: 640px) {
    .home {
      gap: 48px;
    }

    .hero {
      --hero-chrome: calc(var(--ui-bar-h) + var(--ui-space-2));
    }

    textarea {
      font-size: 16px;
    }

    .grid {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--ui-space-4) var(--ui-space-2);
    }
  }
</style>
