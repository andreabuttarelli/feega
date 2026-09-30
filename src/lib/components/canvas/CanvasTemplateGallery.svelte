<script lang="ts">
  import { CANVAS_TEMPLATES, type CanvasTemplate } from '$lib/canvas/templates';

  let { onpick }: { onpick: (id: string) => void } = $props();

  const CELL = 20;
  const GAP = 16;
  const PITCH = CELL + GAP;

  const extent = (t: CanvasTemplate) => ({
    w: Math.max(...t.nodes.map((n) => n.col)) * PITCH + CELL,
    h: Math.max(...t.nodes.map((n) => n.row)) * PITCH + CELL
  });

  const centreOf = (t: CanvasTemplate, key: string) => {
    const node = t.nodes.find((n) => n.key === key)!;
    return { x: node.col * PITCH + CELL / 2, y: node.row * PITCH + CELL / 2 };
  };
</script>

<div class="gallery" role="menu" aria-label="Templates">
  {#each CANVAS_TEMPLATES as template (template.id)}
    {@const size = extent(template)}
    <button type="button" class="card" role="menuitem" onclick={() => onpick(template.id)}>
      <svg class="preview" width={size.w} height={size.h} aria-hidden="true">
        {#each template.edges as edge (`${edge.from}-${edge.to}`)}
          {@const from = centreOf(template, edge.from)}
          {@const to = centreOf(template, edge.to)}
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        {/each}
        {#each template.nodes as node (node.key)}
          <rect class={node.type} x={node.col * PITCH} y={node.row * PITCH} width={CELL} height={CELL} />
        {/each}
      </svg>
      <span class="name">{template.name}</span>
      <span class="description">{template.description}</span>
    </button>
  {/each}
</div>

<style>
  .gallery {
    position: absolute;
    z-index: 13;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: repeat(3, 220px);
    gap: 6px;
    max-height: min(70vh, 640px);
    overflow-y: auto;
    padding: 6px;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
  }

  .card {
    display: grid;
    align-content: start;
    gap: 6px;
    padding: 10px;
    text-align: left;
    font: inherit;
    color: var(--ink, #1d1d1f);
    background: none;
    border: 1px solid var(--line, #e5e5ea);
    border-radius: 0;
    cursor: pointer;
  }
  .card:hover,
  .card:focus-visible {
    background: var(--paper-2, #f9f9f9);
  }

  .preview {
    justify-self: center;
    margin: 4px 0;
  }
  line {
    stroke: var(--line-2, #d2d2d7);
    stroke-width: 1.5;
  }
  rect {
    fill: var(--paper, #fff);
    stroke: var(--ink-soft, #6e6e73);
    stroke-width: 1.5;
  }
  rect.image {
    fill: #e8f5ec;
  }
  rect.video {
    fill: #fbe7ef;
  }
  rect.audio {
    fill: #fdf0e0;
  }
  rect.text {
    fill: #e7eefc;
  }

  .name {
    font-size: 12.5px;
    font-weight: 600;
  }
  .description {
    font-size: 11.5px;
    line-height: 1.35;
    color: var(--ink-soft, #6e6e73);
  }

  @media (max-width: 767px) {
    .gallery {
      left: 0;
      transform: none;
      grid-template-columns: repeat(2, minmax(140px, 1fr));
      max-width: calc(100vw - 2 * var(--mobile-bar-inset, 8px));
    }
  }
</style>
