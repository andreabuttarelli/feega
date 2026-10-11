<script lang="ts">
  type Tone = 'sand' | 'warm' | 'cool';

  let { tone = 'sand' }: { tone?: Tone } = $props();

  const TONES: Record<Tone, { back: string; shoe: string; sole: string }> = {
    sand: { back: '#e9e2d6', shoe: '#1d1d1f', sole: '#f5f5f2' },
    warm: { back: '#f3d9c4', shoe: '#e4572e', sole: '#fff' },
    cool: { back: '#d5e3ee', shoe: '#f5f5f2', sole: '#1d1d1f' }
  };

  const look = $derived(TONES[tone]);
</script>

<svg class="picture" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="100" height="100" fill={look.back} />
  <ellipse cx="52" cy="70" rx="34" ry="4" fill="#000" opacity="0.12" />
  <path d="M18 62 C18 52 26 44 34 44 L44 44 C48 50 56 52 64 52 C74 52 84 56 86 62 L86 66 L18 66 Z" fill={look.shoe} />
  <path d="M16 66 L88 66 L88 70 C70 72 34 72 16 70 Z" fill={look.sole} />
  <path d="M40 48 L46 46 M44 52 L50 50 M48 55 L54 53" stroke={look.sole} stroke-width="1.6" stroke-linecap="square" />
</svg>

<style>
  .picture {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
