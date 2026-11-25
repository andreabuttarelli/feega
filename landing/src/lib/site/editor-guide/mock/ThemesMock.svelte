<script lang="ts">
  import Glyph from './Glyph.svelte';
  import { MARK, type Glyph as GlyphName } from '../../editor-mock/glyphs';
  import { Key, type DemoState } from '../demo/script';
  import { Target } from '../demo/scripts';
  import './mock.css';

  let { demo }: { demo: DemoState } = $props();

  const light = $derived(demo[Key.Theme] === 'light');

  const DEVICES: GlyphName[] = ['full', 'desktop', 'tablet', 'phone'];
</script>

<div class="gm bar" data-mock="themes">
  <header class="toolbar">
    <span class="menu"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">{@html MARK}</svg><Glyph name="chevronDown" size={12} /></span>
    <span class="tool on"><Glyph name="panelLeft" size={15} /></span>
    <span class="tool dim"><Glyph name="arrowLeft" size={15} /></span>
    <span class="tool dim"><Glyph name="arrowRight" size={15} /></span>
    <span class="tool"><Glyph name="reload" size={14} /></span>
    <div class="address" data-t={Target.Address}><span class="live"></span><span>/</span></div>
    <div class="devices">
      {#each DEVICES as d, i (d)}<span class="seg" class:on={i === 0}><Glyph name={d} size={16} /></span>{/each}
      <span class="more"><Glyph name="chevronDown" size={12} /></span>
    </div>
    <div class="readout"><span class="num">880</span><span class="by">× 860</span></div>
    <div class="theme" data-t={Target.Theme}><Glyph name="sunMoon" size={14} /><span>{light ? 'light' : 'dark'}</span><Glyph name="chevronDown" size={12} /></div>
    <span class="tool"><Glyph name="external" size={14} /></span>
    <span class="tool on"><Glyph name="panelRight" size={15} /></span>
  </header>

  <div class="backdrop">
    <div class="frame" class:light>
      <nav class="nav">
        <span class="brand">Northwind</span>
        <span class="links"><span>Features</span><span>Pricing</span><span class="cta">Sign in</span></span>
      </nav>
      <div class="hero">
        <h1>Plan your launch in an afternoon</h1>
        <div class="art"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
      </div>
    </div>
  </div>
</div>

<style>
  .bar {
    width: 890px;
    height: 330px;
    background: #181818;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 40px;
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

  .tool {
    display: grid;
    flex: none;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-2);
  }

  .tool.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .tool.dim {
    opacity: 0.35;
  }

  .address {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 120px;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
    font-size: var(--ui-text-sm);
  }

  .live {
    width: 8px;
    height: 8px;
    border-radius: var(--ui-radius-full);
    background: #30d158;
  }

  .devices {
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: inset 0 0 0 1px var(--ui-field-border);
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
    background: #1c1c1c;
    color: var(--ui-text);
    box-shadow: inset 0 0 0 1px var(--ui-field-border);
  }

  .readout {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    margin-left: 3px;
    padding: 0 8px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: inset 0 0 0 1px var(--ui-field-border);
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
  }

  .readout .num {
    color: var(--ui-text);
  }

  .by {
    min-width: 50px;
  }

  .theme {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    box-shadow: inset 0 0 0 1px var(--ui-field-border);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  .backdrop {
    display: flex;
    padding-left: 10px;
    height: 290px;
    overflow: hidden;
    background: color-mix(in srgb, var(--ui-text) 6%, #1f1f1f);
  }

  .frame {
    width: 880px;
    flex: none;
    overflow: hidden;
    background: #030712;
    color: #ffffff;
    font-family: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  }

  .frame {
    transition:
      background-color 0.5s cubic-bezier(0.87, 0, 0.13, 1),
      color 0.5s cubic-bezier(0.87, 0, 0.13, 1);
  }

  .frame.light {
    background: #ffffff;
    color: #0b1220;
  }

  .frame.light h1 {
    color: #0b1220;
  }

  .frame.light .nav {
    border-bottom-color: #e5e7eb;
  }

  .frame.light .links {
    color: #475569;
  }

  .frame.light .cta {
    background: #2563eb;
    color: #ffffff;
  }

  .frame.light .art {
    background: linear-gradient(135deg, #e0ecff, #bfd7ff);
  }

  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 73px;
    padding: 0 32px;
    border-bottom: 1px solid #1b2538;
  }

  .brand {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .links {
    display: flex;
    align-items: center;
    gap: 24px;
    color: #9fb4d4;
    font-size: 15px;
  }

  .cta {
    display: grid;
    place-items: center;
    width: 101px;
    height: 40px;
    border-radius: 12px;
    background: #4da3ff;
    color: #082a55;
    font-size: 15px;
    font-weight: 500;
  }

  .hero {
    position: relative;
    height: 217px;
  }

  h1 {
    position: absolute;
    top: 95px;
    left: 32px;
    width: 410px;
    margin: 0;
    color: #ffffff;
    font-size: 46px;
    font-weight: 600;
    line-height: 51px;
    letter-spacing: -0.045em;
  }

  .art {
    position: absolute;
    top: 65px;
    left: 460px;
    width: 388px;
    height: 220px;
    border-radius: 20px;
    background: linear-gradient(135deg, #dbeafe, #93c5fd);
  }

  .art i {
    position: absolute;
    display: block;
    border-radius: 10px;
  }

  .b1 {
    top: 44px;
    left: 40px;
    width: 145px;
    height: 92px;
    background: #ffffff;
  }

  .b2 {
    top: 44px;
    left: 205px;
    width: 145px;
    height: 48px;
    background: rgb(255 255 255 / 0.55);
  }

  .b3 {
    top: 108px;
    left: 205px;
    width: 145px;
    height: 28px;
    background: rgb(255 255 255 / 0.4);
  }
</style>
