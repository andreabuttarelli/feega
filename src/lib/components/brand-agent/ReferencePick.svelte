<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Mark, NEXT_MARK, PickState, type PickCard } from '$lib/reference-pick';

  let { card, onpick, onreject }: { card: PickCard; onpick: (marks: Record<string, Mark>, note: string) => void; onreject: (query: string, avoidAll: boolean) => void } = $props();

  let marks = $state<Record<string, Mark>>({});
  let note = $state('');
  let rejecting = $state(false);
  let query = $state('');
  let avoidAll = $state(false);

  const open = $derived(card.state === PickState.Waiting);
  const answeredMarks = $derived(Object.fromEntries([...(card.answer?.follow ?? []).map((c) => [c.id, Mark.Follow]), ...(card.answer?.avoid ?? []).map((c) => [c.id, Mark.Avoid])]) as Record<string, Mark>);
  const shown = $derived(open ? marks : answeredMarks);
  const markOf = (id: string) => shown[id] ?? Mark.Neutral;
  const count = (mark: Mark) => Object.values(shown).filter((m) => m === mark).length;
  const follows = $derived(count(Mark.Follow));
  const ready = $derived(follows >= card.ask.min && follows <= card.ask.max);

  function toggle(id: string) {
    const next = NEXT_MARK[marks[id] ?? Mark.Neutral];
    const full = next === Mark.Follow && follows >= card.ask.max;
    marks = { ...marks, [id]: full ? Mark.Avoid : next };
  }

  function go() {
    if (ready) {
      onpick(marks, note);
    }
  }
</script>

<section class="pick" data-testid="reference-pick" data-state={card.state} aria-label={$_('chat.panel.pick.label')}>
  <header>
    <strong>{card.ask.question}</strong>
    <span class="count" aria-live="polite">
      {#if open}
        {$_('chat.panel.pick.count', { values: { follow: follows, avoid: count(Mark.Avoid) } })}
      {:else}
        {card.answer?.rejected ? $_('chat.panel.pick.rejected') : card.state === PickState.Answered ? $_('chat.panel.pick.answered') : $_('chat.panel.pick.passed')}
      {/if}
    </span>
  </header>
  {#if open}
    <p class="hint">{$_('chat.panel.pick.hint')}</p>
  {/if}

  <ul class="grid">
    {#each card.ask.candidates as candidate (candidate.id)}
      {@const mark = markOf(candidate.id)}
      <li>
        <button
          type="button"
          class="cell"
          data-testid="pick-candidate"
          data-id={candidate.id}
          data-mark={mark}
          aria-pressed={mark !== Mark.Neutral}
          aria-label={`${candidate.title || candidate.id}: ${$_(`chat.panel.pick.${mark}`)}`}
          title={candidate.why ?? candidate.title ?? ''}
          disabled={!open}
          onclick={() => toggle(candidate.id)}
        >
          <img src={candidate.image} alt={candidate.title ?? ''} loading="lazy" referrerpolicy="no-referrer" />
          {#if mark !== Mark.Neutral}
            <span class="badge" aria-hidden="true">
              {#if mark === Mark.Follow}
                <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="2" /></svg>
              {:else}
                <svg viewBox="0 0 16 16" width="12" height="12"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="2" /></svg>
              {/if}
            </span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>

  {#if open && rejecting}
    <div class="reject">
      <input type="text" bind:value={query} placeholder={$_('chat.panel.pick.query')} aria-label={$_('chat.panel.pick.query')} data-testid="pick-query" />
      <label><input type="checkbox" bind:checked={avoidAll} data-testid="pick-avoid-all" /> {$_('chat.panel.pick.avoidAll')}</label>
      <footer>
        <button type="button" class="ghost" onclick={() => (rejecting = false)}>{$_('chat.panel.pick.back')}</button>
        <button type="button" class="go" data-testid="pick-search" onclick={() => onreject(query, avoidAll)}>{$_('chat.panel.pick.search')}</button>
      </footer>
    </div>
  {:else if open}
    <textarea bind:value={note} rows="2" placeholder={$_('chat.panel.pick.note')} aria-label={$_('chat.panel.pick.note')}></textarea>
    <footer>
      <button type="button" class="ghost" data-testid="pick-reject" onclick={() => (rejecting = true)}>{$_('chat.panel.pick.reject')}</button>
      <button type="button" class="go" data-testid="pick-go" disabled={!ready} onclick={go}>{$_('chat.panel.pick.go')}</button>
    </footer>
  {:else if card.answer?.rejected}
    <p class="hint">{card.answer.query ? $_('chat.panel.pick.searchedFor', { values: { query: card.answer.query } }) : $_('chat.panel.pick.searchedOwn')}</p>
  {:else if card.answer?.note}
    <p class="hint">{card.answer.note}</p>
  {/if}
</section>

<style>
  .pick {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper-2, #fafafa);
    font-size: 12.5px;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .count,
  .hint {
    margin: 0;
    color: var(--ink-faint, #86868b);
    font-size: 12px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .cell {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: 2px solid transparent;
    background: var(--line, #ededef);
    cursor: pointer;
    overflow: hidden;
  }
  .cell:disabled {
    cursor: default;
  }
  .cell:focus-visible {
    outline: 2px solid var(--ink, #1d1d1f);
    outline-offset: 2px;
  }
  .cell img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cell[data-mark='follow'] {
    border-color: var(--ink, #1d1d1f);
  }
  .cell[data-mark='avoid'] img {
    opacity: 0.35;
    filter: grayscale(1);
  }
  .cell[data-mark='avoid'] {
    border-color: var(--danger, #d70015);
  }
  .badge {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
  }
  .cell[data-mark='avoid'] .badge {
    background: var(--danger, #d70015);
  }
  textarea {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    color: inherit;
    font: inherit;
    resize: vertical;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }
  .reject {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .reject input[type='text'] {
    width: 100%;
    min-height: 32px;
    padding: 0 8px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    color: inherit;
    font: inherit;
  }
  .reject label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ghost {
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--ink, #1d1d1f);
    background: transparent;
    color: var(--ink, #1d1d1f);
    font: inherit;
    cursor: pointer;
  }
  .go {
    min-height: 32px;
    padding: 0 14px;
    border: 1px solid var(--ink, #1d1d1f);
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
    font: inherit;
    cursor: pointer;
  }
  .go:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
