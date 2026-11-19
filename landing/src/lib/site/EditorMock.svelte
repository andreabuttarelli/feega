<script lang="ts">
  import { GLYPH, LAYER, MARK, type Glyph } from './editor-mock/glyphs';
  import { LAYERS } from './editor-mock/layers';

  const DEVICES: Glyph[] = ['full', 'desktop', 'tablet', 'phone'];
  const ALIGNS: Glyph[] = ['alignStart', 'alignCenter', 'alignEnd', 'alignJustify'];
  const INDENT_PX = 12;
</script>

{#snippet ico(name: Glyph, size = 14)}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html GLYPH[name]}</svg>
{/snippet}

{#snippet field(prefix: string, value: string, unit: string, muted = false)}
  <div class="field">
    <span class="prefix">{prefix}</span>
    <span class="value" class:muted>{value}</span>
    <span class="unit">{unit}</span>
  </div>
{/snippet}

{#snippet head(title: string)}
  <div class="head"><span class="title"><span class="chevron">{@render ico('chevronDown', 12)}</span>{title}</span></div>
{/snippet}

<div class="stage" role="img" aria-label="The Feega editor inside VS Code: layers, a live page preview and the properties bar">
  <div class="win">
    <div class="tabs-strip"><span class="vs-tab"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{@html MARK}</svg>Feega</span></div>

    <div class="app">
      <aside class="left">
        <header class="left-head">Layers</header>
        <div class="layers">
          {#each LAYERS as row (row.name + row.depth + row.icon)}
            <div class="lrow" class:picked={row.picked} style:padding-left="{8 + row.depth * INDENT_PX}px">
              <span class="twist" class:open={row.open}>{#if row.open}{@render ico('chevronRight', 12)}{/if}</span>
              <svg class="type" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="0.833" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html LAYER[row.icon]}</svg>
              <span class="name">{row.name}</span>
              {#if row.count}<span class="count">{row.count}</span>{/if}
            </div>
          {/each}
        </div>
      </aside>

      <section class="view">
        <header class="toolbar">
          <span class="menu"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{@html MARK}</svg>{@render ico('chevronDown', 12)}</span>
          <span class="icon on">{@render ico('panelLeft', 15)}</span>
          <span class="icon dim">{@render ico('arrowLeft', 15)}</span>
          <span class="icon dim">{@render ico('arrowRight', 15)}</span>
          <span class="icon">{@render ico('reload', 14)}</span>
          <div class="address"><span class="dot"></span><span class="route">/</span></div>
          <div class="devices">
            <div class="segments">
              {#each DEVICES as d, i (d)}<span class="seg" class:on={i === 0}>{@render ico(d)}</span>{/each}
              <span class="more">{@render ico('chevronDown', 12)}</span>
            </div>
            <div class="readout"><span class="num">718</span><span>×</span><span class="height">660</span></div>
          </div>
          <span class="icon">{@render ico('external', 14)}</span>
          <span class="icon on">{@render ico('panelRight', 15)}</span>
        </header>

        <div class="backdrop">
          <div class="frame">
            <div class="page">
              <nav class="p-nav">
                <span class="p-brand"><i></i>Aurel</span>
                <span class="p-links"><b>Collection</b><b>Refills</b><b>Atelier</b><b>Journal</b></span>
                <span class="p-cta">Bag (0)</span>
              </nav>
              <div class="p-hero">
                <span class="p-tag">New · Ambre Noir, eau de parfum</span>
                <h1>Scent, slowly made.</h1>
                <p class="p-lead">Small-batch perfume, blended by hand in Grasse and refilled for life. Nothing rushed, nothing wasted.<span class="pick-label">p.lead</span></p>
                <div class="p-actions"><span class="p-primary">Shop the collection</span><span class="p-ghost">Find your scent</span></div>
              </div>
              <div class="p-cards">
                <div class="p-card"><i class="g1"></i><b>Ambre Noir</b><span>€128</span></div>
                <div class="p-card"><i class="g2"></i><b>Fig &amp; Cedar</b><span>€112</span></div>
                <div class="p-card"><i class="g3"></i><b>Iris Blanc</b><span>€104</span></div>
              </div>
            </div>
          </div>

          <div class="float">
            <span class="grip"><svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">{#each [0, 1, 2] as r (r)}{#each [0, 1] as c (c)}<circle cx={2 + c * 4} cy={2 + r * 4} r="1.1" fill="currentColor" />{/each}{/each}</svg></span>
            <div class="track">
              <span class="thumb"></span>
              <span class="mode on">{@render ico('design')}Design</span>
              <span class="mode">{@render ico('hand')}Navigate</span>
            </div>
            <span class="icon dim">{@render ico('undo')}</span>
            <span class="icon dim">{@render ico('redo')}</span>
          </div>
        </div>
      </section>

      <aside class="right">
        <div class="tab-list"><span class="tab on">Properties</span><span class="tab">Changes</span></div>

        <div class="what">
          <span class="crumbs"><span>…</span><span class="sep">›</span><span>+page</span><span class="sep">›</span><span>Hero</span><span class="sep">›</span><span class="current">p.lead</span></span>
          <span class="where">in +page.svelte · <span class="link-dim">Hero.svelte:21</span></span>
          <code class="classes">lead</code>
        </div>
        <div class="scope"><span class="on">This element</span><span>All .lead (3)</span></div>

        <section>
          {@render head('Size')}
          <div class="row"><span class="label">Size</span><div class="control"><div class="pair">{@render field('W', '550', 'px')}{@render field('H', '34', 'px')}</div></div></div>
        </section>

        <section>
          {@render head('Spacing')}
          <div class="row"><span class="label">Padding</span><div class="control">{@render field('▢', '0', 'px')}<span class="icon"><i class="sq"></i></span></div></div>
          <div class="row"><span class="label">Margin</span><div class="control">{@render field('▢', 'Mixed', 'px', true)}<span class="icon"><i class="sq"></i></span></div></div>
        </section>

        <section>
          {@render head('Typography')}
          <div class="row"><span class="label">Font</span><div class="control"><div class="pair wide-first"><span class="select">BDO Grotesk</span><span class="select">Regular{@render ico('chevronDown', 12)}</span></div></div></div>
          <div class="row"><span class="label">Size</span><div class="control"><div class="triple">{@render field('Aa', '14', 'px')}{@render field('↕', '17', 'px')}{@render field('↔', '-0.', 'px')}</div></div></div>
          <div class="row">
            <span class="label">Align</span>
            <div class="control"><div class="segmented">{#each ALIGNS as a, i (a)}<span class:on={i === 1}>{@render ico(a)}</span>{/each}</div></div>
          </div>
          <div class="row"><span class="label">Colour</span><div class="control"><div class="colour"><span class="swatch"></span><span class="hex">#f0eee9</span></div></div></div>
        </section>

        <section>
          <div class="head"><span class="title"><span class="chevron">{@render ico('chevronDown', 12)}</span>Fill</span><span class="icon">{@render ico('plus', 14)}</span></div>
        </section>

        <section>
          <div class="head inline"><span class="title-inline">Radius</span><div class="control"><div class="pair">{@render field('R', '0', 'px')}</div><span class="icon"><i class="sq"></i></span></div></div>
        </section>

        <section>
          <div class="head"><span class="title"><span class="chevron">{@render ico('chevronDown', 12)}</span>Effects</span><span class="icon">{@render ico('plus', 14)}</span></div>
          <div class="row"><span class="label">Opacity</span><div class="control"><div class="pair">{@render field('◐', '80', '%')}</div></div></div>
        </section>
      </aside>
    </div>
  </div>
</div>

<style>
  .stage {
    container-type: inline-size;
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    pointer-events: none;
    user-select: none;
  }

  .win {
    --ui-accent: #0a84ff;
    --ui-panel: #181818;
    --ui-text: #cccccc;
    --ui-text-2: color-mix(in srgb, var(--ui-text) 60%, transparent);
    --ui-text-3: color-mix(in srgb, var(--ui-text) 40%, transparent);
    --ui-divider: #2b2b2b;
    --ui-input: color-mix(in srgb, var(--ui-text) 9%, var(--ui-panel));
    --ui-thumb: #5a5a5e;
    --ui-thumb-ink: #ffffff;
    --ui-float: color-mix(in srgb, var(--ui-panel) 92%, transparent);
    --ui-backdrop: color-mix(in srgb, var(--ui-text) 6%, #1f1f1f);
    --ui-radius-xs: 2px;
    --ui-radius-sm: 4px;
    --ui-radius-md: 6px;
    --ui-radius-lg: 10px;
    --ui-radius-full: 9999px;

    width: 1280px;
    height: 760px;
    overflow: hidden;
    border-radius: var(--ui-radius-lg);
    background: #1f1f1f;
    box-shadow: 0 0 0 1px #3c3c3c, 0 24px 64px rgb(0 0 0 / 0.5);
    color: var(--ui-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    line-height: normal;
    margin: 0 auto;
    zoom: 1;
  }

  @container (max-width: 1279px) {
    .win { zoom: 0.85; }
  }
  @container (max-width: 1087px) {
    .win { zoom: 0.7; }
  }
  @container (max-width: 895px) {
    .win { zoom: 0.55; }
  }
  @container (max-width: 703px) {
    .win { zoom: 0.4; }
  }
  @container (max-width: 511px) {
    .win { zoom: 0.3; }
  }
  @container (max-width: 383px) {
    .win { zoom: 0.27; }
  }

  .tabs-strip {
    display: flex;
    align-items: flex-end;
    height: 35px;
    background: #181818;
    border-bottom: 1px solid var(--ui-divider);
  }

  .vs-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 35px;
    box-sizing: border-box;
    padding: 0 14px;
    border-top: 1px solid #0078d4;
    border-right: 1px solid var(--ui-divider);
    background: #1f1f1f;
    color: #ffffff;
    font-size: 13px;
  }

  .app {
    --top-row: 40px;

    display: grid;
    grid-template-columns: 260px minmax(0, 1fr) 300px;
    height: calc(100% - 36px);
  }

  .left,
  .right {
    overflow: hidden;
    background: var(--ui-panel);
  }

  .left {
    border-right: 1px solid var(--ui-divider);
  }

  .right {
    border-left: 1px solid var(--ui-divider);
  }

  .left-head {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: var(--top-row);
    padding: 0 12px;
    border-bottom: 1px solid var(--ui-divider);
    color: var(--ui-text-2);
    font-size: 11px;
    font-weight: 600;
  }

  .layers {
    padding: 4px 0;
  }

  .lrow {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding-right: 8px;
    font-size: 12px;
  }

  .lrow.picked {
    background: color-mix(in srgb, var(--ui-accent) 22%, transparent);
  }

  .twist {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    color: var(--ui-text-3);
  }

  .twist.open {
    transform: rotate(90deg);
  }

  .type {
    flex: none;
    color: var(--ui-text-3);
  }

  .count {
    margin-left: auto;
    color: var(--ui-text-3);
    font-size: 11px;
  }

  .view {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    height: var(--top-row);
    box-sizing: border-box;
    padding: 0 8px;
    border-bottom: 1px solid var(--ui-divider);
    background: var(--ui-panel);
  }

  .menu {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 28px;
    padding: 0 6px;
    color: var(--ui-text-2);
  }

  .icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-2);
  }

  .icon.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .icon.dim {
    opacity: 0.35;
  }

  .address {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
    font-size: 12px;
  }

  .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: var(--ui-radius-full);
    background: #30d158;
  }

  .devices {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .segments {
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .seg,
  .more {
    display: grid;
    place-items: center;
    width: 24px;
    height: 20px;
    border-radius: var(--ui-radius-xs);
    color: var(--ui-text-2);
  }

  .more {
    width: 16px;
  }

  .seg.on {
    background: var(--ui-float);
    color: var(--ui-text);
    box-shadow: 0 0 0 1px var(--ui-divider);
  }

  .readout {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .readout .num {
    color: var(--ui-text);
  }

  .height {
    min-width: 32px;
  }

  .backdrop {
    position: relative;
    display: flex;
    flex: 1;
    align-items: flex-start;
    justify-content: center;
    min-height: 0;
    overflow: hidden;
    background: var(--ui-backdrop);
  }

  .frame {
    flex: none;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #f6efe6;
  }

  .float {
    position: absolute;
    bottom: 16px;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px;
    transform: translateX(-50%);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 8px 24px rgb(0 0 0 / 0.22);
    backdrop-filter: blur(12px);
  }

  .grip {
    display: grid;
    place-items: center;
    width: 16px;
    height: 28px;
    color: var(--ui-text);
    opacity: 0.5;
  }

  .track {
    --segment: 96px;

    position: relative;
    display: grid;
    grid-template-columns: repeat(2, var(--segment));
    padding: 2px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
  }

  .thumb {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: var(--segment);
    border-radius: var(--ui-radius-full);
    background: var(--ui-thumb);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.18), 0 0 0 0.5px rgb(0 0 0 / 0.06);
  }

  .mode {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 28px;
    color: var(--ui-text-2);
    font-size: 12px;
  }

  .mode.on {
    color: var(--ui-thumb-ink);
  }

  .page {
    position: relative;
    height: 100%;
    background: #f6efe6;
    color: #2a1c12;
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
  }

  .p-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px 40px;
    font-size: 11px;
  }

  .p-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: Georgia, serif;
    font-size: 17px;
    font-weight: 600;
  }

  .p-brand i {
    width: 20px;
    height: 20px;
    border-radius: 9999px;
    background: #2a1c12;
  }

  .p-links {
    display: flex;
    gap: 28px;
  }

  .p-links b {
    font-weight: 400;
  }

  .p-cta {
    padding: 8px 16px;
    border-radius: 9999px;
    background: #b4532a;
    color: #fff;
    font-weight: 600;
  }

  .p-hero {
    position: relative;
    padding: 56px 40px 0;
  }

  .p-tag {
    display: inline-block;
    padding: 5px 12px;
    border-radius: 9999px;
    background: #ebdfd0;
    font-size: 10px;
  }

  .p-hero h1 {
    margin: 18px 0 14px;
    max-width: 520px;
    font-family: Georgia, serif;
    font-size: 64px;
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .p-lead {
    position: relative;
    box-sizing: border-box;
    width: 550px;
    height: 34px;
    outline: 2px solid var(--ui-accent);
    margin: 0;
    color: #6b5645;
    font-size: 14px;
    line-height: 17px;
    text-align: center;
  }

  .p-actions {
    display: flex;
    gap: 10px;
    margin-top: 28px;
    font-size: 12px;
    font-weight: 600;
  }

  .p-primary,
  .p-ghost {
    padding: 11px 20px;
    border-radius: 9999px;
  }

  .p-primary {
    background: #2a1c12;
    color: #fff;
  }

  .p-ghost {
    box-shadow: inset 0 0 0 1px #2a1c12;
  }

  .pick-label {
    position: absolute;
    top: -18px;
    left: -2px;
    padding: 0 4px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-accent);
    color: #fff;
    font-size: 11px;
    line-height: 16px;
  }

  .p-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 56px 40px 0;
  }

  .p-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
  }

  .p-card i {
    height: 150px;
    margin-bottom: 8px;
    border-radius: 12px;
  }

  .p-card span {
    color: #6b5645;
  }

  .g1 { background: linear-gradient(135deg, #e7a46a, #b4532a); }
  .g2 { background: linear-gradient(135deg, #cdd5b5, #7c8a5a); }
  .g3 { background: linear-gradient(135deg, #d9d4ea, #8c82b8); }

  .tab-list {
    display: flex;
    align-items: center;
    gap: 2px;
    box-sizing: border-box;
    height: var(--top-row);
    padding: 0 8px;
    border-bottom: 1px solid var(--ui-divider);
  }

  .tab {
    display: grid;
    place-items: center;
    height: 26px;
    padding: 0 10px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-2);
    font-size: 12px;
  }

  .tab.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .what {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: 12px;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 2px;
    color: var(--ui-text-2);
    font-size: 11px;
  }

  .crumbs span {
    padding: 0 2px;
  }

  .crumbs .sep {
    padding: 0;
    color: var(--ui-text-3);
  }

  .crumbs .current {
    color: var(--ui-text);
    font-weight: 600;
  }

  .where {
    color: var(--ui-text-3);
    font-size: 11px;
  }

  .link-dim {
    color: var(--ui-text-2);
  }

  .classes {
    color: var(--ui-text-2);
    font-size: 11px;
  }

  .scope {
    display: flex;
    gap: 2px;
    height: 28px;
    box-sizing: border-box;
    margin: 8px 12px;
    padding: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .scope span {
    display: grid;
    flex: 1;
    place-items: center;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-2);
    font-size: 11px;
    white-space: nowrap;
  }

  .scope .on {
    background: var(--ui-thumb);
    color: var(--ui-thumb-ink);
  }

  section {
    --label-w: 72px;

    padding: 0 0 8px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: 12px;
  }

  .head {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 8px 0 4px;
  }

  .head.inline {
    display: grid;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    gap: 8px;
    height: auto;
    min-height: 40px;
    padding: 6px 12px;
  }

  .title,
  .title-inline {
    color: var(--ui-text);
    font-size: 11px;
    font-weight: 600;
  }

  .title {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 4px;
  }

  .chevron {
    display: grid;
    place-items: center;
    width: 16px;
    color: var(--ui-text-3);
  }

  .row {
    display: grid;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 4px 12px;
  }

  .label {
    color: var(--ui-text-2);
    font-size: 11px;
  }

  .control {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .pair,
  .triple {
    display: grid;
    flex: 1;
    gap: 4px;
    min-width: 0;
  }

  .pair { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pair.wide-first { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); }
  .triple { grid-template-columns: repeat(3, minmax(0, 1fr)); }

  .control > .field {
    flex: 1;
  }

  .field {
    display: flex;
    align-items: center;
    min-width: 0;
    height: 28px;
    padding: 0 6px 0 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .prefix {
    display: grid;
    flex: none;
    place-items: center;
    min-width: 20px;
    height: 100%;
    color: var(--ui-text-3);
    font-size: 11px;
  }

  .value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--ui-text);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .value.muted {
    color: var(--ui-text-3);
  }

  .unit {
    flex: none;
    max-width: 26px;
    color: var(--ui-text-3);
    font-size: 11px;
    text-align: right;
  }

  .select {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font-size: 12px;
    white-space: nowrap;
  }

  .segmented {
    display: flex;
    flex: 1;
    gap: 2px;
    height: 28px;
    box-sizing: border-box;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .segmented span {
    display: grid;
    flex: 1;
    place-items: center;
    border-radius: 3px;
    color: var(--ui-text-2);
  }

  .segmented .on {
    background: var(--ui-thumb);
    color: var(--ui-thumb-ink);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
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

  .swatch {
    width: 16px;
    height: 16px;
    border-radius: var(--ui-radius-xs);
    background: #f0eee9;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
  }

  .hex {
    font-variant-numeric: tabular-nums;
  }

  .row .icon,
  .head .icon,
  .control .icon {
    width: 24px;
    height: 24px;
  }

  .sq {
    display: block;
    width: 11px;
    height: 11px;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1.4px currentColor;
  }
</style>
