import Images from '@lucide/svelte/icons/images';
import Palette from '@lucide/svelte/icons/palette';
import UsersRound from '@lucide/svelte/icons/users-round';
import Megaphone from '@lucide/svelte/icons/megaphone';
import Settings from '@lucide/svelte/icons/settings';
import Camera from '@lucide/svelte/icons/camera';
import Layers from '@lucide/svelte/icons/layers';
import Component from '@lucide/svelte/icons/component';
import History from '@lucide/svelte/icons/history';
import type { Component as SvelteComponent } from 'svelte';
import type { NavEntry } from '$lib/shell-nav';

export const NAV_ICONS: Record<NavEntry['icon'], SvelteComponent<{ size?: number }>> = {
  images: Images,
  palette: Palette,
  'users-round': UsersRound,
  megaphone: Megaphone,
  settings: Settings,
  camera: Camera,
  layers: Layers,
  components: Component,
  history: History
};
