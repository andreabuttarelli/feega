<script lang="ts">
  import { relativeDate } from '$lib/relative-date';
  import type { DashboardProject } from '$lib/server/dashboard/dashboard';

  let { project }: { project: DashboardProject } = $props();

  const MOSAIC = 4;
  const TILE_W = 240;
  const TILE_H = 135;

  const pictures = $derived([...new Set([...project.posters, ...project.thumbs])].slice(0, MOSAIC));
  const count = $derived(`${project.videoCount} ${project.videoCount === 1 ? 'video' : 'videos'}`);
</script>

<a href={project.href} class="project" data-testid="project-card">
  <span class="cover" data-count={pictures.length}>
    {#each pictures as src (src)}
      <img {src} alt="" loading="lazy" decoding="async" width={TILE_W} height={TILE_H} />
    {:else}
      <span class="initial" aria-hidden="true">{project.name.slice(0, 1).toLocaleLowerCase()}</span>
    {/each}
  </span>
  <span class="title">{project.name}</span>
  <span class="meta">{count} · {relativeDate(project.updatedAt)}</span>
</a>

<style>
  .project {
    display: flex;
    flex-direction: column;
    min-width: 0;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .cover {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 2px;
    aspect-ratio: 16 / 9;
    margin-bottom: var(--ui-space-3);
    overflow: hidden;
    background: var(--ui-surface);
  }

  .cover[data-count='1'] img,
  .cover[data-count='0'] .initial {
    grid-column: 1 / -1;
    grid-row: 1 / -1;
  }

  .cover[data-count='2'] img,
  .cover[data-count='3'] img:first-child {
    grid-row: 1 / -1;
  }

  img {
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: cover;
    transition: opacity 200ms ease;
  }

  .project:hover img {
    opacity: 0.88;
  }

  .project:focus-visible {
    outline: none;
  }

  .project:focus-visible .cover {
    box-shadow: var(--ui-focus);
  }

  .initial {
    display: grid;
    place-items: center;
    font-size: clamp(40px, 5vw, 64px);
    font-weight: var(--ui-mega-weight);
    letter-spacing: var(--ui-mega-tracking);
    line-height: 1;
    color: var(--ui-text-3);
  }

  .title {
    overflow: hidden;
    font-size: var(--ui-text-md);
    font-weight: 500;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    font-size: var(--ui-text-sm);
    color: var(--ui-text-3);
  }
</style>
