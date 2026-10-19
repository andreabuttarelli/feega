<script lang="ts">
  import { page } from '$app/state';

  let { title, script, body, loading = 'lazy' }: { title: string; script: string; body: string; loading?: 'lazy' | 'eager' } = $props();

  const srcdoc = $derived(`<!doctype html><html><head><base href="${page.url.origin}/"><style>html,body{margin:0;padding:0;height:100%}body{display:flex;justify-content:center;align-items:center}*{box-sizing:border-box}h1,h2,p{margin:0}body,a{font-family:sans-serif;font-size:12px}</style></head><body><script src="${script}" defer><\/script>${body}</body></html>`);
</script>

<iframe {title} {srcdoc} {loading}></iframe>

<style>
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }
</style>
