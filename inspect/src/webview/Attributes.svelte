<script lang="ts">
  import { ToHost, type Palette, type Pick } from '../messages';
  import { attributeLabel, editableAttributes } from './attribute-fields';
  import ColourSwatch from './ColourSwatch.svelte';
  import { toHost } from './host';
  import { sourceText } from './page-bridge';

  let { pick, palette }: { pick: Pick; palette: Palette } = $props();

  const at = $derived(sourceText(pick.source));
  const fields = $derived(editableAttributes(pick.attributes));
  const variables = $derived(pick.variables ?? []);

  const write = (name: string, value: string) => toHost({ kind: ToHost.Attribute, at, name, value });
</script>

{#if fields.length || variables.length}
  <section data-section="Attributes" data-testid="attributes">
    <div class="head"><span class="title">Attributes</span></div>
    {#each fields as field (field.name)}
      <div class="row" data-row={field.name}>
        <span class="label" title={field.name}>{attributeLabel(field.name)}</span>
        <div class="control">
          {#if field.options.length}
            <select class="text" value={field.value} aria-label={field.name} data-field={field.name} onchange={(e) => write(field.name, e.currentTarget.value)}>
              {#each field.options as option (option)}
                <option value={option}>{option}</option>
              {/each}
            </select>
          {:else}
            <input type="text" class="text" value={field.value} aria-label={field.name} data-field={field.name} onchange={(e) => write(field.name, e.currentTarget.value)} />
          {/if}
        </div>
      </div>
    {/each}
    {#each variables as variable (variable.name)}
      <div class="row" data-row={variable.name}>
        <span class="label" title={variable.name}>{attributeLabel(variable.name)}</span>
        <div class="control">
          <ColourSwatch value={variable.value} {palette} label={variable.name} onchange={(chosen) => write(variable.name, chosen.css)} />
        </div>
      </div>
    {/each}
  </section>
{/if}

<style>
  section {
    --label-w: 72px;
    padding: 0 0 8px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  .head {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 12px;
  }

  .title {
    color: var(--ui-text);
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .row {
    display: grid;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 4px 12px;
  }

  .label {
    overflow: hidden;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .control {
    display: flex;
    min-width: 0;
  }

  .text {
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

  .text:hover {
    border-color: var(--ui-field-border-hover);
  }
</style>
