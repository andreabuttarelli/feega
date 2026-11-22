<template>
  <section class="fl-empty-state">
    <span class="icon"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l2-8h12l2 8v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></svg></span>
    <h2>No projects yet</h2>
    <p>Create your first project to get started.</p>
    <a class="fl-btn fl-btn--primary" href="#">New project</a>
  </section>
</template>

<style scoped>
.fl-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--feega-space-2);min-height:40px;padding:0 var(--feega-space-4);border:1px solid var(--feega-line);border-radius:var(--feega-radius-sm);background:var(--feega-raised);color:var(--feega-fg);font:inherit;font-weight:500;text-decoration:none;cursor:pointer}
.fl-btn:hover{background:var(--feega-surface)}
.fl-btn--primary{background:var(--feega-accent);border-color:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-btn--primary:hover{background:var(--feega-accent);opacity:0.9}
.fl-btn[disabled]{opacity:0.5;cursor:not-allowed}
.fl-empty-state{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-empty-state *,.fl-empty-state *::before,.fl-empty-state *::after{box-sizing:border-box}
.fl-empty-state a{color:inherit}
.fl-empty-state :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-empty-state{display:grid;justify-items:center;gap:var(--feega-space-3);padding:var(--feega-space-12) var(--feega-space-4);text-align:center}
.fl-empty-state .icon{display:inline-grid;place-items:center;width:3rem;height:3rem;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted)}
.fl-empty-state h2{margin:0;font-size:1.125rem;font-weight:600}
.fl-empty-state p{margin:0 0 var(--feega-space-3);max-width:32ch;color:var(--feega-fg-muted)}
</style>
