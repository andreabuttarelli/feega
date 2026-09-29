<script lang="ts">
  /**
   * COSA SI PUÒ METTERE SULLA TELA, RESO VISIBILE.
   *
   * Il doppio clic fa la stessa cosa, ma non si scopre: niente sulla tela dice che esiste, e una
   * scorciatoia che nessuno trova vale quanto una funzione che non c'è.
   *
   * DUE GESTI, UNA SOLA CREAZIONE. Il clic dice «mettilo dove capita» e il trascinamento «mettilo
   * QUI» — su una tela il punto conta, ed è la ragione per cui non basta il bottone. Ma la tile la
   * costruisce una funzione sola, in `CanvasFlow`: due strade che se la fabbricano per conto loro
   * divergono al primo campo aggiunto, e il difetto si vede solo su una delle due.
   *
   * E ACCANTO, LA SCHEDA DELLE SCORCIATOIE. Sta qui e non in un ascoltatore suo perché questa è
   * già la barra che rende visibile quel che la tela sa fare: una scorciatoia che nessuno trova
   * vale quanto una funzione che non c'è, e le sole due strade per incontrarla sono il numero nel
   * `title` di ogni voce e questa scheda. Non prende il tasto `?`, che è della scheda globale del
   * prodotto: due ascoltatori sullo stesso tasto aprirebbero due pannelli sovrapposti.
   *
   * COSA SI STA TRASCINANDO VIAGGIA NEL `dataTransfer`, non in una variabile di modulo: durante un
   * trascinamento il puntatore può uscire dalla finestra e rientrare, e uno stato appeso fuori
   * dall'evento sopravvive a un trascinamento annullato — il nodo successivo nascerebbe del tipo
   * sbagliato.
   */
  import Upload from '@lucide/svelte/icons/upload';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import { CANVAS_ADD_BAR, CANVAS_BAR_MAIN, CANVAS_BAR_MORE, ADDABLE_LABEL, type Addable } from '$lib/canvas/addable';
  import { ADDABLE_ICON } from '$lib/canvas/addable-icons';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';

  let { onpick, onupload }: { onpick?: (what: Addable) => void; onupload?: (file: File) => void } = $props();

  let showMore = $state(false);

  const slot = (what: Addable) => CANVAS_ADD_BAR.indexOf(what) + 1;

  function pickMore(what: Addable) {
    showMore = false;
    onpick?.(what);
  }
  let fileInput = $state<HTMLInputElement | null>(null);

  function pickFile() {
    fileInput?.click();
  }

  function fileChosen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) { onupload?.(file); }
    input.value = '';
  }
</script>

<div class="add-bar">
  <span class="tool">
    <button type="button" title="Upload file" aria-label="Upload file" onclick={pickFile}>
      <Upload size={17} strokeWidth={1.7} />
    </button>
    <span class="add-tip" role="tooltip">Upload file</span>
  </span>
  <input
    bind:this={fileInput}
    type="file"
    class="sr-only"
    accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,text/html,text/csv,text/plain,text/markdown,.xml,.rss,.atom,.ipynb"
    onchange={fileChosen}
  />

  {#each CANVAS_BAR_MAIN as what (what)}
    {@const Icon = ADDABLE_ICON[what]}
    <span class="tool">
      <button
        type="button"
        title={`${ADDABLE_LABEL[what]} (${slot(what)})`}
        aria-label={ADDABLE_LABEL[what]}
        draggable="true"
        onclick={() => onpick?.(what)}
        ondragstart={(e) => e.dataTransfer?.setData(CANVAS_DRAG_MEDIUM, what)}
      >
        <Icon size={17} strokeWidth={1.7} />
      </button>
      <span class="add-tip" role="tooltip">{ADDABLE_LABEL[what]}</span>
    </span>
  {/each}

  <span class="tool">
    <button
      type="button"
      class="keys-toggle"
      title="More nodes"
      aria-label="More nodes"
      aria-expanded={showMore}
      onclick={() => (showMore = !showMore)}
    >
      <LayoutGrid size={17} strokeWidth={1.7} />
    </button>
    <span class="add-tip" role="tooltip">More nodes</span>
  </span>

  {#if showMore}
    <div class="more">
      {#each CANVAS_BAR_MORE as what (what)}
        {@const Icon = ADDABLE_ICON[what]}
        <button
          type="button"
          class="more-item"
          title={`${ADDABLE_LABEL[what]} (${slot(what)})`}
          draggable="true"
          onclick={() => pickMore(what)}
          ondragstart={(e) => e.dataTransfer?.setData(CANVAS_DRAG_MEDIUM, what)}
          ondragend={() => (showMore = false)}
        >
          <Icon size={20} strokeWidth={1.6} />
          <span>{ADDABLE_LABEL[what]}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .add-bar {
    position: absolute;
    z-index: 12;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 4px;
    border-radius: 0;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.1);
  }

  .tool {
    position: relative;
    display: inline-flex;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    font: inherit;
    color: var(--ink, #1d1d1f);
    background: none;
    border: none;
    border-radius: 0;
    cursor: grab;
  }
  button:hover,
  button:focus-visible {
    background: var(--paper-2, #f9f9f9);
  }
  button:active {
    cursor: grabbing;
  }

  @media (max-width: 767px) {
    .add-bar {
      left: var(--mobile-bar-inset);
      bottom: calc(var(--mobile-bar-inset) + env(safe-area-inset-bottom, 0px));
      transform: none;
      gap: 0;
      padding: var(--mobile-bar-pad);
      box-shadow: var(--mobile-bar-shadow);
    }
    button {
      min-width: var(--touch-target);
      min-height: var(--touch-target);
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    button:hover {
      background: none;
    }
    button:active,
    .keys-toggle[aria-expanded='true'] {
      background: var(--paper-3, #f4f4f4);
    }
    .add-tip {
      display: none;
    }
    .add-bar .more {
      left: calc(-1 * var(--mobile-bar-pad) - 1px);
      transform: none;
      grid-template-columns: repeat(3, minmax(88px, 1fr));
      max-width: calc(100vw - 2 * var(--mobile-bar-inset));
    }
    .add-bar .more-item {
      font-size: 13px;
      min-height: var(--touch-target);
    }
  }

  .keys-toggle {
    cursor: pointer;
    color: var(--ink-soft, #6e6e73);
  }

  .add-tip {
    position: absolute;
    z-index: 13;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    white-space: nowrap;
    font-size: 11px;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 0;
    box-shadow: 0 4px 14px rgb(0 0 0 / 0.1);
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }
  .tool:hover .add-tip,
  .tool:focus-within .add-tip {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .add-tip {
      transition: none;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .more {
    position: absolute;
    z-index: 13;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: repeat(3, 96px);
    gap: 4px;
    padding: 6px;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
  }
  .more-item {
    display: grid;
    justify-items: center;
    gap: 6px;
    padding: 12px 6px;
    font-size: 11.5px;
    text-align: center;
  }
</style>
