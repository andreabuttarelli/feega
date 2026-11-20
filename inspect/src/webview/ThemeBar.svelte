<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Check from '@lucide/svelte/icons/check';
  import SunMoon from '@lucide/svelte/icons/sun-moon';
  import { DEFAULT_THEME, type Theme } from '@feega/live-edit/themes';

  type Props = { themes: Theme[]; choice: string; onchoose: (name: string) => void };

  let { themes, choice, onchoose }: Props = $props();
</script>

<div class="themes" data-testid="theme-bar">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class="trigger" aria-label="Theme" title="Theme the preview shows" data-choice={choice}>
      <SunMoon size={14} />
      <span class="name">{choice === DEFAULT_THEME ? 'Theme' : choice}</span>
      <ChevronDown size={12} />
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content class="dropdown-menu" sideOffset={4} align="end">
        {#each themes as theme (theme.name)}
          <DropdownMenu.Item class="dropdown-item" onSelect={() => onchoose(theme.name)} data-theme-item={theme.name}>
            <span class="check">{#if theme.name === choice}<Check size={12} />{/if}</span>{theme.name === DEFAULT_THEME ? 'Default' : theme.name}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>

<style>
  .themes :global(.trigger) {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .themes :global(.trigger:hover),
  .themes :global(.trigger[data-choice]:not([data-choice='default'])) {
    color: var(--ui-text);
  }

  .name {
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
