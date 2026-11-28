<script lang="ts">
  import { TEXT_TAGS } from '@feega/live-edit/retag';
  import { ToHost } from '../messages';
  import { toHost } from './host';

  let { at, tag }: { at: string; tag: string } = $props();
</script>

<select aria-label="Tag" data-field="tag" value={tag} onchange={(e) => toHost({ kind: ToHost.Retag, at, to: e.currentTarget.value })}>
  {#each TEXT_TAGS as option (option)}
    <option value={option}>{option}</option>
  {/each}
</select>

<style>
  select {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--ui-field-border);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  select:hover {
    border-color: var(--ui-field-border-hover);
  }
</style>
