<script lang="ts">
  import { colourOf, displayName, initialOf } from '$lib/realtime/frame-presence';

  let { peers }: { peers: { userId: string; name: string }[] } = $props();
</script>

<ul class="avatars" aria-label="People on this canvas" data-testid="peer-avatars">
  {#each peers as peer (peer.userId)}
    <li style:background={colourOf(peer.userId)} title={displayName(peer.name)} aria-label={displayName(peer.name)}>{initialOf(peer.name)}</li>
  {/each}
</ul>

<style>
  .avatars {
    display: flex;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin-left: -6px;
    border: 2px solid var(--background, white);
    border-radius: 9999px;
    color: white;
    font-size: 12px;
    font-weight: 600;
  }
</style>
