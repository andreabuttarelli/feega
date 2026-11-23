<script lang="ts">
  import { Key, type DemoState } from '../script';

  let { demo }: { demo: DemoState } = $props();
</script>

<span class="frame" style:--frame={demo[Key.Colour]}>
  <i class="image" class:contain={demo[Key.Fit] === 'contain'}></i>
</span>

<style>
  .frame {
    display: block;
    width: 88px;
    height: 36px;
    overflow: hidden;
    border-radius: 6px;
    background: #111111;
    box-shadow: 0 0 0 2px var(--frame);
    transition: box-shadow 0.4s cubic-bezier(0.87, 0, 0.13, 1);
  }

  .image {
    display: block;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #e7a46a, #b4532a);
    transform-origin: 50% 50%;
    transition: transform 0.5s cubic-bezier(0.87, 0, 0.13, 1);
  }

  .image.contain {
    transform: scale(0.55);
  }
</style>
