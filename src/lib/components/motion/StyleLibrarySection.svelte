<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import ColorField from './ColorField.svelte';
  import NumberField from './NumberField.svelte';
  import { ColourDisplay } from '$lib/motion/colour-field';
  import { styleLibrary } from '$lib/canvas/style-library.svelte';
  import { StyleKind, styleSchema, type Style } from '@feega/motion-core/motion/styles-model';
  import { TYPE, TYPE_SIZE } from '@feega/motion-core/motion/components';
  import { styleLabel } from '$lib/motion/style-library';
  import { swatchOf } from '$lib/motion/fill/swatch';
  import { fractionOf, pxOf, textMeta } from '$lib/motion/type-px';
  import { resolveColor, type BrandTokens } from '@feega/motion-core/motion/brand';

  const DEFAULT_UNIT = 1080;
  const PERCENT = 100;

  let { tokens, unit = DEFAULT_UNIT }: { tokens: BrandTokens; unit?: number } = $props();

  type Group = { title: string; kinds: StyleKind[]; create?: { prefix: string; style: Style } };
  const GROUPS: Group[] = [
    { title: 'Text', kinds: [StyleKind.Text], create: { prefix: 'Text style', style: { kind: StyleKind.Text, size: 0.08, weight: 600 } } },
    { title: 'Colour', kinds: [StyleKind.Colour, StyleKind.Paint], create: { prefix: 'Colour', style: { kind: StyleKind.Colour, color: '#111111' } } },
    { title: 'Effect', kinds: [StyleKind.Effect] }
  ];

  const entries = $derived(Object.entries(styleLibrary.styles));
  const inGroup = (group: Group) => entries.filter(([, style]) => group.kinds.includes(style.kind));
  const color = (value: string) => resolveColor(value, tokens);
  const swatch = (style: Style) => {
    if (style.kind === StyleKind.Paint) {
      return swatchOf(style.fills[0], { color, picture: (f) => f.src });
    }
    return 'color' in style && style.color ? color(style.color) : null;
  };
  const meta = (style: Style) => {
    if (style.kind === StyleKind.Text) {
      return textMeta(style, unit);
    }
    return style.kind === StyleKind.Colour ? color(style.color) : styleLabel(style);
  };

  let open = $state<string | null>(null);

  function edit(name: string, style: Style, patch: Record<string, unknown>) {
    const next = styleSchema.safeParse({ ...style, ...patch });
    if (next.success) {
      void styleLibrary.push(name, next.data);
    }
  }

  function create({ prefix, style }: NonNullable<Group['create']>) {
    let n = 1;
    while (styleLibrary.styles[`${prefix} ${n}`]) {
      n++;
    }
    const name = `${prefix} ${n}`;
    void styleLibrary.push(name, style);
    open = name;
  }

  function rename(from: string, raw: string) {
    const to = raw.trim();
    void styleLibrary.rename(from, to);
    if (open === from && styleLibrary.styles[to]) {
      open = to;
    }
  }

  function remove(name: string) {
    open = null;
    void styleLibrary.remove(name);
  }

  function closeOnEnter(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key !== 'Enter') {
      return;
    }
    (e.target as HTMLElement).blur?.();
    open = null;
  }

  const toggle = (name: string, next: boolean) => {
    if (next) {
      open = name;
      return;
    }
    if (open === name) {
      open = null;
    }
  };
</script>

