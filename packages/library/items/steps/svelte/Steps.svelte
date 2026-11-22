<section class="fl-steps">
  <div class="fl-container head">
    <p class="fl-eyebrow">how it works</p>
    <h2 class="fl-title">three steps, then done</h2>
  </div>
  <ol class="fl-container list">
    <li><span class="n">01</span><span class="ic"><svg class="fl-px" viewBox="0 0 6 5" aria-hidden="true"><path d="M0 0h1v1h-1zM1 1h1v1h-1zM2 2h1v1h-1zM1 3h1v1h-1zM0 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1z" /></svg></span><h3>install</h3><p>Run one command in your project. It finds the framework for you.</p></li>
    <li><span class="n">02</span><span class="ic"><svg class="fl-px" viewBox="0 0 8 9" aria-hidden="true"><path d="M0 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM0 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1z" /></svg></span><h3>select</h3><p>Open the page and click the thing you want to change.</p></li>
    <li><span class="n">03</span><span class="ic"><svg class="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg></span><h3>ship</h3><p>The change is in your source, ready for review.</p></li>
  </ol>
</section>

<style>
.fl-steps{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-steps) *,:where(.fl-steps) *::before,:where(.fl-steps) *::after{box-sizing:border-box}
:where(.fl-steps) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-steps) a{color:inherit;text-decoration:none}
:where(.fl-steps) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-title{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}
.fl-lead{max-width:34rem;font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}
.fl-eyebrow{display:inline-flex;align-items:center;gap:var(--feega-space-2);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0.02em;color:var(--feega-fg-muted);text-transform:uppercase}
.fl-eyebrow::before{content:"";width:6px;height:6px;background:var(--feega-accent)}
.fl-steps{padding-block:var(--feega-space-section)}
.fl-steps .head{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6);margin-bottom:var(--feega-space-12)}
.fl-steps .list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-8);padding:0;list-style:none;counter-reset:none}
.fl-steps li{position:relative;display:grid;gap:var(--feega-space-3);padding-top:var(--feega-space-8);border-top:1px solid var(--feega-line-strong)}
.fl-steps li::before{content:"";position:absolute;top:-4px;left:0;width:7px;height:7px;background:var(--feega-accent)}
.fl-steps .n{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-subtle)}
.fl-steps .ic{display:grid;place-items:center;width:52px;height:52px;margin-block:var(--feega-space-2);border-radius:var(--feega-radius-md);background:var(--feega-surface)}
.fl-steps .ic .fl-px{width:18px}
.fl-steps h3{font-size:clamp(1.75rem,3vw,2.25rem);font-weight:500;letter-spacing:-0.05em;line-height:1}
.fl-steps p{max-width:30ch;color:var(--feega-fg-muted)}
@media (max-width:820px){.fl-steps .list{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
