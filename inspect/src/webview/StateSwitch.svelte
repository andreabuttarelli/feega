<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Check from '@lucide/svelte/icons/check';
  import { Select } from 'bits-ui';
  import { ElementState } from '@feega/live-edit/element-state';
  import { stateLabel, switchStates } from './states';

  type Props = { tag: string; state: ElementState; authored: string[]; onstate: (state: ElementState) => void };

  let { tag, state, authored, onstate }: Props = $props();

  const states = $derived(switchStates(tag));
  const hasStyles = (s: ElementState) => authored.includes(s);
</script>

<div class="state-row" data-row="state">
  <span class="label">State</span>
  <div class="control">
    <Select.Root type="single" value={state} onValueChange={(v) => v && onstate(v as ElementState)} items={states.map((s) => ({ value: s, label: stateLabel(s) }))}>
      <Select.Trigger class="select" aria-label="Element state" data-field="state" data-state={state}>
        <span class="current" class:forced={state !== ElementState.Default}>{stateLabel(state)}</span>
        {#if hasStyles(state)}<span class="dot" aria-label="Has styles"></span>{/if}
        <span class="caret"><ChevronDown size={12} /></span>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content class="dropdown-menu" sideOffset={4}>
          {#each states as s (s)}
            <Select.Item class="dropdown-item" value={s} label={stateLabel(s)} data-state-item={s}>
              {#snippet children({ selected })}
                <span class="check">{#if selected}<Check size={12} />{/if}</span>{stateLabel(s)}{#if hasStyles(s)}<span class="dot trailing" aria-label="Has styles"></span>{/if}
              {/snippet}
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  </div>
</div>

<style>
  .state-row {
    display: grid;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-divider);
  }

  .current.forced {
    color: var(--ui-accent);
    font-weight: 600;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent);
  }

  .dot.trailing {
    margin-left: auto;
  }
</style>
