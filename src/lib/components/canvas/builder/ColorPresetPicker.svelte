<script lang="ts">
  import ColorField from '$lib/components/motion/ColorField.svelte';
  import { ColourDisplay } from '$lib/motion/colour-field';
  import type { ColorPreset } from '$lib/canvas/influencer-builder-options';

  let {
    presets,
    value = null,
    onChange
  }: {
    presets: readonly ColorPreset[];
    value: string | null;
    onChange: (color: string | null) => void;
  } = $props();
</script>

<div class="row">
  {#each presets as preset (preset.color)}
    <button
      type="button"
      class="dot"
      class:active={value === preset.color}
      style={`background:${preset.color};`}
      title={preset.label}
      onclick={() => onChange(value === preset.color ? null : preset.color)}
    ></button>
  {/each}
  <ColorField name="Custom colour" display={ColourDisplay.Chip} value={value || '#000000'} onchange={(v) => onChange(v)} />
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }
  .dot {
    width: 20px;
    height: 20px;
    padding: 0;
    border-radius: 0;
    border: 2px solid var(--line-2, #d2d2d7);
    cursor: pointer;
  }
  .dot.active {
    border-color: var(--accent, #7c5cff);
  }
</style>
