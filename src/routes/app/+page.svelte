<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { enhance } from '$app/forms';
  import VideoCard from '$lib/components/app/VideoCard.svelte';
  import ProjectCard from '$lib/components/app/ProjectCard.svelte';
  import type { VideoPage } from '$lib/server/dashboard/dashboard';
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
  const SKELETONS = 5;

  let sending = $state(false);
  let brief = $state('');
  let turn = $state(0);
  let dragging = $state(false);
  let field = $state<HTMLTextAreaElement | null>(null);
  let composer = $state<HTMLFormElement | null>(null);
  let picker = $state<HTMLInputElement | null>(null);
  let videos = $state(data.dashboard.motions);
  let more = $state(data.dashboard.moreVideos);
  let loadingMore = $state(false);

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

  async function loadMore() {
    if (!more || loadingMore) {
      return;
    }
    loadingMore = true;
    try {
      const response = await fetch(`/app/videos?before=${encodeURIComponent(more)}`);
      if (!response.ok) {
        return;
      }
      const page: VideoPage = await response.json();
      const seen = new Set(videos.map((v) => v.id));
      videos = [...videos, ...page.videos.filter((v) => !seen.has(v.id))];
      more = page.more;
    } finally {
      loadingMore = false;
    }
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

  <a class="peek" href="#videos-heading" data-testid="home-peek">your videos <span aria-hidden="true">↓</span></a>

  <section class="shelf" aria-labelledby="videos-heading">
    <h2 id="videos-heading">your videos</h2>
    {#if videos.length}
      <ul class="grid" data-testid="home-videos">
        {#each videos as video (video.id)}
          <li><VideoCard {video} /></li>
        {/each}
        {#if loadingMore}
          {#each { length: SKELETONS } as _, i (i)}
            <li class="skeleton" aria-hidden="true"><span></span><i></i><i></i></li>
          {/each}
        {/if}
      </ul>
      {#if more}
        <button type="button" class="quiet more-videos" data-testid="more-videos" disabled={loadingMore} onclick={loadMore}>show more</button>
      {/if}
    {:else}
      <p class="empty" data-testid="home-videos-empty">nothing here yet. <a href="#video-brief">describe your first video</a> and it lands here.</p>
    {/if}
  </section>

  <section class="shelf" aria-labelledby="projects-heading">
    <div class="head">
      <h2 id="projects-heading">projects</h2>
      <form method="POST" action="?/project">
        <button type="submit" class="quiet" data-testid="new-project">+ new project</button>
      </form>
    </div>
    {#if data.dashboard.projects.length}
      <ul class="grid" data-testid="home-projects">
        {#each data.dashboard.projects as project (project.id)}
          <li><ProjectCard {project} /></li>
        {/each}
      </ul>
    {:else}
      <p class="empty" data-testid="home-projects-empty">no projects yet. every video you make opens one.</p>
    {/if}
  </section>

  {#if data.gallery.length}
    <section class="shelf" aria-labelledby="gallery-heading">
      <div class="head">
        <h2 id="gallery-heading">remix from the gallery</h2>
        <a class="quiet" href={GALLERY_PATH} data-sveltekit-reload>see all</a>
      </div>
      <ul class="row-strip" data-testid="home-gallery">
        {#each data.gallery as card (card.id)}
          <li>
            <a href={itemPath(card.id)} class="strip-card" data-sveltekit-reload>
              <span class="strip-poster">
                {#if card.posterUrl}<img src={card.posterUrl} alt="" loading="lazy" decoding="async" width="240" height="135" />{/if}
              </span>
              <span class="strip-title">{card.title}</span>
              <span class="strip-meta">{byline(card)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .home {
    max-width: 1200px;
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
    --peek: 260px;
    min-height: calc(100svh - var(--hero-chrome) - var(--peek));
    padding-top: calc(var(--peek) / 2);
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

  .home .peek {
    align-self: center;
    margin: calc(-1 * var(--ui-space-8) - var(--ui-space-6)) 0 calc(-1 * var(--ui-space-8));
    padding: var(--ui-space-2) var(--ui-space-3);
    font-size: var(--ui-text-sm);
    color: var(--ui-text-3);
    text-decoration: none;
    transition: color 0.14s ease;
  }

  .home .peek:hover {
    color: var(--ui-ink);
  }

  .shelf {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-6);
    scroll-margin-top: var(--ui-space-8);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 32px;
  }

  h2 {
    margin: 0;
    font-size: var(--ui-text-md);
    font-weight: 500;
    color: var(--ui-text-3);
  }

  .quiet {
    height: 32px;
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-sm);
    line-height: 32px;
    text-decoration: none;
    cursor: pointer;
    transition:
      background 0.14s ease,
      color 0.14s ease;
  }

  .quiet:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .more-videos {
    align-self: center;
    background: var(--ui-field);
    color: var(--ui-ink);
    padding: 0 var(--ui-space-6);
  }

  .more-videos:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .empty {
    margin: 0;
    padding: var(--ui-space-8) 0;
    font-size: var(--ui-text-md);
    color: var(--ui-text-3);
  }

  .empty a {
    color: var(--ui-ink);
    text-decoration: underline;
    text-decoration-color: var(--ui-text-3);
    text-underline-offset: 3px;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-6) var(--ui-space-3);
  }

  .skeleton span {
    display: block;
    aspect-ratio: 16 / 9;
    margin-bottom: var(--ui-space-3);
    background: var(--ui-surface);
    animation: breathe 1.4s ease-in-out infinite;
  }

  .skeleton i {
    display: block;
    width: 70%;
    height: 12px;
    margin-top: 6px;
    background: var(--ui-surface);
    animation: breathe 1.4s ease-in-out infinite;
  }

  .skeleton i + i {
    width: 45%;
  }

  @keyframes breathe {
    50% {
      opacity: 0.5;
    }
  }

  .row-strip {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(160px, 1fr);
    gap: var(--ui-space-3);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .strip-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .strip-poster {
    display: block;
    aspect-ratio: 16 / 9;
    margin-bottom: var(--ui-space-2);
    overflow: hidden;
    background: var(--ui-surface);
  }

  .strip-poster img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 200ms ease;
  }

  .strip-card:hover img {
    opacity: 0.88;
  }

  .strip-title {
    overflow: hidden;
    font-size: var(--ui-text-sm);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .strip-meta {
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
  }

  @media (min-width: 641px) {
    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--ui-space-8) var(--ui-space-4);
    }
  }

  @media (min-width: 1280px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (min-width: 1600px) {
    .grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
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
  }
</style>
