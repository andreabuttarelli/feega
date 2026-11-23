<script lang="ts">
  import { VideoFormat, proPosterPath, proVideoPath } from './paths';
  import type { Template } from './template';

  let { template }: { template: Template } = $props();
</script>

<div class="tpl-preview">
  <video class="pro-video" autoplay loop muted playsinline preload="metadata" poster={proPosterPath(template.id)} aria-label="{template.name} running">
    <source src={proVideoPath(template.id, VideoFormat.Webm)} type="video/webm" />
    <source src={proVideoPath(template.id, VideoFormat.Mp4)} type="video/mp4" />
  </video>
</div>

<style>
  .pro-video {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    border-radius: inherit;
    object-fit: cover;
  }
</style>
