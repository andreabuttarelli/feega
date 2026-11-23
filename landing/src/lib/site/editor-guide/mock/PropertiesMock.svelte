<script lang="ts">
  import Glyph from './Glyph.svelte';
  import type { Glyph as GlyphName } from '../../editor-mock/glyphs';
  import { Key, ON, type DemoState } from '../demo/script';
  import { Target } from '../demo/scripts';
  import { ATTRIBUTES, FIT_OPTIONS, FRAME_VARIABLE, REACH, REACH_BADGE, REACH_BADGE_MD, STATES, Subject, VARIABLES, ticksAround } from './subjects';
  import './mock.css';

  type Props = { subject?: Subject; demo: DemoState };

  let { subject = Subject.Button, demo }: Props = $props();

  const ALIGNS: GlyphName[] = ['alignStart', 'alignCenter', 'alignEnd', 'alignJustify'];
  const isButton = $derived(subject === Subject.Button);
  const scrubbing = $derived(demo[Key.Value] !== undefined);
  const padding = $derived(demo[Key.Padding] ?? demo[Key.Value] ?? '12');
  const ticks = $derived(scrubbing ? ticksAround(Number(padding)) : []);
  const shared = $derived(demo[Key.Scope] !== 'solo');
  const stateLabel = $derived(demo[Key.State] ?? STATES[0].label);
  const fit = $derived(demo[Key.Fit] ?? ATTRIBUTES[1].value);
  const badge = $derived(demo[Key.Reach] === 'md' ? REACH_BADGE_MD : REACH_BADGE);
  const colourOf = (name: string, value: string) => (name === FRAME_VARIABLE ? (demo[Key.Colour] ?? value) : value);
</script>

