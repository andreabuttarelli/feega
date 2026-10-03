<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
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
            <span class="tool-icon"><Icon size={20} strokeWidth={1.6} /></span>
            <span class="tool-text">
              <span class="tool-name">{tool.name}{#if badge}<span class="badge">{badge}</span>{/if}</span>
              <span class="muted">{tool.description}</span>
            </span>
            {#if href}<ArrowRight size={16} class="tool-arrow" />{/if}
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
    gap: 32px;
  }

  .section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  h3 {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-soft);
  }

  .muted {
    font-size: 12px;
    color: var(--ink-soft);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .new-project {
    display: flex;
    gap: 6px;
  }

  .new-project input {
    height: 32px;
    width: 180px;
    padding: 0 8px;
    border: 1px solid var(--line-2);
    background: var(--paper);
    color: var(--ink);
    font-size: 13px;
  }

  .primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--ink);
    background: var(--ink);
    color: var(--paper);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .projects {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .project {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--line);
    background: var(--paper);
  }

  .cover {
    display: block;
    aspect-ratio: 16 / 10;
    background: var(--paper-3);
    overflow: hidden;
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
  }

  .empty-cover {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--ink-faint);
  }

  .project-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px 12px;
  }

  .project-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
  }

  .canvases {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .canvases a {
    padding: 2px 6px;
    border: 1px solid var(--line);
    font-size: 11.5px;
    color: var(--ink-soft);
    text-decoration: none;
  }

  .canvases a:hover,
  .project-name:hover {
    color: var(--ink);
    text-decoration: underline;
  }

  .tools {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
  }

  .tool {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
    padding: 14px;
    border: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    text-decoration: none;
  }

  a.tool:hover {
    border-color: var(--ink);
  }

  .tool.is-disabled {
    opacity: 0.55;
  }

  .tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 40px;
    height: 40px;
    background: var(--paper-3);
  }

  .tool-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1 1 auto;
    min-width: 0;
  }

  .tool-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }

  .badge {
    padding: 1px 5px;
    border: 1px solid var(--accent);
    color: var(--accent-ink);
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .outputs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }

  .output-list {
    padding: 12px;
    border: 1px solid var(--line);
    background: var(--paper);
  }

  .output-list li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0;
    border-top: 1px solid var(--line);
  }

  .output-list li:first-child {
    border-top: 0;
  }

  .output-list a {
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    text-decoration: none;
  }

  .motion-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .motion-row img,
  .poster-empty {
    width: 28px;
    height: 28px;
    object-fit: cover;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--paper-3);
    color: var(--ink-faint);
  }

  @media (max-width: 640px) {
    .new-project {
      width: 100%;
    }

    .new-project input {
      flex: 1 1 auto;
      width: auto;
    }

    .projects {
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
  }
</style>
