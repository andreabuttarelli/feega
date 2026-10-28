<script lang="ts">
  import { SegmentedControl } from '$lib/components/ui/shell';
  import { frameProperties } from './frame-properties.svelte';
  import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
  import { EditMode, modeSwitchShown } from '$lib/motion/edit-mode';

  let { session }: { session: FrameEditSession } = $props();

  const OPTIONS = [
    { value: EditMode.Design, label: 'Design' },
    { value: EditMode.Motion, label: 'Motion' }
  ];

  const doc = $derived(session.history.present);
  const choose = (value: string) => value !== session.mode && session.toggleMode();
</script>

<div class="row" data-testid="frame-mode-row">
  {#if modeSwitchShown(doc)}
    <div data-testid="frame-mode-switch" data-mode={session.mode}>
      <SegmentedControl label="Edit mode" options={OPTIONS} value={session.mode} onchange={choose} />
    </div>
  {/if}
  <button type="button" class="coder" aria-pressed={frameProperties.dev} title="⇧D" onclick={() => frameProperties.toggleDev?.()} data-testid="dev-toggle">Coder mode</button>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
    padding: var(--ui-space-2) var(--ui-space-4) 0;
  }

  .coder {
    margin-left: auto;
    padding: var(--ui-space-1) var(--ui-space-3);
    font: inherit;
    font-size: var(--ui-type-caption);
    color: var(--ui-text);
    background: var(--ui-input);
    border: 0;
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    white-space: nowrap;
  }

  .coder:hover {
    background: var(--ui-input-hover);
  }

  .coder[aria-pressed='true'] {
    background: var(--ui-raised);
  }
</style>
