<header class="fl-top-bar">
  <h1>Projects</h1>
  <form role="search" class="search">
    <input type="search" placeholder="Search" aria-label="Search" />
  </form>
  <button class="avatar" type="button" aria-label="Open account menu">AB</button>
</header>

<style>
.fl-top-bar{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-top-bar *,.fl-top-bar *::before,.fl-top-bar *::after{box-sizing:border-box}
.fl-top-bar a{color:inherit}
.fl-top-bar :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-top-bar{display:flex;align-items:center;gap:var(--feega-space-4);padding:var(--feega-space-3) var(--feega-space-4);border-bottom:1px solid var(--feega-line)}
.fl-top-bar h1{margin:0;font-size:1rem;font-weight:600}
.fl-top-bar .search{flex:1;max-width:24rem;margin-left:auto}
.fl-top-bar .search input{width:100%;min-height:36px;padding:0 var(--feega-space-3);border:1px solid var(--feega-line);border-radius:var(--feega-radius-sm);background:var(--feega-surface);color:var(--feega-fg);font:inherit}
.fl-top-bar .avatar{display:inline-grid;place-items:center;width:2.25rem;height:2.25rem;border:0;border-radius:var(--feega-radius-full);background:var(--feega-accent-soft);color:var(--feega-accent);font:inherit;font-size:0.8125rem;font-weight:600;cursor:pointer}
</style>
