<template>
  <section class="fl-cta-minimal">
    <a class="fl-container row" href="#">
      <span class="text">ready when you are</span>
      <span class="go"><svg class="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></span>
    </a>
  </section>
</template>

<style scoped>
.fl-cta-minimal{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-cta-minimal) *,:where(.fl-cta-minimal) *::before,:where(.fl-cta-minimal) *::after{box-sizing:border-box}
:where(.fl-cta-minimal) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-cta-minimal) a{color:inherit;text-decoration:none}
:where(.fl-cta-minimal) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-cta-minimal{padding-block:var(--feega-space-12)}
.fl-cta-minimal .row{display:flex;align-items:center;justify-content:space-between;gap:var(--feega-space-6);padding-block:var(--feega-space-8);border-block:1px solid var(--feega-line)}
.fl-cta-minimal .text{font-size:clamp(2.25rem,7vw,6rem);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);transition:color var(--feega-dur) var(--feega-ease)}
.fl-cta-minimal .go{display:grid;flex:none;place-items:center;width:clamp(56px,9vw,96px);aspect-ratio:1;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);transition:transform var(--feega-dur) var(--feega-ease)}
.fl-cta-minimal .go .fl-px{width:32%}
.fl-cta-minimal .row:hover .go{transform:rotate(-45deg)}
.fl-cta-minimal .row:hover .text{color:var(--feega-accent-text)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
