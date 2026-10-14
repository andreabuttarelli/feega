<script lang="ts">
  import { relativeDate } from '$lib/relative-date';
  import type { DashboardCanvas } from '$lib/server/dashboard/dashboard';

  let { canvases, testid }: { canvases: DashboardCanvas[]; testid: string } = $props();

  const THUMB_W = 96;
  const THUMB_H = 54;
</script>

<ul data-testid={testid}>
  {#each canvases as canvas (canvas.id)}
    <li>
      <a href={canvas.href} class="recent" data-testid="canvas-card">
        <span class="thumb">
          {#each canvas.thumbs as src (src)}
            <img {src} alt="" loading="lazy" decoding="async" width={THUMB_W} height={THUMB_H} />
          {:else}
            <span class="initial" aria-hidden="true">{canvas.name.slice(0, 1).toLocaleLowerCase()}</span>
          {/each}
        </span>
        <span class="name">{canvas.name}</span>
        <span class="project">{canvas.projectName}</span>
        <span class="when">{relativeDate(canvas.updatedAt)}</span>
      </a>
    </li>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .recent {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--ui-space-4);
    min-height: 44px;
    padding: var(--ui-space-2);
    margin: 0 calc(-1 * var(--ui-space-2));
    color: var(--ui-ink);
    text-decoration: none;
    transition: background 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .recent:hover {
    background: var(--ui-hover);
  }

  .recent:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .thumb {
    display: flex;
    gap: 2px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--ui-surface);
  }

  .thumb img {
    flex: 1 1 0;
    min-width: 0;
    height: 100%;
    object-fit: cover;
  }

  .initial {
    display: grid;
    place-items: center;
    width: 100%;
    font-size: var(--ui-text-lg);
    font-weight: var(--ui-mega-weight);
    letter-spacing: var(--ui-mega-tracking);
    color: var(--ui-text-3);
  }

  .name {
    overflow: hidden;
    font-size: var(--ui-text-md);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project,
  .when {
    font-size: var(--ui-text-sm);
    color: var(--ui-text-3);
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .recent {
      grid-template-columns: 72px minmax(0, 1fr) auto;
      gap: var(--ui-space-3);
    }

    .project {
      display: none;
    }
  }
</style>
