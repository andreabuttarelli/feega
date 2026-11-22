<template>
  <section class="fl-empty-state">
    <div class="box fl-dots">
      <div class="art"><svg class="fl-px" viewBox="0 0 10 8" aria-hidden="true"><path d="M1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM6 0h1v1h-1zM7 0h1v1h-1zM8 0h1v1h-1zM1 1h1v1h-1zM8 1h1v1h-1zM0 2h1v1h-1zM9 2h1v1h-1zM0 3h1v1h-1zM9 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM8 4h1v1h-1zM9 4h1v1h-1zM0 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM0 6h1v1h-1zM9 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM9 7h1v1h-1z" /></svg></div>
      <h2>no projects yet</h2>
      <p>Projects keep your pages, assets and people together. Start one from scratch or import what you have.</p>
      <div class="cta">
        <a class="fl-btn fl-btn--primary" href="#">New project</a>
        <a class="fl-btn" href="#">Import</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fl-empty-state{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-empty-state) *,:where(.fl-empty-state) *::before,:where(.fl-empty-state) *::after{box-sizing:border-box}
:where(.fl-empty-state) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-empty-state) a{color:inherit;text-decoration:none}
:where(.fl-empty-state) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--feega-space-2);min-height:44px;padding:0 var(--feega-space-6);border:1px solid var(--feega-line-strong);border-radius:var(--feega-radius-full);background:transparent;color:var(--feega-fg);font:inherit;font-size:0.9375rem;font-weight:500;letter-spacing:var(--feega-tracking);white-space:nowrap;text-decoration:none;cursor:pointer;transition:background-color var(--feega-dur-fast) var(--feega-ease),border-color var(--feega-dur-fast) var(--feega-ease),color var(--feega-dur-fast) var(--feega-ease),transform var(--feega-dur-fast) var(--feega-ease)}
.fl-btn:hover{border-color:var(--feega-fg-subtle);background:var(--feega-surface)}
.fl-btn:active{transform:scale(0.97)}
.fl-btn--primary{border-color:var(--feega-accent);background:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-btn--primary:hover{border-color:var(--feega-accent-hover);background:var(--feega-accent-hover)}
.fl-btn--ink{border-color:var(--feega-fg);background:var(--feega-fg);color:var(--feega-bg)}
.fl-btn--ink:hover{border-color:var(--feega-fg-muted);background:var(--feega-fg-muted)}
.fl-btn--ghost{border-color:transparent}
.fl-btn--sm{min-height:36px;padding:0 var(--feega-space-4);font-size:var(--feega-text-sm)}
.fl-btn .fl-px{width:10px;transition:transform var(--feega-dur) var(--feega-ease)}
.fl-btn:hover .fl-px{transform:translateX(3px)}
.fl-btn[disabled]{opacity:0.45;cursor:not-allowed}
.fl-dots{background-image:radial-gradient(var(--feega-dot) 1px,transparent 1.5px);background-size:14px 14px}
.fl-empty-state{padding:var(--feega-space-6) var(--feega-gutter)}
.fl-empty-state .box{display:flex;flex-direction:column;align-items:center;padding:clamp(3rem,8vw,6rem) var(--feega-space-6);border:1px dashed var(--feega-line-strong);border-radius:var(--feega-radius-lg);text-align:center}
.fl-empty-state .art{display:grid;place-items:center;width:96px;height:96px;margin-bottom:var(--feega-space-8);border-radius:var(--feega-radius-lg);background:var(--feega-raised);color:var(--feega-accent);box-shadow:var(--feega-shadow-float);animation:fl-empty-state-float 4s var(--feega-ease) infinite alternate}
.fl-empty-state .art .fl-px{width:44px}
@keyframes fl-empty-state-float{to{transform:translateY(-6px)}}
.fl-empty-state h2{font-family:var(--feega-font-display);font-size:clamp(2rem,4vw,3rem);font-weight:500;line-height:1;letter-spacing:-0.05em}
.fl-empty-state p{max-width:26rem;margin-top:var(--feega-space-4);color:var(--feega-fg-muted)}
.fl-empty-state .cta{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-2);margin-top:var(--feega-space-8)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
