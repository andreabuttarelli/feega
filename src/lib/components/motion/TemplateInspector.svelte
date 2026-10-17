<script lang="ts">
  import Unlink from '@lucide/svelte/icons/unlink';
  import type { AssetKind } from '$lib/motion/components';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { detachTemplate, instanceComp, keyFieldsOf, setTemplateValues, templateFields, type TemplateFieldValue } from '$lib/motion/template/library';
  import { FieldLayout, splitFields } from '$lib/motion/template/key-fields';
  import FieldForm from './FieldForm.svelte';
  import type { MediaUploader } from './media-upload';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let { doc, clip, assets, upload = null, onchange }: { doc: MotionDoc; clip: MotionClip; assets: Asset[]; upload?: MediaUploader | null; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let error = $state('');

  const mark = $derived(instanceComp(doc, clip.id)?.comp.template ?? null);
  const fields = $derived(templateFields(doc, clip.id));
  const split = $derived(splitFields(fields, keyFieldsOf(doc, clip.id)));

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

    {#if split.key.length}
      <div class="key" data-testid="key-fields"><FieldForm {doc} fields={split.key} {assets} {upload} {setValue} {onchange} layout={FieldLayout.Flat} /></div>
    {/if}

    {#if split.advanced.length}
      <details class="advanced" data-testid="advanced-fields">
        <summary>Advanced</summary>
        <FieldForm {doc} fields={split.advanced} {assets} {upload} {setValue} {onchange} />
      </details>
    {/if}

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

  .key,
  .advanced {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .advanced {
    border-top: 1px solid var(--ui-line);
    padding-top: 10px;
  }

  summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--ui-ink-2);
  }

  .error {
    color: var(--ui-ink-2);
  }
</style>
