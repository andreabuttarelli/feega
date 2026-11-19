<script lang="ts">
  import NumberField from '@feega/properties-panel/NumberField.svelte';
  import InspectorSection from '@feega/properties-panel/InspectorSection.svelte';
  import { Control, GROUP_MODES, Group, ROWS, SideMode, type Hint, type NumberRow, type Row } from './controls';
  import { MIXED, type Shared } from '@feega/properties-panel/mixed';
  import { roleOf, sectionsOf } from './roles';
  import { paintOf } from './colour';
  import LengthField from './LengthField.svelte';
  import ShadowList from './ShadowList.svelte';
  import FillList from './FillList.svelte';

  const DEFAULT_PAINT = '#d9d9d9';
  import type { Pick } from '../messages';

  let { pick, onpreview, onchange, onhint }: { pick: Pick; onpreview: (row: Row, value: string) => void; onchange: (row: Row, value: string) => void; onhint: (hint: Hint | null) => void } = $props();

  let closed = $state<Record<string, boolean>>({});
  let modes = $state<Record<string, SideMode>>({ [Group.Padding]: SideMode.All, [Group.Margin]: SideMode.All, [Group.Radius]: SideMode.All });

  const MODE_LABEL: Record<SideMode, string> = { [SideMode.All]: 'All sides', [SideMode.Axis]: 'Horizontal and vertical', [SideMode.Each]: 'Each side' };
  const MODE_ICON: Record<SideMode, string> = { [SideMode.All]: '▢', [SideMode.Axis]: '⇹', [SideMode.Each]: '⊞' };

  const context = $derived({ rem: pick.rem, em: parseFloat(pick.styles['font-size'] ?? '16') || 16, parent: pick.parentWidth, viewport: { w: pick.viewport, h: window.innerHeight } });

  const rowsOf = (section: string) => ROWS.filter((r) => r.section === section && !r.hidden && (!r.group || r.mode === modes[r.group]));
  const FILL_COLOUR = ROWS.find((r) => r.name === 'fill')!;
  const groupsOf = (section: string) => [...new Set(ROWS.filter((r) => r.section === section && r.group).map((r) => r.group!))];

  function shared(row: NumberRow): Shared<number> {
    if (!row.group || row.mode === SideMode.Each) {
      return row.read(pick.styles);
    }
    const prefix = row.group === Group.Radius ? 'border-' : `${row.group}-`;
    const suffix = row.group === Group.Radius ? '-radius' : '';
    const values = row.sides!.map((side) => Math.round(parseFloat(pick.styles[`${prefix}${side}${suffix}`] ?? '0') || 0));
    return values.every((v) => v === values[0]) ? values[0] : MIXED;
  }
  const sections = $derived(sectionsOf(roleOf({ tag: pick.tag, ownText: pick.ownText, elements: pick.elements, display: pick.styles.display ?? '' })));
</script>

<div class="properties" data-testid="properties">
  {#each sections as section (section)}
    <InspectorSection title={section} section={section} open={!closed[section]} ontoggle={() => (closed[section] = !closed[section])} actions={groupsOf(section).length ? sideModes : undefined}>
      {#snippet sideModes()}
        {#each groupsOf(section) as group (group)}
          <div class="modes" role="radiogroup" aria-label={`${group} sides`}>
            {#each GROUP_MODES[group] as mode (mode)}
              <button type="button" class:on={modes[group] === mode} title={`${group}: ${MODE_LABEL[mode]}`} aria-label={`${group}: ${MODE_LABEL[mode]}`} onclick={() => (modes[group] = mode)} data-mode={`${group}-${mode}`}>{MODE_ICON[mode]}</button>
            {/each}
          </div>
        {/each}
      {/snippet}
      <div class="grid">
        {#each rowsOf(section) as row (row.name)}
          {#if row.control === Control.Number}
            <div class="cell" role="presentation" onpointerenter={() => row.group && onhint({ group: row.group, sides: row.sides ?? [] })} onpointerleave={() => onhint(null)}>
              {#if row.units}
                <LengthField label={row.label} name={row.name} px={shared(row)} range={row.range} units={row.units} context={context} onchange={(css) => onchange(row, css)} />
              {:else}
                <NumberField label={row.label} name={row.name} value={shared(row)} range={row.range} unit={row.unit} onchange={(v) => onchange(row, String(v))} />
              {/if}
            </div>
          {:else if row.control === Control.Colour}
            {@const paint = paintOf(row.read(pick.styles))}
            <label class="colour" data-field={row.name}>
              {#if paint}
                <input type="color" value={paint} oninput={(e) => onpreview(row, e.currentTarget.value)} onchange={(e) => onchange(row, e.currentTarget.value)} />
                <span>{row.label}</span>
                <code>{paint}</code>
              {:else}
                <span>{row.label}</span>
                <span class="none">None</span>
                <button type="button" class="add" title={`Add ${row.label.toLowerCase()}`} aria-label={`Add ${row.label.toLowerCase()}`} onclick={() => onchange(row, DEFAULT_PAINT)}>+</button>
              {/if}
            </label>
          {:else if row.control === Control.Fills}
            <FillList image={row.read(pick.styles)} colour={FILL_COLOUR.read(pick.styles) as string} onchange={(css) => (onchange(row, css['background-image']), onchange(FILL_COLOUR, css['background-color']))} />
          {:else if row.control === Control.Shadows}
            <ShadowList css={row.read(pick.styles)} label={row.label} onchange={(css) => onchange(row, css)} />
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
  .modes {
    display: flex;
    gap: 2px;
  }

  .modes button {
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .modes button.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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

  .none {
    margin-left: auto;
    color: var(--ui-text-3);
  }

  .add {
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    cursor: pointer;
  }

  .colour code {
    margin-left: auto;
    color: var(--ui-text);
  }

  .choice span {
    width: 64px;
    flex: none;
  }

  .choice select {
    min-width: 0;
  }

  .cell {
    min-width: 0;
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
