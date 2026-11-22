<script lang="ts">
  import { lower } from '../lower';
  import { previewPath } from './paths';
  import { HEIGHT_MESSAGE } from './preview';
  import { Theme, type Template } from './template';

  let { template }: { template: Template } = $props();

  const VIEWPORTS = [375, 768, 1280] as const;
  const FIRST_HEIGHT = 520;

  let viewport = $state<number>(1280);
  let theme = $state<Theme>(Theme.Dark);
  let boxWidth = $state(0);
  let height = $state(FIRST_HEIGHT);
  let frame = $state<HTMLIFrameElement>();

  const scale = $derived(boxWidth > 0 ? Math.min(1, boxWidth / viewport) : 1);

  function onMessage(event: MessageEvent) {
    if (event.source !== frame?.contentWindow || event.data?.type !== HEIGHT_MESSAGE) {
      return;
    }
    height = Number(event.data.height) || FIRST_HEIGHT;
  }
</script>

<svelte:window onmessage={onMessage} />

<div class="tpl-preview">
  <div class="tpl-tools">
    <div class="chips" role="group" aria-label="Preview width">
      {#each VIEWPORTS as width (width)}
        <button type="button" aria-pressed={viewport === width} onclick={() => (viewport = width)}>{width}</button>
      {/each}
    </div>
    <div class="chips" role="group" aria-label="Preview theme">
      <button type="button" aria-pressed={theme === Theme.Light} onclick={() => (theme = Theme.Light)}>{lower('Light')}</button>
      <button type="button" aria-pressed={theme === Theme.Dark} onclick={() => (theme = Theme.Dark)}>{lower('Dark')}</button>
    </div>
  </div>
  <div class="stage" bind:clientWidth={boxWidth} style="height:{height * scale}px">
    <iframe
      bind:this={frame}
      title="{template.name} live preview"
      src="{previewPath(template.id)}#{theme}"
      sandbox="allow-scripts"
      loading="lazy"
      style="width:{viewport}px;height:{height}px;transform:scale({scale})"
    ></iframe>
  </div>
</div>
