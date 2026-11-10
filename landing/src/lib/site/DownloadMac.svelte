<script lang="ts">
  import { DOWNLOAD_MAC_PATH } from './links';
  import { APPLE_ICON } from './social-icons';

  let { class: className = '' }: { class?: string } = $props();
</script>

<a class={className} href={DOWNLOAD_MAC_PATH} aria-label="Download for macOS" data-sveltekit-reload>
  {@html APPLE_ICON}<span>Download</span>
</a>
