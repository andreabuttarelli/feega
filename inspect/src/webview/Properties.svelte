<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Plus from '@lucide/svelte/icons/plus';
  import AlignLeft from '@lucide/svelte/icons/text-align-start';
  import AlignCenter from '@lucide/svelte/icons/text-align-center';
  import AlignRight from '@lucide/svelte/icons/text-align-end';
  import AlignJustify from '@lucide/svelte/icons/text-align-justify';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import { Popover, Select } from 'bits-ui';
  import { fillCss, imageChanged, parseFills, placementCss, type Fill } from './fills';
  import { isClipped, textFillCss, textFillPreviews, textFillRefusal, textFillWrites, textFillsOf } from './text-fill';
  import ColorPicker from './ColorPicker.svelte';
  import Check from '@lucide/svelte/icons/check';
  import Icon from './Icon.svelte';
  import FontPicker from './FontPicker.svelte';
  import TagPicker from './TagPicker.svelte';
  import { tagNote } from './tag-note';
  import { isTextTag } from '@feega/live-edit/retag';
  import MissingFont from './MissingFont.svelte';
  import { missingIn } from './missing-font';
  import { UI_ICON_SVG, UiIcon } from './ui-icons';
  import ScanLine from '@lucide/svelte/icons/square-dashed';
  import { MIXED, type Shared } from '@feega/properties-panel/mixed';
  import { CSS_ROWS, SIZE_LIMITS, limitsSet, shownRows, Control, Group, ROWS, Section, SideMode, GROUP_MODES, type Hint, type NumberRow, type Row } from './controls';
  import { Role, roleOf, sectionsOf } from './roles';
  import { paintOf } from './colour';
  import Field from './Field.svelte';
  import type { Scales } from '@feega/live-edit/theme-scales';
  import { scaleFor } from './snap';
  import { colourCheck, tokenPick } from './colour-theme';
  import { OFFSET_SIDES, OffsetSide, flipOffset, initialOffsets, offsetsFromHost, type Offsets } from './position-box';
  import { sourceText } from './page-bridge';
  import { wiringState } from './wiring-state.svelte';
  import SectionHead from './SectionHead.svelte';
  import ShadowList from './ShadowList.svelte';
  import FillList from './FillList.svelte';
  import IconActions from './IconActions.svelte';
  import Link from '@lucide/svelte/icons/link';
  import { iconRowNames } from './icon-controls';
  import StateSwitch from './StateSwitch.svelte';
  import { ElementState } from '@feega/live-edit/element-state';
  import { changedKeys, isChanged } from './states';
  import type { FontChoice, Palette, Pick } from '../messages';
  import { DEFAULT_BREAKPOINTS, type Breakpoints } from '@feega/live-edit/breakpoints';
  import { overrideTitle, rowOverrides } from './responsive';

  type Props = { pick: Pick; onpreview: (row: Row, value: string) => void; onchange: (row: Row, value: string, token?: string) => void; onsavevar: (row: Row, name: string, css: string) => void; onhint: (hint: Hint | null) => void; onfont: (font: FontChoice) => void; onfontreplace: (from: string, to: FontChoice) => void; onfontload: (family: string) => void; onnotice: (text: string) => void; palette: Palette; elementState?: ElementState; baseline?: Record<string, string> | null; onstate?: (state: ElementState) => void; breakpoints?: Breakpoints; scales?: Scales | null };

  let { pick, onpreview, onchange, onhint, onfont, onfontreplace, onfontload, onnotice, palette, onsavevar, elementState = ElementState.Default, baseline = null, onstate, breakpoints = DEFAULT_BREAKPOINTS, scales = null }: Props = $props();

  const missingHere = $derived(missingIn(pick.styles['font-family'] ?? '', palette.missing));
  const presentFonts = $derived(palette.fonts.filter((name) => !palette.missing.some((m) => m.family === name)));

  const differs = $derived(changedKeys(ROWS, pick.styles, baseline));
  const changed = (key: string) => isChanged(differs, key);

  const overrideOf = (name: string): string => {
    const names = rowOverrides(byName(name), pick.classes, breakpoints);
    return names.length ? overrideTitle(names, breakpoints) : '';
  };

  const WEIGHT_NAMES: Record<string, string> = { '100': 'Thin', '200': 'Extra light', '300': 'Light', '400': 'Regular', '500': 'Medium', '600': 'Semibold', '700': 'Bold', '800': 'Extra bold', '900': 'Black' };
  const TEXT_ALIGN = [
    { value: 'text-left', label: 'Left', icon: AlignLeft },
    { value: 'text-center', label: 'Center', icon: AlignCenter },
    { value: 'text-right', label: 'Right', icon: AlignRight },
    { value: 'text-justify', label: 'Justify', icon: AlignJustify }
  ];
  const DIRECTION = [
    { value: 'flex-row', label: 'Horizontal', icon: ArrowRight },
    { value: 'flex-col', label: 'Vertical', icon: ArrowDown }
  ];
  const CHOICE_LABEL: Record<string, string> = {
    'items-start': 'Start', 'items-center': 'Center', 'items-end': 'End', 'items-stretch': 'Stretch',
    'justify-start': 'Start', 'justify-center': 'Center', 'justify-end': 'End', 'justify-between': 'Space between'
  };
  const MODE_ICON: Record<Group, Record<SideMode, UiIcon>> = {
    [Group.Padding]: { [SideMode.All]: UiIcon.SidesAll, [SideMode.Axis]: UiIcon.SidesAxis, [SideMode.Each]: UiIcon.SidesEach },
    [Group.Margin]: { [SideMode.All]: UiIcon.SidesAll, [SideMode.Axis]: UiIcon.SidesAxis, [SideMode.Each]: UiIcon.SidesEach },
    [Group.Radius]: { [SideMode.All]: UiIcon.CornersAll, [SideMode.Axis]: UiIcon.CornersAll, [SideMode.Each]: UiIcon.CornersEach }
  };
  const GROUP_ICON: Record<Group, UiIcon> = { [Group.Padding]: UiIcon.Padding, [Group.Margin]: UiIcon.Margin, [Group.Radius]: UiIcon.Radius };
  type IconComponent = typeof Check;
  const MODE_LABEL: Record<SideMode, string> = { [SideMode.All]: 'All sides', [SideMode.Axis]: 'Horizontal and vertical', [SideMode.Each]: 'Each side' };
  const SIDE_PREFIX: Record<string, string> = { all: '', x: '↔', y: '↕', top: 'T', right: 'R', bottom: 'B', left: 'L', tl: '◜', tr: '◝', br: '◞', bl: '◟' };
  const DEFAULT_PAINT = '#d9d9d9';

  const EXTRA_SECTIONS = [...new Set(CSS_ROWS.map((s) => s.section))].filter((s) => s !== Section.Size);
  const READS: Record<string, string> = Object.fromEntries(CSS_ROWS.map((s) => [s.name, s.reads[0]]));

  let sizeLinked = $state(true);
  let limitsChoice = $state<{ source: string; open: boolean }>({ source: '', open: false });
  let closed = $state<Record<string, boolean>>(Object.fromEntries(EXTRA_SECTIONS.map((s) => [s, true])));
  let modes = $state<Record<string, SideMode>>({ [Group.Padding]: SideMode.All, [Group.Margin]: SideMode.All, [Group.Radius]: SideMode.All });

  const byName = (name: string) => ROWS.find((r) => r.name === name)!;
  const num = (name: string) => byName(name) as NumberRow;
  const role = $derived(roleOf({ tag: pick.tag, ownText: pick.ownText, inlineText: pick.inlineText, elements: pick.elements, display: pick.styles.display ?? '' }));
  const sections = $derived(sectionsOf(role));
  const has = (s: Section) => sections.includes(s);
  const context = $derived({ rem: pick.rem, em: parseFloat(pick.styles['font-size'] ?? '16') || 16, parent: pick.parentWidth, viewport: { w: pick.viewport, h: window.innerHeight } });
  const groupRows = (group: Group) => ROWS.filter((r) => r.group === group && r.mode === modes[group]) as NumberRow[];
  const SIDE_TITLE: Record<OffsetSide, string> = { [OffsetSide.Top]: 'Top', [OffsetSide.Right]: 'Right', [OffsetSide.Bottom]: 'Bottom', [OffsetSide.Left]: 'Left' };
  let offsetChoice = $state<{ source: string; on: Partial<Offsets> }>({ source: '', on: {} });
  const offsetKey = $derived(JSON.stringify(pick.source));
  const authored = $derived(wiringState.at === sourceText(pick.source) ? wiringState.wiring?.offsets : undefined);
  const known = $derived(authored ? offsetsFromHost(authored) : initialOffsets(pick.classes, pick.styles));
  const offsetOn = (side: OffsetSide) => (offsetChoice.source === offsetKey ? offsetChoice.on[side] : undefined) ?? known[side];

  function setOffset(side: OffsetSide, on: boolean) {
    const on0 = offsetChoice.source === offsetKey ? offsetChoice.on : {};
    offsetChoice = { source: offsetKey, on: { ...on0, [side]: on } };
  }

  function flip(side: OffsetSide) {
    const on = offsetOn(side);
    setOffset(side, !on);
    onchange(num(side), flipOffset({ on, px: Math.round(parseFloat(pick.styles[side] ?? '0') || 0) }));
  }

  const limitsOpen = $derived(limitsChoice.source === offsetKey ? limitsChoice.open : limitsSet(pick.styles));
  const readOf = (name: string) => byName(name).read(pick.styles) as string;

  function shared(row: NumberRow): Shared<number> {
    if (!row.group || row.mode === SideMode.Each) {
      return row.read(pick.styles);
    }
    const prefix = row.group === Group.Radius ? 'border-' : `${row.group}-`;
    const suffix = row.group === Group.Radius ? '-radius' : '';
    const values = row.sides!.map((side) => Math.round(parseFloat(pick.styles[`${prefix}${side}${suffix}`] ?? '0') || 0));
    return values.every((v) => v === values[0]) ? values[0] : MIXED;
  }

  function nextMode(group: Group) {
    const list = GROUP_MODES[group];
    modes[group] = list[(list.indexOf(modes[group]) + 1) % list.length];
  }

  const PLACEMENT_ROWS = [
    ['fill-size', 'background-size'],
    ['fill-repeat', 'background-repeat'],
    ['fill-position', 'background-position']
  ];
  const textClipped = $derived(has(Section.Typography) && isClipped(pick.styles));
  const placementOf = () => ({ size: readOf('fill-size'), repeat: readOf('fill-repeat'), position: readOf('fill-position') });
  const fillsOf = () => parseFills(readOf('fill-image'), readOf('fill'), placementOf());
  const sectionCss = (fills: Fill[]) => ({ ...fillCss(fills), ...placementCss(fills) });

  function writeFill(css: Record<string, string>) {
    imageChanged(readOf('fill-image'), css['background-image']) && onchange(byName('fill-image'), css['background-image']);
    PLACEMENT_ROWS.forEach(([row, key]) => readOf(row).trim() !== css[key] && onchange(byName(row), css[key]));
    onchange(byName('fill'), css['background-color']);
  }

  function previewFill(css: Record<string, string>) {
    onpreview(byName('fill-image'), css['background-image']);
    PLACEMENT_ROWS.forEach(([row, key]) => onpreview(byName(row), css[key]));
    onpreview(byName('fill'), css['background-color']);
  }

  const writeText = (css: Record<string, string>) => textFillWrites(css, pick.styles).forEach(([row, value]) => onchange(byName(row), value));
  const previewText = (css: Record<string, string>) => textFillPreviews(css).forEach(([row, value]) => onpreview(byName(row), value));

  const keyOf = (row: NumberRow) => row.name.slice(row.name.lastIndexOf('-') + 1);
