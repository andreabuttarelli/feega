<script lang="ts">
  import ColorField from './ColorField.svelte';
  import { ColourDisplay } from '$lib/motion/colour-field';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { DEFAULT_MODE, VARIABLE_NAME, VarType, type VarAlias, type VarLiteral } from '@feega/motion-core/motion/variables-model';
  import { activeModeOf, addMode, defineVariable, removeVariable, setActiveMode } from '$lib/motion/variables';
  import { adoptCollection } from '$lib/motion/variable-library';
  import { variableLibrary } from '$lib/canvas/variable-library.svelte';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  const TYPES = Object.values(VarType);
  const FRESH: Record<VarType, VarLiteral> = { [VarType.Colour]: '#000000', [VarType.Number]: 0, [VarType.String]: '', [VarType.Boolean]: false };
  const NEW_COLLECTION = 'Collection';
  const HEX = /^#[0-9a-fA-F]{6}$/;

  const collections = $derived(Object.entries(doc.variables ?? {}));
  const shared = $derived(Object.entries(variableLibrary.collections).filter(([group]) => !doc.variables?.[group]));
  let collection = $state(NEW_COLLECTION);
  let name = $state('');
  let type = $state<VarType>(VarType.Colour);
  let modeName = $state<Record<string, string>>({});

  const isAlias = (value: VarLiteral | VarAlias): value is VarAlias => typeof value === 'object';

  function edited(result: OpResult, summary: string, group: string) {
    onchange(result, summary);
    const collection = result.ok ? result.doc.variables?.[group] : undefined;
    if (collection) {
      variableLibrary.push(group, collection);
    }
  }

  function removed(group: string, variable: string) {
    onchange(removeVariable(doc, group, variable), `Removed ${group}/${variable}`);
    variableLibrary.remove(group, variable);
  }

  function addVariable() {
    const trimmed = name.trim();
    if (!VARIABLE_NAME.test(trimmed)) {
      return;
    }
    const modes = doc.variables?.[collection]?.modes ?? [DEFAULT_MODE];
    const values = Object.fromEntries(modes.map((m) => [m, FRESH[type]]));
    edited(defineVariable(doc, collection, trimmed, { type, values }), `Added the ${collection}/${trimmed} variable`, collection);
    name = '';
  }

  function setValue(group: string, variable: string, kind: VarType, values: Record<string, VarLiteral | VarAlias>, mode: string, value: VarLiteral) {
    edited(defineVariable(doc, group, variable, { type: kind, values: { ...values, [mode]: value } }), `Changed ${group}/${variable}`, group);
  }

  function newMode(group: string) {
    const trimmed = (modeName[group] ?? '').trim();
    if (!VARIABLE_NAME.test(trimmed)) {
      return;
    }
    edited(addMode(doc, group, trimmed), `Added the ${trimmed} mode to ${group}`, group);
    modeName = { ...modeName, [group]: '' };
  }

  const colourValue = (value: VarLiteral) => (typeof value === 'string' && HEX.test(value) ? value : '#000000');
</script>

<section class="variables" data-testid="variables-library">
  <header>Variables</header>
  {#each collections as [group, c] (group)}
    <div class="collection" data-testid="variable-collection" data-collection={group}>
      <div class="row">
        <strong>{group}</strong>
        <select aria-label={`${group} mode`} data-testid={`variable-mode-${group}`} value={activeModeOf(doc, group)} onchange={(e) => onchange(setActiveMode(doc, group, e.currentTarget.value), `${group} mode ${e.currentTarget.value}`)}>
          {#each c.modes as m (m)}<option value={m}>{m}</option>{/each}
        </select>
      </div>
      <div class="row">
        <input type="text" placeholder="New mode" aria-label={`New mode of ${group}`} data-testid={`variable-new-mode-${group}`} bind:value={modeName[group]} />
        <button type="button" data-testid={`variable-add-mode-${group}`} onclick={() => newMode(group)}>Add mode</button>
      </div>
      {#each Object.entries(c.vars) as [variable, v] (variable)}
        <div class="var" data-testid="variable-row" data-variable={`${group}/${variable}`}>
          <div class="row">
            <span>{variable} · {v.type}</span>
            <button type="button" aria-label={`Remove ${group}/${variable}`} data-testid={`variable-remove-${group}-${variable}`} onclick={() => removed(group, variable)}>Remove</button>
          </div>
          {#each c.modes as m (m)}
            {@const value = v.values[m]}
            <label class="row">
              <span>{m}</span>
              {#if isAlias(value)}
                <output>→ {value.alias}</output>
              {:else if v.type === VarType.Colour}
                <span data-testid={`variable-value-${group}-${variable}-${m}`}><ColorField name={`${variable} ${m}`} display={ColourDisplay.Chip} value={colourValue(value)} onchange={(c) => setValue(group, variable, v.type, v.values, m, c)} /></span>
              {:else if v.type === VarType.Number}
                <input type="number" step="any" data-testid={`variable-value-${group}-${variable}-${m}`} value={Number(value)} onchange={(e) => setValue(group, variable, v.type, v.values, m, Number(e.currentTarget.value))} />
              {:else if v.type === VarType.Boolean}
                <input type="checkbox" data-testid={`variable-value-${group}-${variable}-${m}`} checked={value === true} onchange={(e) => setValue(group, variable, v.type, v.values, m, e.currentTarget.checked)} />
              {:else}
                <input type="text" data-testid={`variable-value-${group}-${variable}-${m}`} value={String(value)} onchange={(e) => setValue(group, variable, v.type, v.values, m, e.currentTarget.value)} />
              {/if}
            </label>
          {/each}
        </div>
      {/each}
    </div>
  {/each}
  {#each shared as [group, c] (group)}
    <div class="row" data-testid="variable-shared" data-collection={group}>
      <span>{group} · canvas · {Object.keys(c.vars).length}</span>
      <button type="button" data-testid={`variable-use-${group}`} onclick={() => onchange(adoptCollection(doc, group, c), `Used the ${group} variables`)}>Use here</button>
    </div>
  {/each}
  <div class="add" data-testid="variable-add">
    <input type="text" aria-label="Collection" data-testid="variable-new-collection" bind:value={collection} />
    <input type="text" placeholder="Variable name" aria-label="Variable name" data-testid="variable-new-name" bind:value={name} />
    <select aria-label="Variable type" data-testid="variable-new-type" bind:value={type}>
      {#each TYPES as t (t)}<option value={t}>{t}</option>{/each}
    </select>
    <button type="button" data-testid="variable-add-button" onclick={addVariable}>Add variable</button>
  </div>
</section>

<style>
  .variables {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-type-caption);
  }

  header {
    font-weight: 600;
    color: var(--ui-text);
  }

  .collection,
  .var,
  .add {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
  }

  input[type='text'],
  input[type='number'],
  select {
    min-width: 0;
    box-sizing: border-box;
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
  }


  button {
    padding: 4px 8px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
  }
</style>
