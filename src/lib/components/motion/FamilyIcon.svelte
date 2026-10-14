<script lang="ts">
  import type { Component } from 'svelte';
  import Type from '@lucide/svelte/icons/type';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Film from '@lucide/svelte/icons/film';
  import AudioLines from '@lucide/svelte/icons/audio-lines';
  import Square from '@lucide/svelte/icons/square';
  import Box from '@lucide/svelte/icons/box';
  import Puzzle from '@lucide/svelte/icons/puzzle';
  import Crosshair from '@lucide/svelte/icons/crosshair';
  import Camera from '@lucide/svelte/icons/camera';
  import SquareDashed from '@lucide/svelte/icons/square-dashed';
  import Layers from '@lucide/svelte/icons/layers';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import Frame from '@lucide/svelte/icons/frame';
  import { ClipFamily } from '$lib/motion/track-style';

  let { family = null, size = 14 }: { family?: ClipFamily | null; size?: number } = $props();

  const ICONS: Record<ClipFamily, Component<{ size?: number }>> = {
    [ClipFamily.Text]: Type,
    [ClipFamily.Image]: ImageIcon,
    [ClipFamily.Video]: Film,
    [ClipFamily.Audio]: AudioLines,
    [ClipFamily.Shape]: Square,
    [ClipFamily.ThreeD]: Box,
    [ClipFamily.Custom]: Puzzle,
    [ClipFamily.Null]: Crosshair,
    [ClipFamily.Camera]: Camera,
    [ClipFamily.Mask]: SquareDashed,
    [ClipFamily.Precomp]: Layers,
    [ClipFamily.Adjustment]: SlidersHorizontal
  };

  const Icon = $derived(family ? ICONS[family] : Frame);
</script>

<Icon {size} />
