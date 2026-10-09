<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Film from '@lucide/svelte/icons/film';
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';
  import { TOOL_STATUS_LABEL, toolHref } from '$lib/tools';
  import { TOOL_ICONS } from '$lib/components/app/tool-icons';
  import { GALLERY_PATH, byline, itemPath } from '$lib/gallery/model';
  import { BRIEF_MAX } from '$lib/motion/video-brief';

  let { data, form } = $props();

  let sending = $state(false);
  let field = $state<HTMLInputElement | null>(null);

  onMount(() => field?.focus());

  const recentProjectId = $derived(data.dashboard.projects[0]?.id ?? null);

  const submit = () => {
    sending = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      sending = false;
    };
  };
</script>

<svelte:head><title>Make a video · feega</title></svelte:head>

<div class="home">
  <section class="hero" aria-labelledby="create-heading">
    <PageTitle id="create-heading" text="make a video." />

    <form method="POST" action="?/video" class="brief" use:enhance={submit}>
      <input
        name="brief"
        id="video-brief"
        data-testid="video-brief"
        placeholder="Your website or what you want to make"
        aria-label="Your website or what you want to make"
        maxlength={BRIEF_MAX}
        autocomplete="off"
        bind:this={field}
        required
      />
      <button type="submit" class="go" disabled={sending} aria-label="Create video">
        <span class="go-label">Make it</span><ArrowRight size={16} strokeWidth={1.8} />
      </button>
    </form>
    {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

    <form method="POST" action="?/video" class="templates" use:enhance={submit} aria-label="Templates">
      {#each data.templates as template (template.id)}
        <button type="submit" name="brief" value={template.brief} disabled={sending}>{template.name}</button>
      {/each}
    </form>
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
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    padding-top: 8vh;
  }

  .brief {
    display: flex;
    margin-top: var(--ui-space-4);
    background: var(--ui-surface);
    border: 1px solid var(--ui-line-strong);
  }

  .brief:focus-within {
    border-color: var(--ui-accent);
  }

  .brief input {
    flex: 1 1 auto;
    min-width: 0;
    height: 64px;
    padding: 0 var(--ui-space-4);
    border: 0;
    background: transparent;
    color: var(--ui-ink);
    font-size: var(--ui-text-lg);
  }

  .brief input:focus {
    outline: none;
  }

  .brief input::placeholder {
    color: var(--ui-ink-3);
  }

  .go {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-2);
    padding: 0 var(--ui-space-6);
    border: 0;
    background: var(--ui-ink);
    color: var(--ui-bg);
    font-size: var(--ui-text-md);
    font-weight: 600;
    cursor: pointer;
  }

  .go:disabled {
    opacity: 0.5;
  }

  .error {
    margin: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-danger);
  }

  .templates {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2);
  }

  .templates button {
    height: 28px;
    padding: 0 var(--ui-space-3);
    border: 1px solid var(--ui-line);
    background: transparent;
    color: var(--ui-ink-2);
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .templates button:hover {
    border-color: var(--ui-ink-3);
    color: var(--ui-ink);
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

  @media (max-width: 640px) {
    .home {
      gap: 48px;
    }

    .hero {
      padding-top: var(--ui-space-6);
    }

    .brief input {
      height: 52px;
      font-size: var(--ui-text-md);
    }

    .go {
      padding: 0 var(--ui-space-4);
    }

    .go-label {
      display: none;
    }

    .grid {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--ui-space-4) var(--ui-space-2);
    }
  }
</style>
