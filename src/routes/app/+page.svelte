<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Film from '@lucide/svelte/icons/film';
  import Images from '@lucide/svelte/icons/images';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';
  import { TOOL_STATUS_LABEL, toolHref } from '$lib/tools';
  import { TOOL_ICONS } from '$lib/components/app/tool-icons';

  let { data } = $props();

  const recentProjectId = $derived(data.dashboard.projects[0]?.id ?? null);
  const hasOutputs = $derived(data.dashboard.batches.length > 0 || data.dashboard.motions.length > 0);
</script>

<svelte:head><title>Dashboard · feega</title></svelte:head>

<div class="dashboard">
  <h1>Home</h1>

  <section aria-labelledby="projects-heading">
    <div class="section-head">
      <h2 id="projects-heading">Projects</h2>
      <form method="POST" action="?/project" class="new-project">
        <input name="name" placeholder="Project name" aria-label="New project name" maxlength="80" />
        <button type="submit" class="primary"><Plus size={14} /> New project</button>
      </form>
    </div>

    <ul class="projects" data-testid="dashboard-projects">
      {#each data.dashboard.projects as project (project.id)}
        <li class="project">
          <a class="cover" href={project.href} aria-label={`Open ${project.name}`}>
            {#if project.thumbs.length}
              <span class="mosaic" data-count={project.thumbs.length}>
                {#each project.thumbs as thumb (thumb)}
                  <img src={thumb} alt="" loading="lazy" />
                {/each}
              </span>
            {:else}
              <span class="empty-cover"><Images size={22} strokeWidth={1.5} /></span>
            {/if}
          </a>
          <div class="project-body">
            <a class="project-name" href={project.href}>{project.name}</a>
            <span class="muted">Edited {formatLastEdited(project.updatedAt)}</span>
            {#if project.canvases.length}
              <span class="canvases">
                {#each project.canvases as canvas (canvas.id)}
                  <a href={canvas.href}>{canvas.name}</a>
                {/each}
              </span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="tools-heading">
    <div class="section-head">
      <h2 id="tools-heading">Tools</h2>
    </div>
    <ul class="tools" data-testid="dashboard-tools">
      {#each data.tools as tool (tool.id)}
        {@const Icon = TOOL_ICONS[tool.icon]}
        {@const href = toolHref(tool, recentProjectId)}
        {@const badge = TOOL_STATUS_LABEL[tool.status]}
        <li>
          <svelte:element this={href ? 'a' : 'div'} class="tool" class:is-disabled={!href} {href}>
            <span class="tool-preview"><Icon size={28} strokeWidth={1.4} /></span>
            <span class="tool-name">{tool.name}{#if badge}<span class="badge">{badge}</span>{/if}</span>
            <span class="muted">{tool.description}</span>
          </svelte:element>
        </li>
      {/each}
    </ul>
  </section>

  {#if hasOutputs}
    <section aria-labelledby="outputs-heading">
      <div class="section-head">
        <h2 id="outputs-heading">Recent outputs</h2>
      </div>
      <div class="outputs">
        {#if data.dashboard.batches.length}
          <div class="output-list">
            <h3>Photo studio</h3>
            <ul>
              {#each data.dashboard.batches as batch (batch.id)}
                <li><a href={batch.href}>{batch.name}</a><span class="muted">{batch.projectName} · {batch.status}</span></li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if data.dashboard.motions.length}
          <div class="output-list">
            <h3>Motion</h3>
            <ul>
              {#each data.dashboard.motions as motion (motion.id)}
                <li>
                  <a href={motion.href} class="motion-row">
                    {#if motion.poster}<img src={motion.poster} alt="" loading="lazy" />{:else}<span class="poster-empty"><Film size={14} /></span>{/if}
                    {motion.name}
                  </a>
                  <span class="muted">{motion.projectName} · {formatLastEdited(motion.updatedAt)}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 48px;
    color: var(--ui-ink);
  }

  h1 {
    margin: 0;
    font-size: var(--ui-text-xl);
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-3);
    min-height: 32px;
    margin-bottom: var(--ui-space-4);
  }

  h2 {
    margin: 0;
    font-size: var(--ui-text-md);
    font-weight: 600;
    color: var(--ui-ink);
  }

  h3 {
    margin: 0 0 var(--ui-space-2);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ui-ink-3);
  }

  .muted {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .new-project {
    display: flex;
    gap: var(--ui-space-2);
  }

  .new-project input {
    height: 32px;
    width: 200px;
    padding: 0 var(--ui-space-3);
    border: 0;
    background: var(--ui-surface);
    color: var(--ui-ink);
    font-size: var(--ui-text-md);
  }

  .new-project input:focus {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 var(--ui-space-3);
    border: 0;
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font-size: var(--ui-text-md);
    font-weight: 600;
    cursor: pointer;
  }

  .primary:hover {
    background: color-mix(in srgb, var(--ui-accent) 88%, #000);
  }

  .projects,
  .tools {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--ui-space-6) var(--ui-space-4);
  }

  .project {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .cover,
  .tool-preview {
    display: block;
    aspect-ratio: 16 / 10;
    background: var(--ui-surface);
    overflow: hidden;
    transition: background 120ms;
  }

  .cover:hover,
  a.tool:hover .tool-preview {
    background: var(--ui-hover);
  }

  .mosaic {
    display: grid;
    width: 100%;
    height: 100%;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 1px;
  }

  .mosaic[data-count='1'] {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }

  .mosaic[data-count='2'] {
    grid-template-rows: 1fr;
  }

  .mosaic img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 120ms;
  }

  .cover:hover img {
    opacity: 0.9;
  }

  .empty-cover {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--ui-ink-3);
  }

  .project-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .project-name {
    font-size: var(--ui-text-md);
    font-weight: 500;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .project-name:hover {
    color: var(--ui-accent);
  }

  .canvases {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-1) var(--ui-space-3);
    margin-top: var(--ui-space-1);
  }

  .canvases a {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-2);
    text-decoration: none;
  }

  .canvases a:hover {
    color: var(--ui-accent);
  }

  .tool {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .tool.is-disabled {
    opacity: 0.5;
  }

  .tool-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--ui-space-2);
    color: var(--ui-ink-2);
  }

  a.tool:hover .tool-preview {
    color: var(--ui-ink);
  }

  .tool-name {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    font-size: var(--ui-text-md);
    font-weight: 500;
  }

  .badge {
    padding: 0 4px;
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
    font-family: var(--ui-mono);
    font-size: 9px;
    line-height: 14px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .outputs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--ui-space-4);
  }

  .output-list {
    padding: var(--ui-space-4);
    background: var(--ui-surface);
  }

  .output-list li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--ui-space-2) 0;
  }

  .output-list a {
    font-size: var(--ui-text-md);
    font-weight: 500;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .output-list a:hover {
    color: var(--ui-accent);
  }

  .motion-row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }

  .motion-row img,
  .poster-empty {
    width: 28px;
    height: 28px;
    object-fit: cover;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--ui-hover);
    color: var(--ui-ink-3);
  }

  @media (max-width: 640px) {
    .dashboard {
      gap: var(--ui-space-8);
    }

    .new-project {
      width: 100%;
    }

    .new-project input {
      flex: 1 1 auto;
      width: auto;
    }

    .projects,
    .tools {
      grid-template-columns: repeat(2, 1fr);
      gap: var(--ui-space-4) var(--ui-space-2);
    }
  }
</style>
