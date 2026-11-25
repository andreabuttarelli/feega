<script lang="ts">
  import Target from '@lucide/svelte/icons/target';
  import Layers from '@lucide/svelte/icons/layers';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import type { Impact, Source } from '../messages';
  import { ImpactIcon, impactView } from './impact-view';

  type Props = { impact: Impact | null; instances: number; detachable: boolean; detachReason?: string; ondetach: () => void; onopen: (at: Source) => void };

  let { impact, instances, detachable, detachReason, ondetach, onopen }: Props = $props();

  const ICONS = { [ImpactIcon.Target]: Target, [ImpactIcon.Layers]: Layers, [ImpactIcon.Alert]: TriangleAlert };

  const view = $derived(impactView(impact, instances));
  const Icon = $derived(ICONS[view.icon]);

  let listed = $state(false);
</script>

<div class="impact" data-testid="impact" data-tone={view.tone} role="status">
  <span class="line">
    {#if view.files.length}
      <button type="button" class="chip" data-action="impact-files" aria-expanded={listed} onclick={() => (listed = !listed)}><Icon size={12} />{view.label}</button>
    {:else}
      <span class="chip" title={view.hint}><Icon size={12} />{view.label}</span>
    {/if}
    {#if view.files.length && detachable}
      <button type="button" class="link" data-action="detach" disabled={Boolean(detachReason)} title={detachReason} onclick={ondetach}>Only this one</button>
    {/if}
  </span>
  {#if listed && view.files.length}
    <ul class="files" data-testid="impact-files">
      {#each view.files as site (site.file)}
        <li><button type="button" class="link" onclick={() => onopen({ file: site.file, line: site.line, col: 1 })}>{site.file}:{site.line}</button></li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .impact {
    margin: 2px 0 0;
    font-size: var(--ui-text-xs);
  }

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    white-space: nowrap;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    color: var(--ui-text-2);
  }

  button.chip {
    cursor: pointer;
  }

  [data-tone='shared'] .chip {
    color: var(--ui-accent);
  }

  [data-tone='unknown'] .chip {
    color: var(--ui-warning, var(--ui-text));
  }

  [data-tone='pending'] .chip {
    color: var(--ui-text-3);
  }

  .link {
    border: 0;
    background: none;
    padding: 0;
    color: var(--ui-accent);
    font: inherit;
    cursor: pointer;
  }

  .link:disabled {
    color: var(--ui-text-3);
    cursor: not-allowed;
  }

  .files {
    margin: 4px 0 0;
    padding: 4px 8px;
    list-style: none;
    max-height: 120px;
    overflow: auto;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }
</style>
