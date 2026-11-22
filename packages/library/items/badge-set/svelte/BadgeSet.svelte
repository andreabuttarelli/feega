<div class="fl-badge-set">
  <div class="row"><span class="fl-badge">Draft</span><span class="fl-badge fl-badge--accent">In review</span><span class="fl-badge fl-badge--success">Live</span><span class="fl-badge fl-badge--danger">Failed</span></div>
  <div class="row"><span class="solid">New</span><span class="count">12</span><span class="count count--accent">3</span><span class="outline">v2.0</span><span class="mono">beta</span></div>
  <div class="row"><span class="tag">design<button type="button" aria-label="Remove design"><svg class="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></button></span><span class="tag">frontend<button type="button" aria-label="Remove frontend"><svg class="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></button></span></div>
</div>

<style>
.fl-badge-set{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-badge-set) *,:where(.fl-badge-set) *::before,:where(.fl-badge-set) *::after{box-sizing:border-box}
:where(.fl-badge-set) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-badge-set) a{color:inherit;text-decoration:none}
:where(.fl-badge-set) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-badge{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 10px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:500;letter-spacing:0;white-space:nowrap}
.fl-badge::before{content:"";width:6px;height:6px;border-radius:var(--feega-radius-full);background:currentColor}
.fl-badge--accent{background:var(--feega-accent-soft);color:var(--feega-accent-text)}
.fl-badge--success{background:var(--feega-success-soft);color:var(--feega-success)}
.fl-badge--danger{background:var(--feega-danger-soft);color:var(--feega-danger)}
.fl-badge-set{display:grid;gap:var(--feega-space-4);padding:var(--feega-space-6) var(--feega-gutter)}
.fl-badge-set .row{display:flex;flex-wrap:wrap;align-items:center;gap:var(--feega-space-2)}
.fl-badge-set .solid,.fl-badge-set .count,.fl-badge-set .outline,.fl-badge-set .mono,.fl-badge-set .tag{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 10px;border-radius:var(--feega-radius-full);font-size:var(--feega-text-xs);font-weight:500;letter-spacing:0}
.fl-badge-set .solid{background:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-badge-set .count{justify-content:center;min-width:24px;padding:0 7px;background:var(--feega-fg);color:var(--feega-bg);font-variant-numeric:tabular-nums}
.fl-badge-set .count--accent{background:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-badge-set .outline{box-shadow:inset 0 0 0 1px var(--feega-line-strong);color:var(--feega-fg-muted)}
.fl-badge-set .mono{border-radius:var(--feega-radius-xs);background:var(--feega-surface);font-family:var(--feega-font-mono);text-transform:uppercase}
.fl-badge-set .tag{padding-right:4px;background:var(--feega-surface);font-size:var(--feega-text-sm)}
.fl-badge-set .tag button{display:grid;place-items:center;width:18px;height:18px;padding:0;border:0;border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg-subtle);cursor:pointer}
.fl-badge-set .tag button:hover{background:var(--feega-line);color:var(--feega-fg)}
.fl-badge-set .tag .fl-px{width:7px}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
