<script lang="ts">
  import Diamond from '@lucide/svelte/icons/diamond';
  import type { MotionDoc } from '$lib/motion/doc';
  import { instanceOf, instanceTexts, overrideInstance } from '$lib/motion/main-component';
  import { Action, type ActionId } from '$lib/motion/actions';
  import { addVariant, pickVariant, swapInstance, variantProps } from '$lib/motion/variants';

  let { doc, clipId, onchange, onrun }: { doc: MotionDoc; clipId: string; onchange: (doc: MotionDoc, summary: string) => void; onrun: (id: ActionId) => void } = $props();

  const instance = $derived(instanceOf(doc, clipId));
  const texts = $derived(instanceTexts(doc, clipId));
  const props = $derived(instance ? variantProps(doc, instance.compId) : {});
  const mains = $derived(Object.entries(doc.comps).filter(([, c]) => c.component));
  const VARIANT_KEY = 'Variant';

  function applied(result: ReturnType<typeof swapInstance>, summary: string) {
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  function newVariant() {
    if (!instance) {
      return;
    }
    const key = Object.keys(props)[0] ?? VARIANT_KEY;
    const count = (props[key]?.length ?? 1) + 1;
    applied(addVariant(doc, instance.compId, { [key]: `${VARIANT_KEY} ${count}` }, () => crypto.randomUUID().slice(0, 8)), 'Added a variant');
  }

  function retext(innerId: string, text: string) {
    const result = overrideInstance(doc, clipId, innerId, { text });
    if (result.ok) {
      onchange(result.doc, 'Overrode instance text');
    }
  }
</script>

{#if instance}
  <section class="instance" data-testid="instance-inspector">
    <header>
      <Diamond size={14} />
      <span class="name">{instance.comp.component?.name}</span>
    </header>
    {#each texts as t (t.innerId)}
      <label class="field">
        <span class:overridden={t.overridden}>{t.main}</span>
        <input type="text" value={t.value} data-testid="instance-text" onchange={(e) => retext(t.innerId, e.currentTarget.value)} />
      </label>
    {/each}
    {#each Object.entries(props) as [key, values] (key)}
      <label class="field">
        <span>{key}</span>
        <select data-testid="instance-variant" value={instance.comp.component?.variant?.[key]} onchange={(e) => applied(pickVariant(doc, clipId, key, e.currentTarget.value), 'Changed variant')}>
          {#each values as v (v)}<option value={v}>{v}</option>{/each}
        </select>
      </label>
    {/each}
    <label class="field">
      <span>Swap</span>
      <select data-testid="instance-swap" value={instance.compId} onchange={(e) => applied(swapInstance(doc, clipId, e.currentTarget.value), 'Swapped instance')}>
        {#each mains as [id, comp] (id)}<option value={id}>{comp.component?.name}{comp.component?.variant ? ` · ${Object.values(comp.component.variant).join(', ')}` : ''}</option>{/each}
      </select>
    </label>
    <div class="actions">
      <button type="button" data-testid="instance-add-variant" onclick={newVariant}>Add variant</button>
      <button type="button" data-testid="instance-reset" disabled={!Object.keys(instance.overrides).length} onclick={() => onrun(Action.ResetInstance)}>Reset overrides</button>
      <button type="button" data-testid="instance-detach" onclick={() => onrun(Action.DetachInstance)}>Detach</button>
    </div>
  </section>
{/if}

<style>
  .instance {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-bottom: 1px solid var(--ui-line);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    color: #9747ff;
    font-weight: 600;
    font-size: var(--ui-type-caption);
  }

  .name {
    color: var(--ui-text);
  }

  .field {
    display: grid;
    grid-template-columns: 1fr 2fr;
    align-items: center;
    gap: var(--ui-space-2);
    font-size: var(--ui-type-caption);
    color: var(--ui-text-secondary);
  }

  .field span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overridden {
    color: #9747ff;
  }

  input,
  select {
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
  }

  .actions {
    display: flex;
    gap: var(--ui-space-2);
  }

  .actions button {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    font-size: var(--ui-type-caption);
    cursor: pointer;
  }
</style>
