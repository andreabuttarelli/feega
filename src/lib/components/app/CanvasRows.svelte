<script lang="ts">
  import { editedAgo } from '$lib/relative-date';
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
        <span class="when">{editedAgo(canvas.updatedAt)}</span>
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
    border-radius: var(--ui-radius-md);
    color: var(--ui-text);
    text-decoration: none;
    transition: background var(--ui-dur-fast) var(--ui-ease);
  }

  .recent:hover {
    background: var(--ui-wash);
  }

  .recent:active {
    background: var(--ui-pressed);
  }

  .recent:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .thumb {
    display: flex;
    gap: 2px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
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
    color: var(--ui-text-tertiary);
  }

  .name {
    overflow: hidden;
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project,
  .when {
    font-size: var(--ui-type-label);
    color: var(--ui-text-tertiary);
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
