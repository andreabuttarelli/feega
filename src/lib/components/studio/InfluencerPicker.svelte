<script lang="ts">
  import { Check, Plus, UserRound } from '@lucide/svelte';

  type Influencer = { id: string; name: string; cover: string | null; allowed: boolean; why: string };

  let { models, selected, createHref, onchange }: { models: Influencer[]; selected: string[]; createHref: string; onchange: (next: string[]) => void } = $props();

  const ordered = $derived([...models.filter((m) => m.allowed), ...models.filter((m) => !m.allowed)]);

  function toggle(id: string) {
    onchange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
</script>

<div class="gallery" data-testid="studio-influencers">
  {#each ordered as m (m.id)}
    {@const on = selected.includes(m.id)}
    <button type="button" class="card" class:on data-testid={`studio-influencer-${m.id}`} disabled={!m.allowed} aria-pressed={on} onclick={() => toggle(m.id)}>
      {#if m.cover}<img src={m.cover} alt="" loading="lazy" />{:else}<span class="nocover"><UserRound size={28} /></span>{/if}
      <span class="name">{m.name}</span>
      {#if !m.allowed}<span class="why">{m.why}</span>{/if}
      {#if on}<span class="tick"><Check size={14} /></span>{/if}
    </button>
  {/each}
  <a class="card create" href={createHref}>
    <span class="nocover"><Plus size={28} /></span>
    <span class="name">Create an influencer</span>
  </a>
</div>

<style>
  .gallery {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--ui-space-2);
  }
  @media (min-width: 560px) {
    .gallery {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    padding: var(--ui-space-2);
    border: 1px solid var(--ui-divider-strong);
    background: var(--ui-panel);
    color: var(--ui-text);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    border-radius: var(--ui-radius-md);
  }
  .card:hover:not(:disabled) {
    background: var(--ui-wash);
  }
  .card.on {
    border-color: var(--ui-accent);
    outline: 1px solid var(--ui-accent);
    outline-offset: -2px;
  }
  .card:disabled {
    cursor: not-allowed;
  }
  .card:disabled img {
    filter: grayscale(1);
    opacity: 0.5;
  }
  img,
  .nocover {
    width: 100%;
    aspect-ratio: 3 / 4;
    object-fit: cover;
    background: var(--ui-panel-sunken);
    border-radius: var(--ui-radius-md);
  }
  .nocover {
    display: grid;
    place-items: center;
    color: var(--ui-text-tertiary);
  }
  .name {
    font-size: var(--ui-type-body);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .why {
    font-size: var(--ui-type-label);
    color: var(--ui-text-secondary);
  }
  .tick {
    position: absolute;
    top: var(--ui-space-3);
    right: var(--ui-space-3);
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    background: var(--ui-accent-solid);
    color: var(--ui-accent-ink);
    border-radius: var(--ui-radius-md);
  }
</style>
