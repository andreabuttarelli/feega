<section class="fl-changelog">
  <div class="fl-container head">
    <p class="fl-eyebrow">changelog</p>
    <h2 class="fl-title">what is new</h2>
  </div>
  <ol class="fl-container list">
    <li><time datetime="2026-11-20">Nov 20, 2026</time><div class="entry"><span class="fl-badge fl-badge--accent">new</span><h3>Dark mode everywhere</h3><p>Every page follows the system theme. Pick one in settings to override it.</p></div></li>
    <li><time datetime="2026-11-12">Nov 12, 2026</time><div class="entry"><span class="fl-badge fl-badge--success">improved</span><h3>Faster first load</h3><p>Pages open in half the time on slow connections.</p></div></li>
    <li><time datetime="2026-11-03">Nov 3, 2026</time><div class="entry"><span class="fl-badge fl-badge--danger">fixed</span><h3>Export keeps your fonts</h3><p>Exports no longer fall back to the system font.</p></div></li>
  </ol>
</section>

<style>
.fl-changelog{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-changelog) *,:where(.fl-changelog) *::before,:where(.fl-changelog) *::after{box-sizing:border-box}
:where(.fl-changelog) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-changelog) a{color:inherit;text-decoration:none}
:where(.fl-changelog) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-title{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}
.fl-lead{max-width:34rem;font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}
.fl-eyebrow{display:inline-flex;align-items:center;gap:var(--feega-space-2);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0.02em;color:var(--feega-fg-muted);text-transform:uppercase}
.fl-eyebrow::before{content:"";width:6px;height:6px;background:var(--feega-accent)}
.fl-badge{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 10px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:500;letter-spacing:0;white-space:nowrap}
.fl-badge::before{content:"";width:6px;height:6px;border-radius:var(--feega-radius-full);background:currentColor}
.fl-badge--accent{background:var(--feega-accent-soft);color:var(--feega-accent-text)}
.fl-badge--success{background:var(--feega-success-soft);color:var(--feega-success)}
.fl-badge--danger{background:var(--feega-danger-soft);color:var(--feega-danger)}
.fl-changelog{padding-block:var(--feega-space-section)}
.fl-changelog .head{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6);margin-bottom:var(--feega-space-12)}
.fl-changelog .list{display:grid;padding:0;list-style:none}
.fl-changelog li{display:grid;grid-template-columns:10rem minmax(0,1fr);gap:var(--feega-space-8)}
.fl-changelog time{padding-top:var(--feega-space-6);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-muted);text-transform:uppercase}
.fl-changelog .entry{position:relative;display:grid;justify-items:start;gap:var(--feega-space-2);padding:var(--feega-space-6) 0 var(--feega-space-8) var(--feega-space-8);border-left:1px solid var(--feega-line-strong)}
.fl-changelog .entry::before{content:"";position:absolute;top:calc(var(--feega-space-6) + 8px);left:-4px;width:7px;height:7px;background:var(--feega-accent)}
.fl-changelog h3{font-size:var(--feega-text-xl);font-weight:500;letter-spacing:-0.04em}
.fl-changelog p{max-width:40rem;color:var(--feega-fg-muted)}
@media (max-width:640px){.fl-changelog li{grid-template-columns:minmax(0,1fr);gap:0}.fl-changelog time{padding-left:var(--feega-space-8);border-left:1px solid var(--feega-line-strong)}.fl-changelog .entry{padding-top:var(--feega-space-2)}.fl-changelog .entry::before{top:-14px}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
