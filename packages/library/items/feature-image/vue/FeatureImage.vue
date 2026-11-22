<template>
  <section class="fl-feature-image">
    <div class="fl-container inner">
      <div class="fl-media" role="img" aria-label="Placeholder image"></div>
      <div class="copy">
        <h2 class="fl-title">One feature, explained properly</h2>
        <p class="fl-lead">Say what it does and why it matters in two sentences.</p>
        <ul class="points">
          <li><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10" /></svg><span>First supporting point</span></li>
          <li><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10" /></svg><span>Second supporting point</span></li>
          <li><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10" /></svg><span>Third supporting point</span></li>
        </ul>
        <a class="fl-btn" href="#">Learn more</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--feega-space-2);min-height:40px;padding:0 var(--feega-space-4);border:1px solid var(--feega-line);border-radius:var(--feega-radius-sm);background:var(--feega-raised);color:var(--feega-fg);font:inherit;font-weight:500;text-decoration:none;cursor:pointer}
.fl-btn:hover{background:var(--feega-surface)}
.fl-btn--primary{background:var(--feega-accent);border-color:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-btn--primary:hover{background:var(--feega-accent);opacity:0.9}
.fl-btn[disabled]{opacity:0.5;cursor:not-allowed}
.fl-media{aspect-ratio:4 / 3;border:1px solid var(--feega-line);border-radius:var(--feega-radius-lg);background:linear-gradient(135deg,var(--feega-accent-soft),var(--feega-surface))}
.fl-title{margin:0;font-size:clamp(1.75rem,4.5vw,2.5rem);font-weight:600;letter-spacing:-0.04em;line-height:1.1;text-wrap:balance}
.fl-lead{margin:0;color:var(--feega-fg-muted);font-size:1.125rem;text-wrap:pretty}
.fl-feature-image{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-feature-image *,.fl-feature-image *::before,.fl-feature-image *::after{box-sizing:border-box}
.fl-feature-image a{color:inherit}
.fl-feature-image :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-feature-image{padding-block:var(--feega-space-section)}
.fl-feature-image .inner{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));align-items:center;gap:var(--feega-space-12)}
.fl-feature-image .copy{display:grid;gap:var(--feega-space-4);justify-items:start}
.fl-feature-image .points{display:grid;gap:var(--feega-space-2);margin:0;padding:0;list-style:none}
.fl-feature-image .points li{display:flex;align-items:center;gap:var(--feega-space-3)}
.fl-feature-image .points svg{flex:none;color:var(--feega-accent)}
</style>
