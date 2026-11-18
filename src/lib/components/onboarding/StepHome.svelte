<script lang="ts" module>
  const CLOUD_ADDS = ['work on the same canvas with other people, live', 'share a link, leave comments, go back to older versions', 'the built-in AI chat and image and video generation, on your plan’s credits'] as const;
</script>

<script lang="ts">
  import { Place } from '$lib/onboarding/flow';

  type Props = { place: Place; email: string; oncontinue: () => void; oncloud: () => void };

  let { place = $bindable(Place.Computer), email, oncontinue, oncloud }: Props = $props();

  const GO: Readonly<Record<Place, { label: string; run: () => void }>> = {
    [Place.Computer]: { label: 'continue on this computer', run: () => oncontinue() },
    [Place.Cloud]: { label: 'open feega cloud', run: () => oncloud() }
  };
</script>

<h1 id="ob-title" class="ob-title">where should your work live?</h1>
<p class="ob-sub" data-testid="onboarding-connected">connected as {email}. keep working on this computer, or open feega cloud in your browser.</p>

<div class="places">
  <label class="place" class:chosen={place === Place.Computer} data-testid="onboarding-home-computer">
    <input class="pick" type="radio" name="place" value={Place.Computer} bind:group={place} />
    <div class="head">
      <strong>this computer</strong>
      <span class="price">free · offline</span>
    </div>
    <p>your work is one file on your disk. the AI chat is the assistant you already have, like Claude Code or Codex, on your plan with it.</p>
  </label>

  <label class="place" class:chosen={place === Place.Cloud} data-testid="onboarding-home-cloud">
    <input class="pick" type="radio" name="place" value={Place.Cloud} bind:group={place} />
    <div class="head">
      <strong>Feega Cloud</strong>
      <span class="price">your account</span>
    </div>
    <ul>
      {#each CLOUD_ADDS as line (line)}
        <li>{line}</li>
      {/each}
    </ul>
    <p>to move this canvas there, import its .feega file.</p>
  </label>
</div>

<button type="button" class="ob-primary" onclick={GO[place].run} data-testid="onboarding-continue">{GO[place].label}</button>

<style>
  .places {
    display: grid;
    gap: 8px;
    margin: 0 0 16px;
  }

  .place {
    position: relative;
    padding: 16px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
    transition: box-shadow 200ms var(--ui-ease), background 200ms var(--ui-ease);
  }

  .place {
    display: block;
    cursor: pointer;
  }

  .pick {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .place:has(.pick:focus-visible) {
    outline: 2px solid var(--ui-ring);
    outline-offset: 2px;
  }

  .place.chosen {
    background: var(--ui-wash);
    box-shadow: inset 0 0 0 1.5px var(--ui-text);
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  strong {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .price {
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-text-secondary);
  }

  p,
  ul {
    margin: 6px 0 0;
    padding: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ui-text-secondary);
    list-style: none;
  }

  li {
    position: relative;
    padding-left: 18px;
  }

  li::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 5px;
    width: 8px;
    height: 4px;
    border-left: 1.5px solid var(--ui-text);
    border-bottom: 1.5px solid var(--ui-text);
    transform: rotate(-45deg);
  }

</style>
