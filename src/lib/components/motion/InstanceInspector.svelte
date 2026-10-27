<script lang="ts">
  import ColorField from './ColorField.svelte';
  import { ColourDisplay } from '$lib/motion/colour-field';
  import Diamond from '@lucide/svelte/icons/diamond';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { Paint, instanceElements, instanceOf, instanceTexts, overrideInstance, recolorInstance, resetOverride } from '$lib/motion/main-component';
  import { Action, type ActionId } from '$lib/motion/actions';
  import { defineProperty, exposable, instanceProperties, removeProperty, resetProperty, setProperty, type Exposure } from '$lib/motion/component-properties';
  import { PropertyKind, type PropertyDef } from '@feega/motion-core/motion/property-resolve';
  import { addVariant, pickVariant, swapInstance, variantProps } from '$lib/motion/variants';

  let { doc, clipId, onchange, onrun }: { doc: MotionDoc; clipId: string; onchange: (doc: MotionDoc, summary: string) => void; onrun: (id: ActionId) => void } = $props();

  const instance = $derived(instanceOf(doc, clipId));
  const texts = $derived(instanceTexts(doc, clipId));
  const elements = $derived(instanceElements(doc, clipId));
  const images = $derived(doc.assets.filter((a) => a.kind === 'image'));
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

  function change(result: ReturnType<typeof overrideInstance>, summary: string) {
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  const reset = (innerId: string, key: string) => change(resetOverride(doc, clipId, innerId, key), 'Reset an override');
  const recolor = (innerId: string, paint: Paint, color: string) => change(recolorInstance(doc, clipId, innerId, paint, color), 'Overrode instance colour');
  const override = (innerId: string, props: Record<string, unknown>) => change(overrideInstance(doc, clipId, innerId, props), 'Overrode instance property');

  const properties = $derived(instanceProperties(doc, clipId));

  const expose = (innerId: string, name: string, exposure: Exposure) => {
    if (instance) {
      change(defineProperty(doc, instance.compId, name, { ...exposure.def, target: innerId } as PropertyDef), 'Exposed a property');
    }
  };
  const setProp = (key: string, value: string | boolean) => change(setProperty(doc, clipId, key, value), 'Changed a property');
  const resetProp = (key: string) => change(resetProperty(doc, clipId, key), 'Reset a property');
  const dropProp = (key: string) => instance && change(removeProperty(doc, instance.compId, key), 'Removed a property');

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
    {#each properties as p (p.key)}
      <label class="field" data-testid="instance-property" data-key={p.key}>
        <span class:overridden={p.overridden}>{p.key}</span>
        {#if p.control === PropertyKind.Boolean}
          <input type="checkbox" checked={p.value === true} data-testid="instance-property-boolean" onchange={(e) => setProp(p.key, e.currentTarget.checked)} />
        {:else if p.control === PropertyKind.Swap}
          <select value={String(p.value)} data-testid="instance-property-swap" onchange={(e) => setProp(p.key, e.currentTarget.value)}>
            {#each mains as [id, comp] (id)}<option value={id}>{comp.component?.name}</option>{/each}
          </select>
        {:else}
          <input type="text" value={String(p.value)} data-testid="instance-property-text" onchange={(e) => setProp(p.key, e.currentTarget.value)} />
        {/if}
        {#if p.overridden}<button type="button" class="reset" data-testid="instance-property-reset" onclick={() => resetProp(p.key)}>Reset</button>{:else}<button type="button" class="reset" data-testid="instance-property-remove" onclick={() => dropProp(p.key)}>Remove</button>{/if}
      </label>
    {/each}
    {#each texts as t (t.innerId)}
      <label class="field">
        <span class:overridden={t.overridden}>{t.main}</span>
        <input type="text" value={t.value} data-testid="instance-text" onchange={(e) => retext(t.innerId, e.currentTarget.value)} />
        {#if t.overridden}<button type="button" class="reset" data-testid="instance-reset-text" onclick={() => reset(t.innerId, 'text')}>Reset</button>{/if}
      </label>
    {/each}
    {#each elements as el, i (el.innerId)}
      <div class="element" data-testid="instance-element" data-inner={el.innerId}>
        <span class="label">{el.component} {i + 1}</span>
        {#if el.fill}
          <label class="field">
            <span class:overridden={el.overridden.includes('fills')}>Fill</span>
            <span data-testid="instance-fill"><ColorField name="Fill" display={ColourDisplay.Chip} value={el.fill} onchange={(v) => recolor(el.innerId, Paint.Fill, v)} /></span>
            {#if el.overridden.includes('fills')}<button type="button" class="reset" data-testid="instance-reset-fills" onclick={() => reset(el.innerId, 'fills')}>Reset</button>{/if}
          </label>
        {/if}
        {#if el.stroke}
          <label class="field">
            <span class:overridden={el.overridden.includes('strokes')}>Stroke</span>
            <span data-testid="instance-stroke"><ColorField name="Stroke" display={ColourDisplay.Chip} value={el.stroke} onchange={(v) => recolor(el.innerId, Paint.Stroke, v)} /></span>
            {#if el.overridden.includes('strokes')}<button type="button" class="reset" data-testid="instance-reset-strokes" onclick={() => reset(el.innerId, 'strokes')}>Reset</button>{/if}
          </label>
        {/if}
        {#if el.assetId !== null}
          <label class="field">
            <span class:overridden={el.overridden.includes('assetId')}>Image</span>
            <select value={el.assetId} data-testid="instance-image" onchange={(e) => override(el.innerId, { assetId: e.currentTarget.value })}>
              {#each images as a (a.id)}<option value={a.id}>{a.label ?? a.id}</option>{/each}
            </select>
            {#if el.overridden.includes('assetId')}<button type="button" class="reset" data-testid="instance-reset-assetId" onclick={() => reset(el.innerId, 'assetId')}>Reset</button>{/if}
          </label>
        {/if}
        <label class="field">
          <span class:overridden={el.overridden.includes('hidden')}>Visible</span>
          <input type="checkbox" checked={!el.hidden} data-testid="instance-visible" onchange={(e) => override(el.innerId, { hidden: !e.currentTarget.checked })} />
          {#if el.overridden.includes('hidden')}<button type="button" class="reset" data-testid="instance-reset-hidden" onclick={() => reset(el.innerId, 'hidden')}>Reset</button>{/if}
        </label>
        <div class="expose">
          {#each exposable(doc, instance.compId, el.innerId) as ex (ex.label)}
            <button type="button" class="reset" data-testid="instance-expose" onclick={() => expose(el.innerId, `${el.component} ${i + 1} ${ex.label}`, ex)}>◇ {ex.label}</button>
          {/each}
        </div>
        {#if el.effects > 0 || el.overridden.includes('effects')}
          <label class="field">
            <span class:overridden={el.overridden.includes('effects')}>Effects</span>
            <input type="checkbox" checked={el.effects > 0} data-testid="instance-effects" onchange={(e) => (e.currentTarget.checked ? reset(el.innerId, 'effects') : override(el.innerId, { effects: [] }))} />
            {#if el.overridden.includes('effects')}<button type="button" class="reset" data-testid="instance-reset-effects" onclick={() => reset(el.innerId, 'effects')}>Reset</button>{/if}
          </label>
        {/if}
      </div>
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
      <button type="button" data-testid="instance-push" disabled={!Object.keys(instance.overrides).length} onclick={() => onrun(Action.PushInstance)}>Push to main</button>
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

  .element {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
  }

  .label {
    font-size: var(--ui-type-caption);
    font-weight: 600;
    color: var(--ui-text);
  }

  .expose {
    display: flex;
    flex-wrap: wrap;
  }

  .reset {
    padding: 0 6px;
    border: 0;
    background: transparent;
    color: #9747ff;
    font-size: var(--ui-type-caption);
    cursor: pointer;
  }

  .field {
    display: grid;
    grid-template-columns: 1fr 2fr auto;
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
