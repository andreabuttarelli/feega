<template>
  <section class="fl-team-grid">
    <div class="fl-container head">
      <p class="fl-eyebrow">team</p>
      <h2 class="fl-title">the people behind it</h2>
      <p class="fl-lead">Placeholder people. Replace names, roles and photos.</p>
    </div>
    <ul class="fl-container grid">
      <li><span class="photo" aria-hidden="true">NS</span><b>Name Surname</b><span class="role">Founder</span></li>
      <li><span class="photo" aria-hidden="true">FL</span><b>First Last</b><span class="role">Design</span></li>
      <li><span class="photo" aria-hidden="true">AB</span><b>Alex Example</b><span class="role">Engineering</span></li>
      <li><span class="photo" aria-hidden="true">SP</span><b>Sam Placeholder</b><span class="role">Engineering</span></li>
      <li><span class="photo" aria-hidden="true">RS</span><b>Robin Sample</b><span class="role">Growth</span></li>
      <li><span class="photo" aria-hidden="true">KD</span><b>Kai Demo</b><span class="role">Support</span></li>
    </ul>
  </section>
</template>

<style scoped>
.fl-team-grid{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-team-grid) *,:where(.fl-team-grid) *::before,:where(.fl-team-grid) *::after{box-sizing:border-box}
:where(.fl-team-grid) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-team-grid) a{color:inherit;text-decoration:none}
:where(.fl-team-grid) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-title{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}
.fl-lead{max-width:34rem;font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}
.fl-eyebrow{display:inline-flex;align-items:center;gap:var(--feega-space-2);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0.02em;color:var(--feega-fg-muted);text-transform:uppercase}
.fl-eyebrow::before{content:"";width:6px;height:6px;background:var(--feega-accent)}
.fl-team-grid{padding-block:var(--feega-space-section)}
.fl-team-grid .head{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6);margin-bottom:var(--feega-space-12)}
.fl-team-grid .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(11rem,100%),1fr));gap:var(--feega-space-8) var(--feega-space-4);padding:0;list-style:none}
.fl-team-grid li{display:grid;gap:2px}
.fl-team-grid .photo{display:grid;place-items:center;aspect-ratio:4/5;margin-bottom:var(--feega-space-3);border-radius:var(--feega-radius-md);background:var(--feega-surface);color:var(--feega-fg-subtle);font-size:clamp(2rem,4vw,3rem);font-weight:500;letter-spacing:-0.05em;transition:background-color var(--feega-dur) var(--feega-ease),color var(--feega-dur) var(--feega-ease)}
.fl-team-grid li:hover .photo{background:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-team-grid b{font-weight:500}
.fl-team-grid .role{color:var(--feega-fg-muted);font-size:var(--feega-text-sm)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
