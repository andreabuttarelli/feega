<script lang="ts">
  import AudioPlayer from './AudioPlayer.svelte';
  import NodeDownload from './NodeDownload.svelte';
  import { MediaOrigin, type DownloadFile } from '$lib/canvas/download';

  let {
    nodeId,
    videoUrl,
    audioUrl,
    files
  }: {
    nodeId: string;
    videoUrl: string | null;
    audioUrl: string | null;
    files: DownloadFile[];
  } = $props();
</script>

<div class="audio-result" data-testid="audio-result">
  {#if videoUrl}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video src={videoUrl} controls playsinline preload="metadata" data-testid="dubbed-video"></video>
  {/if}
  {#if audioUrl}
    <AudioPlayer src={audioUrl} cacheKey={audioUrl} filename={null} />
  {/if}
  {#if files.length}
    <div class="audio-result-download">
      <NodeDownload kind="video" sourceUrl={files[0].url} {nodeId} nodeType="audio" origin={MediaOrigin.Generated} {files} />
    </div>
  {/if}
</div>

<style>
  .audio-result {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .audio-result video {
    flex: 1;
    min-height: 0;
    width: 100%;
    object-fit: contain;
    background: #000;
  }
  .audio-result-download {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 2;
  }
</style>
