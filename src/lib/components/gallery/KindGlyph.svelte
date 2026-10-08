<script lang="ts">
  import type { Component } from 'svelte';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import Boxes from '@lucide/svelte/icons/boxes';
  import { GalleryKind } from '$lib/gallery/model';

  let { kind }: { kind: GalleryKind } = $props();

  const ICON: Record<GalleryKind, Component<{ size?: number; strokeWidth?: number }>> = {
    [GalleryKind.Motion]: Clapperboard,
    [GalleryKind.Composition]: Boxes
  };

  const Icon = $derived(ICON[kind]);
</script>

<span class="glyph" aria-hidden="true"><Icon size={13} strokeWidth={1.6} /></span>

<style>
  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    flex: none;
  }
</style>
