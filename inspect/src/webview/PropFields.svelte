<script lang="ts">
  import { FieldKind, type Field } from './component-props';

  type Props = { fields: Field[]; onedit: (name: string, text: string, kind: FieldKind) => void };

  let { fields, onedit }: Props = $props();

  const valueOf = (e: Event) => (e.currentTarget as HTMLInputElement).value;
</script>

<div class="fields" data-testid="prop-fields">
  {#each fields as field (field.name)}
    <label class="field" class:edited={field.edited}>
      <span class="name">{field.name} =</span>
      {#if field.kind === FieldKind.Toggle}
        <input type="checkbox" checked={field.value === 'true'} data-testid="prop-field" data-name={field.name} onchange={(e) => onedit(field.name, String((e.currentTarget as HTMLInputElement).checked), field.kind)} />
      {:else}
        <input type="text" value={field.value} placeholder={field.name} spellcheck="false" data-testid="prop-field" data-name={field.name} onchange={(e) => onedit(field.name, valueOf(e), field.kind)} />
      {/if}
    </label>
  {/each}
</div>

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .name {
    flex: none;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  input[type='text'] {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    padding: 2px 6px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  .edited input[type='text'] {
    border-color: var(--ui-accent);
  }
</style>
