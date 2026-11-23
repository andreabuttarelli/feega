<script lang="ts">
  import { GuideId } from '..';
  import { MOCKS } from './registry';
  import { Anchor } from './subjects';

  let { id }: { id: GuideId } = $props();

  const entry = $derived(MOCKS[id]);
  const Mock = $derived(entry.component);
</script>

<div class="crop" data-mock-for={id} style:--fx={entry.focus.x} style:--fy={entry.focus.y} style:--zp={entry.zoom.phone} style:--zd={entry.zoom.desktop}>
  <div class="placed" class:corner={entry.anchor === Anchor.TopRight}><Mock {...entry.props} /></div>
</div>

<style>
  .crop {
    --z: var(--zp);

    position: relative;
    width: 100%;
    max-width: 520px;
    height: 240px;
    overflow: hidden;
    border-radius: 12px;
    background: #0d0d0d;
  }

  .placed {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(calc(var(--fx) * var(--z) * -1px), calc(var(--fy) * var(--z) * -1px)) scale(var(--z));
    transform-origin: 0 0;
  }

  .placed.corner {
    top: 0;
    right: 0;
    left: auto;
    transform: scale(var(--z));
    transform-origin: 100% 0;
  }

  @media (min-width: 900px) {
    .crop {
      --z: var(--zd);

      height: 100%;
    }
  }
</style>
