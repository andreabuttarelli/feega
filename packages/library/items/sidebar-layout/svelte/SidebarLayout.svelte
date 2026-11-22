<div class="fl-sidebar-layout">
  <aside>
    <a class="brand" href="#">App</a>
    <nav aria-label="App">
      <ul>
        <li><a href="#" aria-current="page">Overview</a></li>
        <li><a href="#">Projects</a></li>
        <li><a href="#">Members</a></li>
        <li><a href="#">Settings</a></li>
      </ul>
    </nav>
  </aside>
  <main>
    <h1>Overview</h1>
    <p>Page content goes here.</p>
  </main>
</div>

<style>
.fl-sidebar-layout{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-sidebar-layout *,.fl-sidebar-layout *::before,.fl-sidebar-layout *::after{box-sizing:border-box}
.fl-sidebar-layout a{color:inherit}
.fl-sidebar-layout :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-sidebar-layout{display:grid;grid-template-columns:14rem 1fr;min-height:24rem}
.fl-sidebar-layout aside{display:grid;align-content:start;gap:var(--feega-space-6);padding:var(--feega-space-4);border-right:1px solid var(--feega-line);background:var(--feega-surface)}
.fl-sidebar-layout .brand{font-weight:700;letter-spacing:-0.03em;text-decoration:none}
.fl-sidebar-layout ul{display:grid;gap:var(--feega-space-1);margin:0;padding:0;list-style:none}
.fl-sidebar-layout nav a{display:block;padding:var(--feega-space-2) var(--feega-space-3);border-radius:var(--feega-radius-sm);color:var(--feega-fg-muted);font-size:0.9375rem;text-decoration:none}
.fl-sidebar-layout nav a:hover{background:var(--feega-raised);color:var(--feega-fg)}
.fl-sidebar-layout nav a[aria-current="page"]{background:var(--feega-accent-soft);color:var(--feega-accent);font-weight:500}
.fl-sidebar-layout main{padding:var(--feega-space-6)}
.fl-sidebar-layout h1{margin:0 0 var(--feega-space-3);font-size:1.5rem;font-weight:600;letter-spacing:-0.03em}
.fl-sidebar-layout main p{margin:0;color:var(--feega-fg-muted)}
@media (max-width:720px){.fl-sidebar-layout{grid-template-columns:1fr}.fl-sidebar-layout aside{border-right:0;border-bottom:1px solid var(--feega-line)}.fl-sidebar-layout ul{grid-auto-flow:column;grid-auto-columns:max-content;overflow-x:auto}}
</style>
