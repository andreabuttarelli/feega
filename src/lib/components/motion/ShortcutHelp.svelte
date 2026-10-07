<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { shortcutHelp } from '$lib/motion/shortcuts';

  let { onclose }: { onclose: () => void } = $props();

  const sections = shortcutHelp();
</script>

<button type="button" class="scrim" aria-label="Close" onclick={onclose}></button>
<div class="dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" data-testid="shortcut-help">
  <header>
    <span>Keyboard shortcuts</span>
    <button type="button" aria-label="Close" onclick={onclose}><X size={16} /></button>
  </header>
  <div class="sections">
    {#each sections as section (section.group)}
      <section>
        <h3>{section.group}</h3>
        <dl>
          {#each section.rows as row (row.does)}
            <dt>{#each row.keys as key (key)}<kbd>{key}</kbd>{/each}</dt>
            <dd>{row.does}</dd>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 40;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(820px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    overflow: auto;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    padding: var(--ui-space-3);
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line);
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

  .sections {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--ui-space-3);
  }

  h3 {
    margin: 0 0 6px;
    font-family: var(--ui-mono);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    color: var(--ui-ink-2);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 10px;
    margin: 0;
  }

  dt {
    display: flex;
    gap: 3px;
  }

  dd {
    margin: 0;
    color: var(--ui-ink-2);
  }

  kbd {
    min-width: 20px;
    padding: 1px 5px;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    font-family: var(--ui-mono);
    font-size: 11px;
    text-align: center;
  }
</style>