{#snippet sq(dashed: boolean)}
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="0.833" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke-dasharray={dashed ? '1.5 1.5' : undefined} />
    <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
  </svg>
{/snippet}

{#snippet mode()}
  <span class="icon"><i class="sq"></i></span>
{/snippet}

{#snippet field(prefix: string, value: string, unit: string)}
  <div class="field">
    <span class="prefix">{prefix}</span>
    <span class="value">{value}</span>
    <span class="unit" class:bare={!unit.startsWith('px') && unit !== '%'}>{unit}</span>
  </div>
{/snippet}

{#snippet boxField(dashed: boolean, value: string, padded: boolean)}
  <div class="field" data-t={padded ? Target.PaddingField : undefined}>
    <span class="prefix">{@render sq(dashed)}</span>
    <span class="value">{value}</span>
    <span class="unit">px</span>
    {#if padded && scrubbing}
      <span class="off-theme-dot" class:shown={demo[Key.Dot] === ON} data-t={Target.OffDot}></span>
      <span class="ticks">
        {#each ticks as offset (offset)}<span class="tick" class:locked={offset === 0} style:left="calc(50% + {offset}px)"></span>{/each}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet head(title: string, plus = false)}
  <div class="head">
    <span class="title"><span class="chevron"><Glyph name="chevronDown" size={12} /></span>{title}</span>
    {#if plus}<span class="icon"><Glyph name="plus" size={14} /></span>{/if}
  </div>
{/snippet}

<div class="gm panel" data-mock="properties">
  <div class="tab-list"><span class="tab on">Properties</span><span class="tab">Changes</span></div>

  <div class="what">
    {#if isButton}
      <span class="crumbs"><span>…</span><span class="sep">›</span><span>Hero</span><span class="sep">›</span><span class="current">button</span></span>
      <span class="where">in Button.jsx · <span class="link">Hero.jsx:12</span> · <span class="link">Copy for agent</span></span>
      <code class="classes">rounded-lg bg-blue-500 px-5 text-white</code>
    {:else}
      <span class="crumbs"><span>…</span><span class="sep">›</span><span>Board</span><span class="sep">›</span><span class="current">img</span></span>
      <span class="where"><span class="link">Board.jsx:9</span> · <span class="link">Copy for agent</span></span>
      <code class="classes">rounded-xl ring-2</code>
    {/if}
  </div>

  <div class="reach-row">
    <span class="reach-wrap" style:position="relative">
      <span class="reach" data-t={Target.ReachTrigger}><span class="badge" data-t={Target.ReachBadge}>{badge}</span><span class="caret"><Glyph name="chevronDown" size={12} /></span></span>
      <div class="dropdown-menu" class:shut={demo[Key.Menu] !== 'reach'} style="top: 25px; left: -13px; width: 194px">
        {#each REACH as label, i (label)}
          <div class="dropdown-item" class:on={i === 0} data-t="reach-item-{i}"><span class="check">{#if i === 0}<Glyph name="check" size={12} />{/if}</span>{label}</div>
        {/each}
      </div>
    </span>
  </div>

  {#if isButton}
    <div class="scope"><span class="on" data-t={Target.ScopeThis}>{shared ? 'This element ×3' : 'This element'}</span><span class="off" data-t={Target.ScopeAll}>All .rounded-lg (3)</span></div>
    <div class="shared" class:shut={!shared}><span class="text">Edits 3 instances</span><span class="action" data-t={Target.Detach}>Detach</span><span class="action">Dismiss</span><span class="action">Don't show again</span></div>
  {:else}
    <div class="scope"><span class="on">This element</span><span class="off">All .rounded-xl (2)</span></div>
  {/if}

  <div class="properties">
    <div class="state-row">
      <span class="label" data-t={Target.StateLabel}>State</span>
      <div class="control" style:position="relative">
        <div class="select" data-t={Target.StateSelect}><span>{stateLabel}</span><span class="caret"><Glyph name="chevronDown" size={12} /></span></div>
        <div class="dropdown-menu" class:shut={demo[Key.Menu] !== 'state'} style="top: 32px; left: -3px; width: 201px">
          {#each STATES as state, i (state.label)}
            <div class="dropdown-item" class:on={state.label === stateLabel} data-t="state-item-{i}">
              <span class="check">{#if state.label === stateLabel}<Glyph name="check" size={12} />{/if}</span>{state.label}{#if state.styled}<span class="dot trailing"></span>{/if}
            </div>
          {/each}
        </div>
      </div>
    </div>

    <section>
      <div class="head inline">
        <span class="title-inline">Size</span>
        <div class="control"><div class="pair">{@render field('W', isButton ? '132' : '320', 'px')}{@render field('H', isButton ? '40' : '180', 'px')}</div></div>
      </div>
      <div class="row"><span class="label"></span><div class="control"><span class="link-row"><Glyph name="plus" size={12} />min/max</span></div></div>
    </section>

    <section>
      {@render head('Spacing')}
      <div class="row"><span class="label" data-t={Target.PaddingLabel}>Padding</span><div class="control"><div class="solo">{@render boxField(false, padding, true)}</div>{@render mode()}</div></div>
      <div class="row"><span class="label">Margin</span><div class="control"><div class="solo">{@render boxField(true, '0', false)}</div>{@render mode()}</div></div>
    </section>

    <section>
      {@render head('Typography')}
      <div class="row"><span class="label">Font</span><div class="control"><div class="pair wide-first"><span class="select">Inter</span><span class="select">Medium<span class="caret"><Glyph name="chevronDown" size={12} /></span></span></div></div></div>
      <div class="row"><span class="label">Size</span><div class="control"><div class="triple">{@render field('Aa', '14', '')}{@render field('↕', '20', '')}{@render field('↔', '0', '')}</div></div></div>
      <div class="row"><span class="label">Align</span><div class="control"><div class="segmented">{#each ALIGNS as a, i (a)}<span class:on={i === 1}><Glyph name={a} /></span>{/each}</div></div></div>
      <div class="row"><span class="label">Colour</span><div class="control"><div class="colour"><span class="swatch" style:background="#ffffff"></span><span class="hex">#ffffff</span></div></div></div>
    </section>

    <section>
      <div class="head"><span class="title"><span class="chevron"><Glyph name="chevronDown" size={12} /></span>Fill</span><span class="icon"><Glyph name="plus" size={14} /></span></div>
      <div class="row"><span class="label"></span><div class="control"><div class="colour"><span class="swatch" style:background="#3b82f6"></span><span class="hex">#3b82f6</span><span class="muted">100%</span></div></div></div>
    </section>

    <section>
      <div class="head inline">
        <span class="title-inline">Radius</span>
        <div class="control"><div class="pair">{@render field('R', '8', 'px')}</div>{@render mode()}</div>
      </div>
    </section>

    <section>
      <div class="head inline">
        <span class="title-inline">Border</span>
        <div class="control"><div class="pair">{@render field('W', '0', 'px')}</div></div>
      </div>
    </section>

    <section>
      <div class="head"><span class="title"><span class="chevron"><Glyph name="chevronDown" size={12} /></span>Effects</span><span class="icon"><Glyph name="plus" size={14} /></span></div>
      <div class="row"><span class="label">Opacity</span><div class="control"><div class="pair">{@render field('◐', '100', '%')}</div></div></div>
    </section>

    {#if !isButton}
      <section data-section="Attributes">
        <div class="head plain"><span class="title">Attributes</span></div>
        {#each ATTRIBUTES as attribute (attribute.name)}
          <div class="row">
            <span class="label" data-t={attribute.options ? Target.FitLabel : undefined}>{attribute.name}</span>
            <div class="control" style:position="relative">
              {#if attribute.options}
                <span class="attr pick" data-t={Target.Fit}><span>{fit}</span><span class="caret"><Glyph name="chevronDown" size={12} /></span></span>
                <div class="dropdown-menu" class:shut={demo[Key.Menu] !== 'fit'} style="top: 30px; left: 0; width: 100%">
                  {#each FIT_OPTIONS as option, i (option)}
                    <div class="dropdown-item" class:on={option === fit} data-t="fit-item-{i}"><span class="check">{#if option === fit}<Glyph name="check" size={12} />{/if}</span>{option}</div>
                  {/each}
                </div>
              {:else}
                <span class="attr">{attribute.value}</span>
              {/if}
            </div>
          </div>
        {/each}
        {#each VARIABLES as variable (variable.name)}
          <div class="row">
            <span class="label">{variable.name}</span>
            <div class="control"><span class="colour-swatch" data-t="swatch-{variable.name}"><span style:background={colourOf(variable.name, variable.value)}></span></span></div>
          </div>
        {/each}
      </section>
    {/if}
  </div>
</div>

<style>
  .sq {
    display: block;
    width: 11px;
    height: 11px;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1.4px currentColor;
  }
</style>
