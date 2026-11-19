<script lang="ts">
  import NumberField from '@feega/properties-panel/NumberField.svelte';
  import InspectorSection from '@feega/properties-panel/InspectorSection.svelte';
  import { Control, ROWS, type Row } from './controls';
  import { roleOf, sectionsOf } from './roles';
  import { hexOf } from './colour';
  import type { Pick } from '../messages';

  let { pick, onpreview, onchange }: { pick: Pick; onpreview: (row: Row, value: string) => void; onchange: (row: Row, value: string) => void } = $props();

  let closed = $state<Record<string, boolean>>({});

  const rowsOf = (section: string) => ROWS.filter((r) => r.section === section);
  const sections = $derived(sectionsOf(roleOf({ tag: pick.tag, ownText: pick.ownText, elements: pick.elements, display: pick.styles.display ?? '' })));
</script>

<div class="properties" data-testid="properties">
  {#each sections as section (section)}
    <InspectorSection title={section} section={section} open={!closed[section]} ontoggle={() => (closed[section] = !closed[section])}>
      <div class="grid">
        {#each rowsOf(section) as row (row.name)}
          {#if row.control === Control.Number}
            <NumberField label={row.label} name={row.name} value={row.read(pick.styles)} range={row.range} unit={row.unit} onchange={(v) => onchange(row, String(v))} />
          {:else if row.control === Control.Colour}
            <label class="colour" data-field={row.name}>
              <input type="color" value={hexOf(row.read(pick.styles))} oninput={(e) => onpreview(row, e.currentTarget.value)} onchange={(e) => onchange(row, e.currentTarget.value)} />
              <span>{row.label}</span>
              <code>{hexOf(row.read(pick.styles))}</code>
            </label>
          {:else}
            <label class="choice" data-field={row.name}>
              <span>{row.label}</span>
              <select value={row.read(pick.styles)} onchange={(e) => onchange(row, e.currentTarget.value)}>
                <option value="" disabled>—</option>
                {#each row.choices as choice (choice)}<option value={choice}>{choice}</option>{/each}
              </select>
            </label>
          {/if}
        {/each}
      </div>
    </InspectorSection>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ui-space-2);
    padding: 0 var(--ui-space-4) var(--ui-space-4);
  }

  .colour,
  .choice {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    grid-column: span 2;
    height: var(--ui-row);
    font-size: var(--ui-text-sm);
    color: var(--ui-text-2);
  }

  .colour input {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-xs);
    background: none;
  }

  .colour code {
    margin-left: auto;
    color: var(--ui-text);
  }

  .choice span {
    width: 64px;
  }

  .choice select {
    flex: 1;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }
</style>
