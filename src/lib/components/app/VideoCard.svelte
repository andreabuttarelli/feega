<script lang="ts">
  import PreviewCard from '$lib/components/compose/PreviewCard.svelte';
  import FormatGlyph from '$lib/components/gallery/FormatGlyph.svelte';
  import { FORMATS } from '$lib/motion/doc';
  import { relativeDate } from '$lib/relative-date';
  import type { DashboardMotion } from '$lib/server/dashboard/dashboard';

  let { video }: { video: DashboardMotion } = $props();

  const POSTER_LONG_SIDE = 480;

  const size = $derived(FORMATS[video.format]);
  const width = $derived(Math.round((POSTER_LONG_SIDE * size.width) / Math.max(size.width, size.height)));
  const height = $derived(Math.round((POSTER_LONG_SIDE * size.height) / Math.max(size.width, size.height)));
</script>

<a href={video.href} class="video" data-testid="video-card">
  <span class="well">
    {#if video.poster || video.preview}
      <span class="frame" style={`aspect-ratio: ${size.width} / ${size.height};`}>
        <PreviewCard poster={video.poster} preview={video.preview} {width} {height} />
      </span>
    {:else}
      <span class="blank" style={`aspect-ratio: ${size.width} / ${size.height};`}></span>
    {/if}
  </span>
  <span class="title">{video.name}</span>
  <span class="meta">
    <span class="project">{video.projectName}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span>{relativeDate(video.updatedAt)}</span>
    <span class="format" title={size.label}><FormatGlyph format={video.format} /></span>
  </span>
</a>

<style>
  .video {
    display: flex;
    flex-direction: column;
    min-width: 0;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .well {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 9;
    margin-bottom: var(--ui-space-3);
    overflow: hidden;
    background: var(--ui-surface);
  }

  .frame {
    height: 100%;
    max-width: 100%;
    transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .blank {
    height: 64%;
    max-width: 64%;
    background: var(--ui-hover);
  }

  .video:hover .frame {
    transform: scale(1.02);
  }

  .video:focus-visible {
    outline: none;
  }

  .video:focus-visible .well {
    box-shadow: var(--ui-focus);
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
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-text-3);
  }

  .project {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dot {
    flex: none;
  }

  .format {
    display: inline-flex;
    margin-left: auto;
  }
</style>
