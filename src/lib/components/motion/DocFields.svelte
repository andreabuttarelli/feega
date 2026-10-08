<script lang="ts">
  import type { AssetKind } from '$lib/motion/components';
  import type { MotionDoc } from '$lib/motion/doc';
  import { applyValues, fieldValues } from '$lib/motion/template/fields';
  import type { TemplateFieldValue } from '$lib/motion/template/library';
  import FieldForm from './FieldForm.svelte';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let { doc, assets, onchange }: { doc: MotionDoc; assets: Asset[]; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const fields = $derived(fieldValues(doc).filter((f) => !f.missing).map((f) => ({ ...f, docKey: f.key })));

  const setValue = (f: TemplateFieldValue, raw: string) => applyValues(doc, { [f.key]: raw });
</script>

{#if fields.length}
  <section class="fields" data-testid="doc-fields">
    <header>Fields</header>
    <FieldForm {doc} {fields} {assets} {setValue} {onchange} />
  </section>
{/if}

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-bottom: 1px solid var(--ui-line);
  }

  header {
    font-weight: 500;
  }
</style>
