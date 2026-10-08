<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import LayoutTemplate from '@lucide/svelte/icons/layout-template';
  import IconButton from './IconButton.svelte';
  import CompositionSettings from './CompositionSettings.svelte';
  import { Action } from '$lib/motion/actions';
  import { SAVE_TONE, SaveState, compositionLabel } from '$lib/motion/editor-bar';
  import type { MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';

  type Crumb = { name: string; go: (() => void) | null };

  type Props = {
    canvasHref: string;
    canvasName: string;
    crumbs: Crumb[];
    doc: MotionDoc;
    onchange: (result: OpResult, summary: string) => void;
    saveState: SaveState;
    version: number;
    ontemplate: () => void;
    onhelp: () => void;
    onclose: () => void;
  };

  let { canvasHref, canvasName, crumbs, doc, onchange, saveState, version, ontemplate, onhelp, onclose }: Props = $props();

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trap(node: HTMLElement) {
    const items = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const before = document.activeElement as HTMLElement | null;
    node.focus();

    function onkey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onclose();
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }
      const all = items();
      const edge = e.shiftKey ? all[0] : all[all.length - 1];
      if (document.activeElement !== edge && document.activeElement !== node) {
        return;
      }
      e.preventDefault();
      (e.shiftKey ? all[all.length - 1] : all[0])?.focus();
    }

    node.addEventListener('keydown', onkey);
    return {
      destroy: () => {
        node.removeEventListener('keydown', onkey);
        before?.focus();
      }
    };
  }
</script>

<button type="button" class="scrim" aria-label="Close menu" tabindex="-1" onclick={onclose}></button>
<div class="drawer" role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1" data-testid="menu-drawer" use:trap>
  <header>
    <span>Menu</span>
    <IconButton action={Action.Close} onclick={onclose} />
  </header>

  <section>
    <a class="row" href={canvasHref}><ArrowLeft size={16} /><span>Back to {canvasName}</span></a>
    <nav class="crumbs" aria-label="Compositions" data-testid="comp-breadcrumb">
      <a class="crumb" href={canvasHref}>{canvasName}</a>
      {#each crumbs as crumb, i (i)}
        <span class="slash" aria-hidden="true">/</span>
        {#if crumb.go}
          <button type="button" class="crumb" onclick={() => (crumb.go?.(), onclose())}>{crumb.name}</button>
        {:else}
          <span class="crumb current" aria-current="page">{crumb.name}</span>
        {/if}
      {/each}
    </nav>
    <span class="save" data-testid="save-state" data-tone={SAVE_TONE[saveState]}><i aria-hidden="true"></i>{saveState} · v{version}</span>
  </section>

  <section>
    <h3>Composition <em>{compositionLabel(doc)}</em></h3>
    <CompositionSettings {doc} {onchange} />
  </section>

  <section>
    <button type="button" class="row" data-testid="template-open" onclick={() => (onclose(), ontemplate())}><LayoutTemplate size={16} /><span>Template</span></button>
    <button type="button" class="row" data-testid="guide-open-menu" onclick={() => (onclose(), onhelp())}><Keyboard size={16} /><span>Keyboard & gestures</span><kbd>?</kbd></button>
  </section>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    border: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 40;
  }

  .drawer {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(360px, 100vw);
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    overflow: auto;
    padding: var(--ui-space-2) var(--ui-space-4) var(--ui-space-4);
    background: var(--ui-raised);
    color: var(--ui-ink);
    box-shadow: 0 16px 48px rgb(0 0 0 / 0.2);
    font-size: var(--ui-text-sm);
    outline: none;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: var(--ui-text-md);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
  }

  h3 {
    display: flex;
    justify-content: space-between;
    gap: var(--ui-space-2);
    margin: 0 0 var(--ui-space-2);
    font-size: var(--ui-text-xs);
    font-weight: 400;
    color: var(--ui-text-3);
  }

  h3 em {
    font-style: normal;
    font-family: var(--ui-mono);
    color: var(--ui-ink-2);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    min-height: 44px;
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-ink);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .row:hover {
    background: var(--ui-hover);
  }

  .row kbd {
    margin-left: auto;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
  }

  .crumbs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    padding: 0 var(--ui-space-1);
  }

  .crumb {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 6px;
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-ink-2);
    font: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  a.crumb:hover,
  button.crumb:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .crumb.current {
    color: var(--ui-ink);
    font-weight: 600;
    cursor: default;
  }

  .slash {
    color: var(--ui-ink-3);
  }

  .save {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 var(--ui-space-2);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
  }

  .save i {
    width: 6px;
    height: 6px;
    background: var(--ui-ok);
  }

  .save[data-tone='busy'] i {
    background: var(--ui-warn);
  }

  .save[data-tone='error'] i {
    background: var(--ui-danger);
  }

  .save[data-tone='error'] {
    color: var(--ui-danger);
  }

  @media (max-width: 599px) {
    .drawer {
      width: 100vw;
      box-shadow: none;
    }
  }
</style>
