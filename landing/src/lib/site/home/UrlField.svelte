<script lang="ts">
  import { cloneLink } from '../clone-link';

  let { id }: { id: string } = $props();

  let value = $state('');
  let invalid = $state(false);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const link = cloneLink(value);
    invalid = link === null;
    if (link) {
      window.location.href = link;
    }
  }
</script>

<form class="field" novalidate onsubmit={submit}>
  <label for={id} class="sr">Your website address</label>
  <div class="row">
    <div class="ring" class:invalid>
      <input {id} type="text" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="yourwebsite.com" aria-invalid={invalid} bind:value oninput={() => (invalid = false)} />
    </div>
    <button type="submit" aria-label="Start from your website">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 16V4M10 4L4.5 9.5M10 4L15.5 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
  <p class="helper">{invalid ? 'Type a website address, like yourwebsite.com' : ''}</p>
</form>

<style>
  @property --ring-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
  }

  @keyframes spin {
    to {
      --ring-angle: 360deg;
    }
  }

  .field {
    width: 100%;
    height: 56px;
    font-family: 'BDO Grotesk', 'Inter', sans-serif;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: #fff;
  }

  .row {
    position: relative;
    display: flex;
    width: 100%;
  }

  .ring {
    --ring-base: rgba(255, 255, 255, 0.16);
    flex: 1 1 auto;
    min-width: 0;
    height: 48px;
    padding: 2px;
    border-radius: 100px;
    background: conic-gradient(from var(--ring-angle), var(--ring-base) 0deg, var(--ring-base) 180deg, #ff5100 330deg, #ff5100 345deg, var(--ring-base) 360deg);
    animation: spin 3.5s linear infinite;
    transition: box-shadow 0.2s;
  }

  .ring:hover {
    --ring-base: rgba(255, 255, 255, 0.3);
  }

  .ring:focus-within {
    --ring-base: color-mix(in srgb, #ff5100 55%, transparent);
    box-shadow: 0 0 18px color-mix(in srgb, #ff5100 45%, transparent);
  }

  .ring.invalid {
    animation: none;
    background: #ff7373;
  }

  input {
    display: block;
    width: 100%;
    height: 100%;
    min-width: 0;
    padding: 0 56px 0 20px;
    background: #0b0b0b;
    color: #fff;
    border: 0;
    border-radius: 98px;
    font: inherit;
    font-size: 16px;
    outline: none;
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.55);
  }

  button {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 40px;
    height: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ff5100;
    color: #fff;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
    transition:
      filter 0.15s,
      transform 0.15s;
  }

  button:hover {
    filter: brightness(1.12);
    transform: scale(1.04);
  }

  button:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .helper {
    margin: 8px 0 0;
    font-size: 14px;
    line-height: 1.3;
    color: #ff7373;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .ring {
      animation: none;
      background: #ff5100;
    }
  }
</style>
