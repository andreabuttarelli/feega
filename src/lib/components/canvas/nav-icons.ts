import Images from '@lucide/svelte/icons/images';
import Building from '@lucide/svelte/icons/building';
import UserRound from '@lucide/svelte/icons/user-round';
import Megaphone from '@lucide/svelte/icons/megaphone';
import Settings from '@lucide/svelte/icons/settings';
import Camera from '@lucide/svelte/icons/camera';
import Layers from '@lucide/svelte/icons/layers';
import type { Component } from 'svelte';
import type { NavEntry } from '$lib/shell-nav';

export const NAV_ICONS: Record<NavEntry['icon'], Component<{ size?: number }>> = {
  images: Images,
  building: Building,
  'user-round': UserRound,
  megaphone: Megaphone,
  settings: Settings,
  camera: Camera,
  layers: Layers
};
