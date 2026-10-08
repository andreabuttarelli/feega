<script lang="ts">
  import Unlink from '@lucide/svelte/icons/unlink';
  import type { AssetKind } from '$lib/motion/components';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { detachTemplate, instanceComp, setTemplateValues, templateFields, type TemplateFieldValue } from '$lib/motion/template/library';
  import FieldForm from './FieldForm.svelte';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let { doc, clip, assets, onchange }: { doc: MotionDoc; clip: MotionClip; assets: Asset[]; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let error = $state('');

  const mark = $derived(instanceComp(doc, clip.id)?.comp.template ?? null);
  const fields = $derived(templateFields(doc, clip.id));

  const setValue = (f: TemplateFieldValue, raw: string) => setTemplateValues(doc, clip.id, { [f.key]: raw });

  function detach() {
    const result = detachTemplate(doc, clip.id);
    error = result.ok ? '' : result.error;
    if (result.ok) {
      onchange(result.doc, 'Detached template');
    }
  }
</script>

{#if mark}
  <section class="template" data-testid="template-inspector">
    <header>
      <span class="name">{mark.name}</span>
      <button type="button" class="detach" data-testid="detach-template" title="Detach to edit its structure" onclick={detach}><Unlink size={12} /> Detach</button>
    </header>

    <FieldForm {doc} {fields} {assets} {setValue} {onchange} />

    {#if error}<p class="error">{error}</p>{/if}
  </section>
{/if}

<style>
  .template {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .name {
    font-weight: 500;
  }

  .detach {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    padding: 2px 6px;
    font-size: 11px;
  }

  .error {
    color: var(--ui-ink-2);
  }
</style>
