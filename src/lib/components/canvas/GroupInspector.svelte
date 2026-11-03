<script lang="ts">
  import FamilyIcon from '$lib/components/motion/FamilyIcon.svelte';
  import FramePresetSection from '$lib/components/motion/FramePresetSection.svelte';
  import FramePlaceSection from './FramePlaceSection.svelte';
  import ExportSection from './ExportSection.svelte';
  import { CLIP_FAMILIES, ClipFamily } from '$lib/motion/track-style';
  import { FrameSizing } from '$lib/motion/frame-presets';
  import { frameProperties } from './frame-properties.svelte';

  const KIND = CLIP_FAMILIES[ClipFamily.Group].label;
</script>

<aside class="group-inspector" data-testid="group-inspector" aria-label="Properties" style={`--hue: ${CLIP_FAMILIES[ClipFamily.Group].hue};`}>
  <header class="head">
    <span class="icon"><FamilyIcon family={ClipFamily.Group} /></span>
    <input class="name" aria-label="Group name" data-testid="group-name" value={frameProperties.name} readonly={!frameProperties.rename} onchange={(e) => frameProperties.rename?.(e.currentTarget.value.trim())} />
    <span class="kind">{KIND}</span>
  </header>
  {#if frameProperties.place}
    <FramePlaceSection place={frameProperties.place} />
    <FramePresetSection place={frameProperties.place} sizing={FrameSizing.Free} />
  {/if}
  {#if frameProperties.exportRows}<ExportSection name={frameProperties.name} onexport={frameProperties.exportRows} />{/if}
</aside>

<style>
  .group-inspector {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
    font-size: var(--ui-text-xs);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--ui-header-h);
    flex-shrink: 0;
    padding: 0 var(--ui-space-2) 0 var(--ui-space-4);
    border-bottom: 1px solid var(--ui-divider);
  }

  .icon {
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: var(--ui-radius-sm);
    background: color-mix(in srgb, var(--hue) 16%, transparent);
    color: var(--hue);
  }

  .name {
    flex: 1;
    min-width: 0;
    height: var(--ui-row);
    padding: 0 6px;
    margin-left: -6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-ink);
    font-family: inherit;
    font-weight: var(--ui-weight-semibold);
    font-size: var(--ui-text-lg);
    letter-spacing: var(--ui-tracking-title);
  }

  .name:hover {
    background: var(--ui-hover);
  }

  .name:focus {
    outline: none;
    background: var(--ui-input);
  }

  .kind {
    flex-shrink: 0;
    color: var(--ui-ink-3);
  }
</style>
