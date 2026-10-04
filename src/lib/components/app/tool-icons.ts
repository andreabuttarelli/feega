import Camera from '@lucide/svelte/icons/camera';
import Clapperboard from '@lucide/svelte/icons/clapperboard';
import Maximize2 from '@lucide/svelte/icons/maximize-2';
import Orbit from '@lucide/svelte/icons/orbit';
import type { Component } from 'svelte';
import type { ToolIcon } from '$lib/tools';

export const TOOL_ICONS: Record<ToolIcon, Component<{ size?: number; strokeWidth?: number }>> = {
  camera: Camera,
  clapperboard: Clapperboard,
  upscale: Maximize2,
  orbit: Orbit
};