</script>

{#snippet header(section: Section, actions?: Snippet, inline = false)}
  {#if inline}
    <div class="head inline" class:differs={changed(section)} data-row={section}>
      <span class="label title-inline">{section}</span>
      <div class="control">{@render actions?.()}</div>
    </div>
  {:else}
    <SectionHead title={section} open={!closed[section]} ontoggle={() => (closed[section] = !closed[section])} {actions} />
  {/if}
{/snippet}

{#snippet row(label: string, content: Snippet, name = '')}
  <div class="row" class:differs={changed(name || label)} data-row={name || label}>
    <span class="label">{label}</span>
    <div class="control">{@render content()}</div>
  </div>
{/snippet}

{#snippet field(r: NumberRow, prefix = r.label, iconSvg = '', compact = false, twin: NumberRow | null = null)}
  {#snippet glyph()}<Icon svg={iconSvg} />{/snippet}
  <Field name={r.name} steps={scaleFor(r.name, scales)} override={overrideOf(r.name)} css={SIZE_LIMITS.includes(r.name) ? (pick.styles[READS[r.name]] ?? '') : ''} {prefix} icon={iconSvg ? glyph : undefined} {compact} px={shared(r)} units={r.units} unit={r.units ? '' : r.unit} {context} min={r.range.min} max={r.range.max} onpreview={(v) => (onpreview(r, v), twin && onpreview(twin, v))} onchange={(v) => (onchange(r, v), twin && onchange(twin, v))} />
{/snippet}

{#snippet segmented(r: Row, options: { value: string; label: string; icon: IconComponent }[])}
  {@const current = readOf(r.name)}
  <div class="segmented" role="radiogroup" aria-label={r.label} data-field={r.name}>
    {#each options as o (o.value)}
      {@const Icon = o.icon}
      <button type="button" role="radio" aria-checked={current === o.value} class:on={current === o.value} title={o.label} aria-label={o.label} onclick={() => onchange(r, o.value)}><Icon size={14} /></button>
    {/each}
  </div>
{/snippet}

{#snippet choice(r: Row)}
  {@const current = readOf(r.name)}
  {@const nameOf = (c: string) => CHOICE_LABEL[c] ?? WEIGHT_NAMES[c] ?? c}
  <Select.Root type="single" value={current} onValueChange={(v) => v && onchange(r, v)} items={(r as { choices: string[] }).choices.map((c) => ({ value: c, label: nameOf(c) }))}>
    <Select.Trigger class="select" aria-label={r.label} data-field={r.name}>
      <span>{current ? nameOf(current) : '—'}</span>
      {#if WEIGHT_NAMES[current]}<span class="muted">{current}</span>{/if}
      <span class="caret"><ChevronDown size={12} /></span>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content class="dropdown-menu" sideOffset={4}>
        {#each (r as { choices: string[] }).choices as c (c)}
          <Select.Item class="dropdown-item" value={c} label={nameOf(c)}>
            {#snippet children({ selected })}<span class="check">{#if selected}<Check size={12} />{/if}</span>{nameOf(c)}{#if WEIGHT_NAMES[c]}<span class="muted">{c}</span>{/if}{/snippet}
          </Select.Item>
        {/each}
      </Select.Content>
    </Select.Portal>
  </Select.Root>
{/snippet}

{#snippet offsetBox()}
  <div class="posbox" role="group" aria-label="Offsets" data-field="offsets">
    {#each OFFSET_SIDES as side (side)}
      {@const r = num(side)}
      {@const on = offsetOn(side)}
      <div class={`slot ${side}`} class:off={!on} data-on={on}>
        <Field name={r.name} steps={scaleFor(r.name, scales)} prefix="" px={shared(r)} units={r.units} {context} min={r.range.min} max={r.range.max} title={SIDE_TITLE[side]} onpreview={(v) => onpreview(r, v)} onchange={(v) => (setOffset(side, true), onchange(r, v))} />
      </div>
    {/each}
    <div class="box" role="presentation">
      {#each OFFSET_SIDES as side (side)}
        <button type="button" class={`bar ${side}`} class:on={offsetOn(side)} role="switch" aria-checked={offsetOn(side)} aria-label={`${SIDE_TITLE[side]} offset`} title={`${SIDE_TITLE[side]}: ${offsetOn(side) ? 'set — click to remove' : 'not set — click to set'}`} data-bar={side} onclick={() => flip(side)}></button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet sides(group: Group)}
  {@const rows = groupRows(group)}
  <div class="sides" class:quad={rows.length === 4} class:pair={rows.length === 2} role="presentation" onpointerleave={() => onhint(null)}>
    {#each rows as r (r.name)}
      <div role="presentation" onpointerenter={() => onhint({ group, sides: r.sides ?? [] })}>{@render field(r, SIDE_PREFIX[keyOf(r)], SIDE_PREFIX[keyOf(r)] ? '' : UI_ICON_SVG[GROUP_ICON[group]])}</div>
    {/each}
  </div>
  <button type="button" class="icon" title={`${MODE_LABEL[modes[group]]} — click to switch`} aria-label={`${group}: ${MODE_LABEL[modes[group]]}`} data-mode={`${group}-${modes[group]}`} onclick={() => nextMode(group)}><Icon svg={UI_ICON_SVG[MODE_ICON[group][modes[group]]]} /></button>
{/snippet}

{#snippet colourRow(name: string)}
  {@const r = byName(name)}
  {@const paint = paintOf(readOf(name))}
  <div class="colour" data-field={name}>
    {#if paint}
      <Popover.Root>
        <Popover.Trigger class="swatch-trigger" aria-label={`${r.label} colour`}><span class="swatch" style={`background:${readOf(name)}`}></span></Popover.Trigger>
        <Popover.Portal>
          <Popover.Content class="picker-popover" side="left" sideOffset={8} collisionPadding={8}>
            <ColorPicker value={readOf(name)} {palette} onchange={(p) => (onpreview(r, p.css), onchange(r, p.css, p.token))} onpreview={(c) => onpreview(r, c)} onsave={(n, c) => onsavevar(r, n, c)} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {@const verdict = colourCheck(readOf(name), palette.tokens)}
      {#if verdict.off && verdict.nearest}
        {@const near = verdict.nearest}
        <button type="button" class="off-theme" data-off-theme title={`Off theme. Nearest: ${near.name} (${near.value}). Click to apply.`} aria-label={`Off theme, apply ${near.name}`} onclick={() => ((p) => (onpreview(r, p.css), onchange(r, p.css, p.token)))(tokenPick(near.name))}></button>
      {/if}
      <input type="text" class="hex" value={paint} aria-label={`${r.label} hex`} onchange={(e) => onchange(r, e.currentTarget.value)} />
    {:else}
      <span class="none">None</span>
      <button type="button" class="icon" title={`Add ${r.label.toLowerCase()}`} aria-label={`Add ${r.label.toLowerCase()}`} onclick={() => onchange(r, DEFAULT_PAINT)}><Plus size={14} /></button>
    {/if}
  </div>
{/snippet}

<div class="properties" data-testid="properties">
  {#if onstate && !pick.page && role !== Role.Head}
    <StateSwitch tag={pick.tag} state={elementState} authored={pick.states ?? []} {onstate} />
  {/if}

  {#if role === Role.Head}
    <section data-section="attributes">
      {#each pick.attributes ?? [] as a (a.name)}
        <div class="row" data-row={a.name}>
          <span class="label">{a.name}</span>
          <div class="control"><input type="text" class="hex" value={a.value} aria-label={a.name} readonly /></div>
        </div>
      {:else}
        <p class="muted">No attributes</p>
      {/each}
    </section>
  {/if}

  {#if has(Section.Layout)}
    <section data-section={Section.Layout}>
      {@render header(Section.Layout)}
      {#if !closed[Section.Layout]}
        {#snippet dir()}{@render segmented(byName('direction'), DIRECTION)}{/snippet}
        {@render row('Direction', dir, 'direction')}
        {#snippet al()}{@render choice(byName('align'))}{/snippet}
        {@render row('Align', al, 'align')}
        {#snippet ju()}{@render choice(byName('justify'))}{/snippet}
        {@render row('Justify', ju, 'justify')}
        {#snippet gp()}<div class="solo">{@render field(num('gap'), 'G')}</div>{/snippet}
        {@render row('Gap', gp, 'gap')}
      {/if}
    </section>
  {/if}

  {#if has(Section.Icon)}
    <section data-section={Section.Icon}>
      {@render header(Section.Icon)}
      {#if !closed[Section.Icon]}
        {#each iconRowNames(pick.styles) as name (name)}
          {@const r = byName(name)}
          <div class="row" data-row={name}>
            <span class="label">{r.label}</span>
            <div class="control">
              {#if r.control === Control.Number}{@render field(r as NumberRow, '', '', true)}{:else}{@render colourRow(name)}{/if}
            </div>
          </div>
        {/each}
        <IconActions {pick} />
      {/if}
    </section>
  {/if}

  {#if has(Section.Size)}
    <section data-section={Section.Size}>
      {#snippet wd()}
        {@const icon = !has(Section.Object) && has(Section.Icon) && sizeLinked}
        <div class="solo">{@render field(num('width'), 'W', '', false, icon ? num('height') : null)}</div>
        {#if has(Section.Icon)}<button type="button" class="icon" class:on={sizeLinked} title="Link width and height" aria-label="Link width and height" aria-pressed={sizeLinked} data-field="icon-size-link" onclick={() => (sizeLinked = !sizeLinked)}><Link size={12} /></button>{/if}
      {/snippet}
      {#snippet ht()}
        {@const icon = !has(Section.Object) && has(Section.Icon) && sizeLinked}
        <div class="solo">{@render field(num('height'), 'H', '', false, icon ? num('width') : null)}</div>
      {/snippet}
      {@render header(Section.Size, wd, true)}
      {@render row('Height', ht, 'height')}
      {#if limitsOpen}
        {#each SIZE_LIMITS as name (name)}
          {@const r = num(name)}
          <div class="row" class:differs={changed(name)} data-row={name}>
            <span class="label">{r.label}{#if overrideOf(name)}<span class="override-dot inline" title={overrideOf(name)} aria-label={overrideOf(name)} data-override></span>{/if}</span>
            <div class="control reset-pair">
              {@render field(r, '', '', true)}
              <button type="button" class="icon reset" title={`Clear ${r.label.toLowerCase()}`} aria-label={`Clear ${r.label.toLowerCase()}`} onclick={() => onchange(r, '')}>×</button>
            </div>
          </div>
        {/each}
      {/if}
      <div class="row limits-toggle" data-row="size-limits">
        <span class="label"></span>
        <div class="control">
          <button type="button" class="link" aria-expanded={limitsOpen} data-field="size-limits" onclick={() => (limitsChoice = { source: offsetKey, open: !limitsOpen })}>{#if !limitsOpen}<Plus size={12} />{/if}{limitsOpen ? 'Hide min/max' : 'min/max'}</button>
        </div>
      </div>
    </section>
  {/if}

  {#if has(Section.Spacing)}
    <section data-section={Section.Spacing}>
      {@render header(Section.Spacing)}
      {#if !closed[Section.Spacing]}
        {#snippet pad()}{@render sides(Group.Padding)}{/snippet}
        {@render row('Padding', pad, 'padding')}
        {#snippet mar()}{@render sides(Group.Margin)}{/snippet}
        {@render row('Margin', mar, 'margin')}
      {/if}
    </section>
  {/if}

  {#if has(Section.Typography) && isTextTag(pick.tag)}
    <section data-section={Section.Tag}>
      {@render header(Section.Tag)}
      {#if !closed[Section.Tag]}
        {#snippet tagRow()}<TagPicker at={sourceText(pick.source)} tag={pick.tag} />{/snippet}
        {@render row('Tag', tagRow, 'tag')}
        {#if tagNote(pick)}<p class="tag-note">{tagNote(pick)}</p>{/if}
      {/if}
    </section>
  {/if}

  {#if has(Section.Typography)}
    <section data-section={Section.Typography}>
      {@render header(Section.Typography)}
      {#if !closed[Section.Typography]}
        {#snippet font()}<FontPicker family={readOf('font-family')} project={palette.fonts} onpick={(font) => onfont(font)} />{/snippet}
        {@render row('Font', font, 'font-family')}
        {#if missingHere}<div class="font-warning"><MissingFont missing={missingHere} project={presentFonts} onreplace={onfontreplace} onload={onfontload} /></div>{/if}
        {#snippet weight()}{@render choice(byName('font-weight'))}{/snippet}
        {@render row('Weight', weight, 'font-weight')}
        {#snippet size()}{@render field(num('font-size'), '', '', true)}{/snippet}
        {@render row('Size', size, 'font-size')}
        {#snippet lh()}{@render field(num('line-height'), '', '', true)}{/snippet}
        {@render row('Line height', lh, 'line-height')}
        {#snippet ls()}{@render field(num('letter-spacing'), '', '', true)}{/snippet}
        {@render row('Letter spacing', ls, 'letter-spacing')}
        {#snippet ta()}{@render segmented(byName('text-align'), TEXT_ALIGN)}{/snippet}
        {@render row('Align', ta, 'text-align')}
        <FillList scope="text-fill" inline parse={() => textFillsOf(pick.styles)} css={textFillCss} guard={(next) => textFillRefusal(pick.styles, next)} onrefuse={onnotice} {palette} {header} {row} onchange={writeText} onpreview={previewText} />
      {/if}
    </section>
  {/if}

  {#if has(Section.Fill) && !textClipped}
    <section data-section={Section.Fill}>
      <FillList parse={fillsOf} css={sectionCss} {palette} {header} {row} onchange={writeFill} onpreview={previewFill} />
    </section>
  {/if}

  {#if has(Section.Radius)}
    <section data-section={Section.Radius}>
      {#snippet rad()}{@render sides(Group.Radius)}{/snippet}
      {@render header(Section.Radius, rad, true)}
    </section>
  {/if}

  {#if has(Section.Border)}
    <section data-section={Section.Border}>
      {#snippet bw()}<div class="solo">{@render field(num('border'), 'W')}</div>{/snippet}
      {@render header(Section.Border, bw, true)}
    </section>
  {/if}

  {#if has(Section.Effects)}
    <section data-section={Section.Effects}>
      {#snippet op()}<div class="solo">{@render field(num('opacity'), '◐')}</div>{/snippet}
      <ShadowList {palette} css={readOf('shadow')} text={pick.ownText ? readOf('text-shadow') : null} {header} {row} onchange={(css) => onchange(byName('shadow'), css)} ontext={(css) => onchange(byName('text-shadow'), css)} onpreview={(css) => onpreview(byName('shadow'), css)} onpreviewtext={(css) => onpreview(byName('text-shadow'), css)} />
      {@render row('Opacity', op, 'opacity')}
    </section>
  {/if}

  {#each EXTRA_SECTIONS.filter(has) as s (s)}
    <section data-section={s}>
      {@render header(s)}
      {#if !closed[s]}
        {#each shownRows(ROWS.filter((r) => r.section === s), pick.styles) as r (r.name)}
          {#if s === Section.Position && OFFSET_SIDES.includes(r.name as OffsetSide)}
            {#if r.name === OffsetSide.Top}<div class="row" data-row="offsets"><span class="label"></span><div class="control reset-pair">{@render offsetBox()}<span class="icon reset slot-only" aria-hidden="true">×</span></div></div>{/if}
          {:else}
          {@const from = pick.inherited?.[READS[r.name]]}
          <div class="row" class:inherited={from} class:differs={changed(r.name)} data-row={r.name} title={from ? `Inherited from ${from}` : undefined}>
            <span class="label">{r.label}{#if overrideOf(r.name)}<span class="override-dot inline" title={overrideOf(r.name)} aria-label={overrideOf(r.name)} data-override></span>{/if}</span>
            <div class="control reset-pair">
              {#if r.control === Control.Number}
                {@render field(r, '', '', true)}
              {:else if r.control === Control.Choice}
                {@render choice(r)}
              {:else if r.control === Control.Colour}
                {@render colourRow(r.name)}
              {:else}
                <input type="text" class="hex" value={readOf(r.name)} aria-label={r.label} data-field={r.name} onchange={(e) => onchange(r, e.currentTarget.value)} />
              {/if}
              {#if from}<span class="muted from">{from}</span>{/if}
              <button type="button" class="icon reset" title={`Reset ${r.label.toLowerCase()}`} aria-label={`Reset ${r.label.toLowerCase()}`} onclick={() => onchange(r, '')}>×</button>
            </div>
          </div>
          {/if}
        {/each}
      {/if}
    </section>
  {/each}
</div>

<style>
  .override-dot.inline {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-left: 4px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent);
  }

  .properties {
    --label-w: 96px;
    font-size: var(--ui-text-sm);
  }

  .row.inherited .control > :global(:first-child) {
    opacity: 0.55;
  }

  .properties :global(.row.differs > .label),
  .properties :global(.head.differs > .label) {
    color: var(--ui-accent);
  }

  .limits-toggle .link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .limits-toggle .link:hover {
    color: var(--ui-text);
  }

  .reset.slot-only {
    visibility: hidden;
  }

  .reset-pair {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .reset-pair > :global(:first-child) {
    flex: 1;
    min-width: 0;
  }

  .from {
    margin-left: 0;
  }

  section {
    padding: 0 0 8px;
    border-bottom: 1px solid var(--ui-divider);
  }

  section:has(> :global(.head) [aria-expanded='false']) {
    padding: 4px 0;
  }

  .tag-note {
    margin: 0;
    padding: 0 12px 8px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .properties :global(.head.inline) {
    display: grid;
    align-items: center;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    gap: 8px;
    height: auto;
    min-height: 40px;
    padding: 6px 12px;
  }

  .properties :global(.title-inline) {
    color: var(--ui-text);
    font-weight: 600;
  }

  .properties :global(.muted) {
    margin-left: auto;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .properties :global(.check) {
    display: inline-grid;
    width: 16px;
  }

  .properties :global(button.select) {
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    cursor: pointer;
  }

  .properties :global(.caret) {
    display: inline-grid;
    margin-left: auto;
    color: var(--ui-text-2);
  }

  .properties :global(.row.wide) {
    grid-template-columns: minmax(0, 1fr);
  }

  .posbox {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr);
    grid-template-rows: 28px 36px 28px;
    gap: 4px;
    align-items: center;
    min-width: 0;
  }

  .posbox .slot {
    min-width: 0;
  }

  .posbox .slot :global(.unit) {
    max-width: 30px;
  }

  .posbox .slot.off {
    opacity: 0.45;
  }

  .posbox .slot :global(.prefix) {
    min-width: 6px;
  }

  .posbox .slot.top {
    grid-area: 1 / 1 / 2 / 4;
    justify-self: center;
    width: 50%;
  }

  .posbox .slot.bottom {
    grid-area: 3 / 1 / 4 / 4;
    justify-self: center;
    width: 50%;
  }

  .posbox .slot.left {
    grid-area: 2 / 1;
  }

  .posbox .slot.right {
    grid-area: 2 / 3;
  }

  .posbox .box {
    position: relative;
    grid-area: 2 / 2;
    width: 36px;
    height: 36px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    box-shadow: inset 0 0 0 1px var(--ui-field-border);
  }

  .posbox .bar {
    position: absolute;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-text-3);
    cursor: pointer;
  }

  .posbox .bar.on {
    background: var(--ui-accent);
  }

  .posbox .bar.top,
  .posbox .bar.bottom {
    left: 10px;
    width: 16px;
    height: 4px;
  }

  .posbox .bar.left,
  .posbox .bar.right {
    top: 10px;
    width: 4px;
    height: 16px;
  }

  .posbox .bar.top { top: 4px; }
  .posbox .bar.bottom { bottom: 4px; }
  .posbox .bar.left { left: 4px; }
  .posbox .bar.right { right: 4px; }

  .properties :global(.row) {
    display: grid;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 4px 12px;
  }

  .properties :global(.label) {
    overflow: hidden;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .properties :global(.control) {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .pair,
  .sides {
    display: grid;
    flex: 1;
    gap: 4px;
    min-width: 0;
  }

  .pair {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .solo {
    display: block;
    flex: 1;
    min-width: 0;
  }

  .font-warning {
    padding: 4px 12px 8px;
  }

  .sides {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sides:not(.pair):not(.quad) {
    grid-template-columns: minmax(0, 1fr);
  }

  .segmented {
    display: flex;
    flex: 1;
    gap: 2px;
    height: 28px;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .segmented button {
    display: grid;
    flex: 1;
    place-items: center;
    border: 0;
    border-radius: 3px;
    background: none;
    box-shadow: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .segmented button.on {
    background: var(--ui-thumb);
    color: var(--ui-thumb-ink);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
  }

  .properties :global(.select) {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
  }

  .colour {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .off-theme {
    flex: none;
    width: 6px;
    height: 6px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-warning, #d9822b);
    cursor: pointer;
  }

  .swatch {
    display: block;
    width: 16px;
    height: 16px;
    border-radius: var(--ui-radius-xs);
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
  }

  .properties :global(.swatch-trigger) {
    display: grid;
    flex: none;
    place-items: center;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  :global(.picker-popover) {
    z-index: 20;
    padding: 12px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    color: var(--ui-text);
  }

  .hex {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    box-shadow: none !important;
    color: var(--ui-text);
    font: inherit;
    font-variant-numeric: tabular-nums;
  }

  .none {
    flex: 1;
    color: var(--ui-text-3);
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    box-shadow: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .icon:hover {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .properties :global(button:focus-visible),
  .properties :global(select:focus-visible),
  .properties :global(input:focus-visible) {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  .properties :global(button:focus:not(:focus-visible)) {
    outline: none;
  }
</style>
