<script lang="ts">
  let {
    size = 24,
    tone = 'gradient'
  }: {
    size?: number;
    tone?: 'gradient' | 'negative';
  } = $props();
</script>

<svg class="brandmark" width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-mark="feega">
  {#if tone === 'gradient'}
    <defs>
      <linearGradient id="brandmark-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:var(--accent);stop-opacity:1" />
        <stop offset="100%" style="stop-color:var(--accent-2);stop-opacity:1" />
      </linearGradient>
    </defs>
  {/if}
  <path
    d="M1 13.5H5.5C7.5 13.5 7.5 7 12 7C16.5 7 16.5 13.5 18.5 13.5H23M8 13.5A4 4 0 0 0 16 13.5"
    stroke={tone === 'negative' ? 'currentColor' : 'url(#brandmark-gradient)'}
    stroke-width="2.25"
    stroke-linecap="square"
  />
</svg>

<style>
  .brandmark {
    display: block;
    flex: none;
  }
</style>
