<template>
  <section class="fl-hero-centered">
    <div class="field fl-dots" aria-hidden="true"></div>
    <div class="fl-container inner">
      <a class="pill" href="#"><span class="new">new</span>version 2.0 is out <svg class="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
      <h1 class="title">the headline that says what you do</h1>
      <p class="lead">One or two sentences on who it is for and what changes for them. Plain words, no buzzwords, under thirty.</p>
      <div class="cta">
        <a class="fl-btn fl-btn--primary" href="#">get started free</a>
        <a class="fl-btn" href="#">book a demo <svg class="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
      </div>
      <ul class="points">
        <li>free to start</li>
        <li>no card needed</li>
        <li>cancel anytime</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.fl-hero-centered{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-hero-centered) *,:where(.fl-hero-centered) *::before,:where(.fl-hero-centered) *::after{box-sizing:border-box}
:where(.fl-hero-centered) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-hero-centered) a{color:inherit;text-decoration:none}
:where(.fl-hero-centered) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
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
.fl-hero-centered{position:relative;overflow:hidden;padding-block:var(--feega-space-section)}
.fl-hero-centered .field{position:absolute;inset:0;-webkit-mask-image:radial-gradient(ellipse 60% 70% at 50% 40%,var(--feega-fg),transparent);mask-image:radial-gradient(ellipse 60% 70% at 50% 40%,var(--feega-fg),transparent)}
.fl-hero-centered .inner{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center}
.fl-hero-centered .pill{display:inline-flex;align-items:center;gap:10px;min-height:34px;padding:0 14px 0 4px;border:1px solid var(--feega-line);border-radius:var(--feega-radius-full);background:var(--feega-raised);color:var(--feega-fg-muted);font-size:var(--feega-text-sm);font-weight:500;transition:border-color var(--feega-dur-fast) var(--feega-ease)}
.fl-hero-centered .pill:hover{border-color:var(--feega-line-strong);color:var(--feega-fg)}
.fl-hero-centered .pill .fl-px{width:9px}
.fl-hero-centered .new{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);font-size:var(--feega-text-xs)}
.fl-hero-centered .title{max-width:14ch;margin-top:var(--feega-space-8);font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:0.92;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}
.fl-hero-centered .lead{max-width:32rem;margin-top:var(--feega-space-6);font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}
.fl-hero-centered .cta{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-3);margin-top:var(--feega-space-8)}
.fl-hero-centered .points{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--feega-space-2) var(--feega-space-6);margin-top:var(--feega-space-8);padding:0;list-style:none;font-size:var(--feega-text-sm);font-weight:500}
.fl-hero-centered .points li{display:inline-flex;align-items:center;gap:10px}
.fl-hero-centered .points li::before{content:"";width:6px;height:6px;background:var(--feega-accent)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
