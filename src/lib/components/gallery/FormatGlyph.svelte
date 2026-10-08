<script lang="ts">
  import type { MotionFormat } from '$lib/motion/doc';
  import { glyphSize } from '$lib/gallery/model';

  let { format }: { format: MotionFormat } = $props();

  const size = $derived(glyphSize(format));
</script>

<span class="glyph" aria-hidden="true"><i style={`width: ${size.width}px; height: ${size.height}px;`}></i></span>

<style>
  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex: none;
  }

  i {
    display: block;
    box-shadow: inset 0 0 0 1.25px currentColor;
  }
</style>
