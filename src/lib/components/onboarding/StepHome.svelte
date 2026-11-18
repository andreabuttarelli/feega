<script lang="ts" module>
  const CLOUD_ADDS = ['work on the same canvas with other people, live', 'share a link, leave comments, go back to older versions', 'a built-in AI that designs and generates images and video for you'] as const;
</script>

<script lang="ts">
  import { Connection } from '$lib/onboarding/session.svelte';
  import { Place } from '$lib/onboarding/flow';

  type Props = { place: Place; email: string | null; connection: Connection; onconnect: () => void; oncontinue: () => void };

  let { place = $bindable(Place.Computer), email, connection, onconnect, oncontinue }: Props = $props();

  const CONNECT_LABEL: Readonly<Record<Connection, string>> = {
    [Connection.Idle]: 'connect your account',
    [Connection.Waiting]: 'finish in your browser…',
    [Connection.Failed]: 'try connecting again'
  };
</script>

<h1 id="ob-title" class="ob-title">where should your work live?</h1>
<p class="ob-sub">feega is a canvas where you design screens and turn them into animated videos, by hand or by asking an AI. you are running it on your own computer.</p>

<div class="places">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="place" class:chosen={place === Place.Computer} onmouseenter={() => (place = Place.Computer)} data-testid="onboarding-home-computer">
    <div class="head">
      <strong>this computer</strong>
      <span class="price">free · no account</span>
    </div>
    <p>your work is one file on your disk and works offline. the AI is the assistant you already have, like Claude Code or Cursor.</p>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="place" class:chosen={place === Place.Cloud} onmouseenter={() => (place = Place.Cloud)} data-testid="onboarding-home-cloud">
    <div class="head">
      <strong>Feega Cloud</strong>
      <span class="price">free plan · needs an account</span>
    </div>
    <ul>
      {#each CLOUD_ADDS as line (line)}
        <li>{line}</li>
      {/each}
    </ul>
    {#if email}
      <p class="linked" data-testid="onboarding-connected">connected as {email}</p>
    {:else}
      <button type="button" class="ob-secondary" disabled={connection === Connection.Waiting} onfocus={() => (place = Place.Cloud)} onclick={onconnect} data-testid="onboarding-connect">{CONNECT_LABEL[connection]}</button>
    {/if}
  </div>
</div>

<button type="button" class="ob-primary" onclick={oncontinue} data-testid="onboarding-continue">{email ? 'continue' : 'continue on this computer'}</button>
<p class="ob-foot">you can connect an account later. nothing leaves this computer until you choose to upload it.</p>

<style>
  .places {
    display: grid;
    gap: 8px;
    margin: 0 0 16px;
  }

  .place {
    padding: 16px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
    transition: box-shadow 200ms var(--ui-ease), background 200ms var(--ui-ease);
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

  .place :global(.ob-secondary) {
    margin-top: 12px;
  }

  .linked {
    margin-top: 12px;
    color: var(--ui-text);
    font-weight: 500;
  }
</style>
