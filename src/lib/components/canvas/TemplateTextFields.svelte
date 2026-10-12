<script lang="ts">
  import type { CompositionNode, CompositionTemplate } from '$lib/canvas/composition-node';
  import { FieldType } from '$lib/motion/template/field-model';
  import { splitFields, type KeyFields } from '$lib/motion/template/key-fields';
  import { templateFields, type Instance } from '$lib/motion/template/library';

  let { instance, template, keyFields, onpatch }: { instance: Instance; template: CompositionTemplate; keyFields: KeyFields; onpatch: (patch: Partial<CompositionNode>) => void } = $props();

  const texts = $derived(splitFields(templateFields(instance.doc, instance.clipId), keyFields).key.filter((f) => f.type === FieldType.Text));

  const typed = (key: string, e: Event) => onpatch({ template: { ...template, values: { ...template.values, [key]: (e.currentTarget as HTMLInputElement).value } } });
</script>

{#if texts.length}
  <details class="fields-panel nodrag" data-testid="composition-fields" open>
    <summary>Text</summary>
    {#each texts as field (field.key)}
      <label>
        <span>{field.label}</span>
        <input type="text" value={String(field.value ?? '')} onchange={(e) => typed(field.key, e)} />
      </label>
    {/each}
  </details>
{/if}

<style>
  .fields-panel {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 4px 6px;
    max-width: calc(100% - 16px);
    max-height: 60%;
    overflow: auto;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    font-size: 11px;
    color: var(--ink, #1d1d1f);
  }
  label {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-top: 4px;
  }
  input {
    min-width: 0;
    flex: 1;
    font: inherit;
  }
</style>
