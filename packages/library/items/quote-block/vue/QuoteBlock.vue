<template>
  <section class="fl-quote-block">
    <figure class="fl-container inner">
      <svg class="fl-px" viewBox="0 0 6 4" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM1 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM4 3h1v1h-1z" /></svg>
      <blockquote>
        <p>Replace this with a real quote from a customer. Keep it short, specific, and in their own words.</p>
      </blockquote>
      <figcaption>
        <span class="fl-avatar" aria-hidden="true">NS</span>
        <span class="who"><b>Name Surname</b><span>Role, Company</span></span>
      </figcaption>
    </figure>
  </section>
</template>

<style scoped>
.fl-quote-block{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-quote-block) *,:where(.fl-quote-block) *::before,:where(.fl-quote-block) *::after{box-sizing:border-box}
:where(.fl-quote-block) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-quote-block) a{color:inherit;text-decoration:none}
:where(.fl-quote-block) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}
.fl-quote-block{padding-block:var(--feega-space-section)}
.fl-quote-block .inner{display:grid;justify-items:start;gap:var(--feega-space-8);max-width:60rem}
.fl-quote-block .inner > .fl-px{width:28px;color:var(--feega-accent)}
.fl-quote-block blockquote p{font-family:var(--feega-font-display);font-size:clamp(1.875rem,4.4vw,3.25rem);font-weight:500;line-height:1.05;letter-spacing:-0.045em;text-wrap:balance}
.fl-quote-block figcaption{display:flex;align-items:center;gap:var(--feega-space-3)}
.fl-quote-block .fl-avatar{width:44px;height:44px}
.fl-quote-block .who{display:grid;font-size:var(--feega-text-sm)}
.fl-quote-block .who b{font-weight:600}
.fl-quote-block .who span{color:var(--feega-fg-muted)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
