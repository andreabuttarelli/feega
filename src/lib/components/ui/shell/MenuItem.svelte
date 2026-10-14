<script lang="ts">
  import type { Component } from 'svelte';
  import { DropdownMenu } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import Kbd from './Kbd.svelte';
  import { MENU_ITEM, MENU_TONE, MenuTone } from './styles';

  let {
    label,
    icon: Icon,
    shortcut,
    tone = MenuTone.Default,
    class: className,
    ...rest
  }: Omit<DropdownMenu.ItemProps, 'children'> & {
    label: string;
    icon?: Component;
    shortcut?: string;
    tone?: MenuTone;
  } = $props();
</script>

<DropdownMenu.Item {...rest} data-slot="menu-item" class={cn(MENU_ITEM, MENU_TONE[tone], className)}>
  {#if Icon}
    <Icon aria-hidden="true" />
  {/if}
  <span class="min-w-0 flex-1 truncate">{label}</span>
  {#if shortcut}
    <Kbd {shortcut} class="text-ui-text-3" />
  {/if}
</DropdownMenu.Item>
