<script lang="ts">
  import { colourOf, displayName, initialOf } from '$lib/realtime/frame-presence';

  let {
    peers,
    following = null,
    presenting = false,
    onfollow,
    onspotlight
  }: {
    peers: { userId: string; name: string }[];
    following?: string | null;
    presenting?: boolean;
    onfollow?: (userId: string | null) => void;
    onspotlight?: (on: boolean) => void;
  } = $props();
</script>

<ul class="avatars" aria-label="People on this canvas" data-testid="peer-avatars">
  {#each peers as peer (peer.userId)}
    <li>
      <button
        type="button"
        class="avatar"
        class:following={following === peer.userId}
        style:background={colourOf(peer.userId)}
        style:--ring={colourOf(peer.userId)}
        title={following === peer.userId ? `Stop following ${displayName(peer.name)}` : `Follow ${displayName(peer.name)}`}
        aria-label={following === peer.userId ? `Stop following ${displayName(peer.name)}` : `Follow ${displayName(peer.name)}`}
        aria-pressed={following === peer.userId}
        disabled={!onfollow}
        onclick={() => onfollow?.(following === peer.userId ? null : peer.userId)}
      >{initialOf(peer.name)}</button>
    </li>
  {/each}
  {#if onspotlight}
    <li>
      <button type="button" class="spotlight" class:on={presenting} aria-pressed={presenting} data-testid="spotlight" onclick={() => onspotlight(!presenting)}>
        {presenting ? 'Stop presenting' : 'Spotlight me'}
      </button>
    </li>
  {/if}
</ul>

<style>
  .avatars {
    display: flex;
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin-left: -6px;
    padding: 0;
    border: 2px solid var(--ui-surface);
    border-radius: 9999px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .avatar:disabled {
    cursor: default;
  }

  .avatar.following {
    box-shadow: 0 0 0 2px var(--ring);
  }

  .spotlight {
    margin-left: 8px;
    padding: 4px 10px;
    border: 1px solid var(--ui-border, currentColor);
    border-radius: 9999px;
    background: transparent;
    color: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .spotlight.on {
    background: var(--ui-accent, #0090ff);
    color: white;
  }
</style>
