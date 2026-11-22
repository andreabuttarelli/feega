<script lang="ts">
  import { Combobox } from 'bits-ui';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import type { FontChoice } from '../messages';
  import { GOOGLE_FONTS, previewUrl } from './fonts';

  const MAX_SHOWN = 60;

  let { family, project = [], system = [], placeholder = 'Font', onpick }: { family: string; project?: string[]; system?: string[]; placeholder?: string; onpick: (font: FontChoice) => void } = $props();

  let query = $state('');
  let open = $state(false);
  const match = (name: string) => name.toLowerCase().includes(query.trim().toLowerCase());
  const inProject = $derived(project.filter(match));
  const installed = $derived(system.filter((name) => match(name) && !project.includes(name)));
  const google = $derived(GOOGLE_FONTS.filter((f) => match(f.family) && !project.includes(f.family) && !system.includes(f.family)).slice(0, MAX_SHOWN));

  $effect(() => {
    if (!open || !google.length) {
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = previewUrl(google.map((f) => f.family));
    document.head.append(link);
    return () => link.remove();
  });

  function choose(value: string | undefined) {
    if (!value) {
      return;
    }
    onpick({ family: value, google: !project.includes(value) && !system.includes(value) });
    query = '';
  }
</script>

<Combobox.Root type="single" bind:open value={family} onValueChange={choose}>
  <div class="font-field">
    <Combobox.Input class="font-input" aria-label="Font family" placeholder={family || placeholder} oninput={(e) => (query = e.currentTarget.value)} defaultValue={family} />
    <Combobox.Trigger class="font-trigger" aria-label="Show fonts"><ChevronDown size={12} /></Combobox.Trigger>
  </div>
  <Combobox.Portal>
    <Combobox.Content class="font-menu" sideOffset={4} collisionPadding={8}>
      {#if inProject.length}
        <div class="group-label">In this project</div>
        {#each inProject as name (name)}
          <Combobox.Item class="font-item" value={name} label={name}><span style={`font-family: '${name}'`}>{name}</span></Combobox.Item>
        {/each}
      {/if}
      {#if installed.length}
        <div class="group-label">Installed</div>
        {#each installed as name (name)}
          <Combobox.Item class="font-item" value={name} label={name}><span style={`font-family: '${name}'`}>{name}</span></Combobox.Item>
        {/each}
      {/if}
      <div class="group-label">Google Fonts</div>
      {#each google as f (f.family)}
        <Combobox.Item class="font-item" value={f.family} label={f.family}>
          <span style={`font-family: '${f.family}', ${f.category}`}>{f.family}</span>
          <span class="category">{f.category}</span>
        </Combobox.Item>
      {/each}
      {#if !inProject.length && !installed.length && !google.length}<div class="empty">No font named “{query}”</div>{/if}
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>

<style>
  .font-field {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 28px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .font-field :global(.font-input) {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 8px;
    border: 0;
    background: none;
    box-shadow: none !important;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    outline: none;
  }

  .font-field :global(.font-trigger) {
    display: grid;
    place-items: center;
    width: 24px;
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text-3);
    cursor: pointer;
  }

  :global(.font-menu) {
    z-index: 20;
    width: 260px;
    max-height: 360px;
    padding: 4px;
    overflow-y: auto;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    color: var(--ui-text);
  }

  :global(.font-menu) .group-label {
    padding: 8px 8px 4px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  :global(.font-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-radius: var(--ui-radius-sm);
    font-size: 14px;
    cursor: pointer;
  }

  :global(.font-item[data-highlighted]) {
    background: var(--ui-input);
  }

  :global(.font-menu) .category {
    color: var(--ui-text-3);
    font-family: var(--vscode-font-family, system-ui);
    font-size: var(--ui-text-xs);
  }

  :global(.font-menu) .empty {
    padding: 8px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-sm);
  }
</style>
