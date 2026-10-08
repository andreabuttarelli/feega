<script lang="ts">
  import IconButton from './IconButton.svelte';
  import { Action, guideSections } from '$lib/motion/actions';

  let { onclose }: { onclose: () => void } = $props();

  const sections = guideSections();
</script>

<button type="button" class="scrim" aria-label="Close" onclick={onclose}></button>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Keyboard & gestures" data-testid="shortcut-help">
  <header>
    <span>Keyboard & gestures</span>
    <IconButton action={Action.Close} onclick={onclose} />
  </header>
  <p class="hint">Hover or long-press any icon to see its name.</p>
  <div class="sections">
    {#each sections as section (section.group)}
      <section>
        <h3>{section.group}</h3>
        <ul>
          {#each section.rows as row (row.id)}
            {@const Icon = row.icon}
            <li data-action={row.id}>
              <span class="icon"><Icon size={14} /></span>
              <span class="name">{row.name}</span>
              <span class="keys">{#each row.keys.split(' ').filter(Boolean) as key (key)}<kbd>{key}</kbd>{/each}</span>
              <span class="gesture">{row.gesture}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    border: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 40;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(1180px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    overflow: auto;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-4);
    background: var(--ui-raised);
    color: var(--ui-ink);
    box-shadow: 0 16px 48px rgb(0 0 0 / 0.2);
    font-size: var(--ui-text-sm);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: var(--ui-text-md);
  }

  .hint {
    margin: 0;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .sections {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--ui-space-4) 40px;
  }

  h3 {
    margin: 0 0 6px;
    font-family: var(--ui-mono);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--ui-ink-2);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    border-bottom: 1px solid var(--ui-grid);
    grid-template-columns: 20px minmax(0, 1fr) auto;
    grid-template-areas: 'icon name keys' 'icon gesture gesture';
    align-items: center;
    column-gap: var(--ui-space-2);
    padding: 5px 0;
  }

  .icon {
    grid-area: icon;
    display: inline-flex;
    align-self: start;
    padding-top: 2px;
    color: var(--ui-ink-2);
  }

  .name {
    grid-area: name;
  }

  .keys {
    grid-area: keys;
    display: flex;
    gap: 3px;
  }

  .gesture {
    grid-area: gesture;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .gesture:empty {
    display: none;
  }

  kbd {
    min-width: 20px;
    padding: 1px 5px;
    background: var(--ui-field);
    font-family: var(--ui-mono);
    font-size: 11px;
    text-align: center;
  }

  @media (max-width: 600px) {
    .dialog {
      top: auto;
      bottom: 0;
      left: 0;
      transform: none;
      width: 100vw;
      max-height: 85vh;
    }

    .sections {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
