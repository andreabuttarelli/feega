<script lang="ts">
  import NpxChip from './NpxChip.svelte';
  import { FREE_EDITORS, PLAN } from '../pricing/plan';
  import { APP_URL, DOWNLOAD_MAC_PATH } from '../links';
  import { APPLE_ICON } from '../social-icons';

  let { id }: { id: string } = $props();
</script>

<div class="modes" data-agent-id={id}>
  <div class="mode">
    <div class="head">
      <span class="kicker">on your computer</span>
      <span class="price">free</span>
    </div>
    <p>no account. works with Claude Code, Codex or Cursor.</p>
    <div class="ways">
      <NpxChip />
      <span class="or">or</span>
      <a class="mac" href={DOWNLOAD_MAC_PATH} data-sveltekit-reload>{@html APPLE_ICON}Mac app</a>
    </div>
  </div>

  <div class="mode">
    <div class="head">
      <span class="kicker">in the cloud</span>
      <span class="price">free for {FREE_EDITORS} {PLAN.per}</span>
    </div>
    <p>your team on the same canvas, live. then {PLAN.currency}{PLAN.price} per {PLAN.per} a {PLAN.period}.</p>
    <div class="ways">
      <a class="mac" href={APP_URL}>open in browser</a>
      <span class="faces" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="live">3 editing now</span>
    </div>
  </div>
</div>

<style>
  .modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: calc(100% - 32px);
    max-width: 680px;
    color: #fff;
    text-align: left;
  }

  .mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 18px;
    border-radius: 20px;
    background: rgb(18 18 18 / 0.72);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07);
    backdrop-filter: blur(12px);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .kicker {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .price {
    padding: 3px 8px;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.08);
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    letter-spacing: -0.02em;
    color: rgb(255 255 255 / 0.85);
    white-space: nowrap;
  }

  .mode p {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: rgb(255 255 255 / 0.6);
  }

  .ways {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    min-height: 28px;
  }

  .or {
    font-size: 12px;
    color: rgb(255 255 255 / 0.4);
  }

  .mac {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    background: #222;
    color: #fff;
    font-size: 14px;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .mac:hover {
    background: #2e2e2e;
  }

  .mac :global(svg) {
    width: 14px;
    height: 14px;
  }

  .faces {
    display: flex;
  }

  .faces i {
    width: 22px;
    height: 22px;
    margin-right: -6px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px #121212;
  }

  .faces i:nth-child(1) { background: #ff7373; }
  .faces i:nth-child(2) { background: #0099ff; }
  .faces i:nth-child(3) { background: #ffd84a; }

  .live {
    margin-left: 10px;
    font-size: 12px;
    color: rgb(255 255 255 / 0.6);
  }

  .live::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    border-radius: 50%;
    background: #2fbf71;
    vertical-align: 1px;
  }

  @media (max-width: 809.98px) {
    .modes {
      grid-template-columns: 1fr;
      gap: 0;
      width: 100%;
      overflow: hidden;
      border-radius: 20px;
      background: rgb(18 18 18 / 0.72);
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07);
      backdrop-filter: blur(12px);
    }

    .mode {
      gap: 6px;
      padding: 14px 16px;
      border-radius: 0;
      background: none;
      box-shadow: none;
      backdrop-filter: none;
    }

    .mode + .mode {
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
    }

    .kicker {
      font-size: 14px;
    }

    .mode p {
      font-size: 12.5px;
    }

    .ways :global(.npx) {
      font-size: 14px;
    }

    .mac {
      font-size: 13px;
    }
  }

  @media (max-width: 809.98px) {
    .mode p {
      font-size: 15px;
    }

    .kicker {
      font-size: 16px;
    }

    .live {
      font-size: 14px;
    }
  }
</style>
