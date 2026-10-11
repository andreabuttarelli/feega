<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { CutAnswer, type CutReview } from '$lib/motion/cut-review';

  let { review, sheetHref, onanswer }: { review: CutReview; sheetHref: string | null; onanswer: (answer: CutAnswer) => void } = $props();
</script>

<section class="cut" data-testid="cut-review" aria-label={$_('chat.panel.cut.title', { values: { score: review.score } })}>
  <header><strong>{$_('chat.panel.cut.title', { values: { score: review.score } })}</strong></header>
  {#if sheetHref}
    <img src={sheetHref} alt={$_('chat.panel.cut.sheet')} loading="lazy" />
  {/if}
  <ul>
    {#each review.fixes as fix (fix)}
      <li>{fix}</li>
    {/each}
  </ul>
  <footer>
    <button type="button" class="quiet" data-testid="cut-ship" onclick={() => onanswer(CutAnswer.Ship)}>{$_('chat.panel.cut.ship')}</button>
    <button type="button" class="quiet" data-testid="cut-always" onclick={() => onanswer(CutAnswer.ApplyAlways)}>{$_('chat.panel.cut.always')}</button>
    <button type="button" class="go" data-testid="cut-apply" onclick={() => onanswer(CutAnswer.Apply)}>{$_('chat.panel.cut.apply')}</button>
  </footer>
</section>

<style>
  .cut {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper-2, #fafafa);
    font-size: 12.5px;
  }
  img {
    width: 100%;
    display: block;
  }
  ul {
    margin: 0;
    padding-left: 14px;
    line-height: 1.45;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }
  footer button {
    min-height: 30px;
    padding: 0 12px;
    border: 1px solid var(--ink, #1d1d1f);
    font: inherit;
    cursor: pointer;
  }
  .quiet {
    background: transparent;
    color: var(--ink, #1d1d1f);
  }
  .go {
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
  }
</style>