<section class="library" data-testid="style-library">
  {#if styleLibrary.failed}<p class="muted" data-testid="style-library-failed">A style change could not be saved and was undone.</p>{/if}
  {#each GROUPS as group (group.title)}
    {@const rows = inGroup(group)}
    {#if group.create || rows.length}
      <div class="group">
        <header>
          <span>{group.title}</span>
          {#if group.create}
            {@const make = group.create}
            <button type="button" class="icon" aria-label={`New ${group.title.toLowerCase()} style`} data-testid={`style-library-new-${make.style.kind}`} onclick={() => create(make)}><Plus size={14} /></button>
          {/if}
        </header>
        {#each rows as [name, style] (name)}
          {@const chip = swatch(style)}
          <Popover.Root open={open === name} onOpenChange={(next) => toggle(name, next)}>
            <Popover.Trigger class="row" data-testid="style-library-row" data-kind={style.kind} data-style={name}>
              {#if style.kind === StyleKind.Text}
                <span class="aa" style:font-family={style.font ? `'${style.font}', sans-serif` : null} style:font-weight={style.weight}>Aa</span>
              {:else}
                <span class="swatch" data-testid={`style-library-swatch-${name}`} style:background={chip ?? 'var(--ui-input)'}></span>
              {/if}
              <span class="name">{name}</span>
              <span class="muted meta">{meta(style)}</span>
              {#if style.kind === StyleKind.Text && chip}<span class="dot" style:background={chip}></span>{/if}
            </Popover.Trigger>
            <Popover.Content side="left" class="style-editor w-64 gap-2 p-3" onkeydown={closeOnEnter}>
              <div class="head">
                <input class="text" type="text" value={name} aria-label="Style name" data-testid={`style-library-name-${name}`} onchange={(e) => rename(name, e.currentTarget.value)} />
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger class="icon" aria-label={`More for ${name}`} data-testid={`style-library-more-${name}`}><Ellipsis size={14} /></DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item onSelect={() => remove(name)} data-testid={`style-library-remove-${name}`}>Delete style</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </div>
              {#if style.kind === StyleKind.Text}
                <input class="text" type="text" placeholder="Font" value={style.font ?? ''} aria-label="Font" data-testid={`style-library-font-${name}`} onchange={(e) => edit(name, style, { font: e.currentTarget.value.trim() || undefined })} />
                <div class="grid">
                  <span data-testid={`style-library-size-${name}`}><NumberField label="Size" name="Size" unit="px" value={pxOf(style.size ?? 0, unit)} range={{ min: Math.ceil(TYPE_SIZE.min * unit), max: TYPE_SIZE.max * unit, step: 1 }} onchange={(px) => edit(name, style, { size: fractionOf(px, unit) })} /></span>
                  <span data-testid={`style-library-weight-${name}`}><NumberField label="W" name="Weight" value={style.weight ?? 400} range={{ min: TYPE.weight.min, max: TYPE.weight.max, step: 100 }} onchange={(v) => edit(name, style, { weight: Math.round(v) })} /></span>
                  <span data-testid={`style-library-tracking-${name}`}><NumberField label="Tr" name="Tracking" unit="%" value={(style.tracking ?? 0) * PERCENT} range={{ min: TYPE.tracking.min * PERCENT, max: TYPE.tracking.max * PERCENT, step: 0.5 }} onchange={(v) => edit(name, style, { tracking: v / PERCENT })} /></span>
                  <span data-testid={`style-library-leading-${name}`}><NumberField label="Ld" name="Leading" value={style.leading ?? 1.2} range={TYPE.leading} onchange={(v) => edit(name, style, { leading: v })} /></span>
                </div>
              {/if}
              {#if (style.kind === StyleKind.Text && style.color) || style.kind === StyleKind.Colour}
                <span data-testid={`style-library-colour-${name}`}><ColorField {name} display={ColourDisplay.Field} value={chip} {tokens} onchange={(v) => edit(name, style, { color: v })} /></span>
              {/if}
            </Popover.Content>
          </Popover.Root>
        {:else}
          <p class="muted empty">No {group.title.toLowerCase()} styles yet.</p>
        {/each}
      </div>
    {/if}
  {/each}
</section>

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-type-caption);
  }

  .group {
    display: flex;
    flex-direction: column;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--ui-space-1);
    font-weight: 600;
    color: var(--ui-text);
  }

  .library :global(.row) {
    display: grid;
    grid-template-columns: 24px auto 1fr auto;
    align-items: center;
    gap: var(--ui-space-2);
    width: 100%;
    padding: 4px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    font: inherit;
    text-align: left;
  }

  .library :global(.row:hover),
  .library :global(.row[data-state='open']) {
    background: var(--ui-hover);
  }

  .aa {
    width: 24px;
    text-align: center;
    font-size: 14px;
    line-height: 1;
  }

  .swatch {
    width: 16px;
    height: 16px;
    margin: 0 4px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-xs);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: var(--ui-radius-full);
  }

  .name {
    white-space: nowrap;
  }

  .meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }

  .muted {
    color: var(--ui-text-tertiary);
  }

  .empty {
    margin: 0;
    padding: 4px;
  }

  .library :global(.icon),
  :global(.style-editor .icon) {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-tertiary);
  }

  :global(.style-editor) .head {
    display: grid;
    grid-template-columns: 1fr 20px;
    align-items: center;
    gap: var(--ui-space-2);
  }

  :global(.style-editor) .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-2);
  }

  :global(.style-editor) .text {
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-type-caption);
  }
</style>
