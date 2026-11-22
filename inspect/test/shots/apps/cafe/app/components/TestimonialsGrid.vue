<template>
  <section class="fl-testimonials-grid">
    <div class="fl-container head">
      <p class="fl-eyebrow">reviews</p>
      <h2 class="fl-title">what regulars say</h2>
      <p class="fl-lead">Words from the people who drink it every morning.</p>
    </div>
    <ul class="fl-container grid">
      <li><blockquote>The only beans that taste the same on day twenty as on day two.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">ER</span><span><b>Elena Rossi</b><small>Subscriber</small></span></p></li>
      <li><blockquote>Switched the whole office. Nobody asked for the old brand back.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">MW</span><span><b>Marcus Webb</b><small>Office manager</small></span></p></li>
      <li><blockquote>Fruity without being weird. My go to gift.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">SD</span><span><b>Sofia Dias</b><small>Home brewer</small></span></p></li>
      <li><blockquote>Arrives the day after roasting. You can smell it through the bag.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">TH</span><span><b>Tom Hale</b><small>Cafe owner</small></span></p></li>
      <li><blockquote>The washed Huila made me a filter person.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">PN</span><span><b>Priya Nair</b><small>Subscriber</small></span></p></li>
      <li><blockquote>Used to buy supermarket beans. Not any more.</blockquote><p class="who"><span class="fl-avatar" aria-hidden="true">LO</span><span><b>Luis Ortega</b><small>Home brewer</small></span></p></li>
    </ul>
  </section>
</template>

<style scoped>
.fl-testimonials-grid{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-testimonials-grid) *,:where(.fl-testimonials-grid) *::before,:where(.fl-testimonials-grid) *::after{box-sizing:border-box}
:where(.fl-testimonials-grid) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-testimonials-grid) a{color:inherit;text-decoration:none}
:where(.fl-testimonials-grid) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-title{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}
.fl-lead{max-width:34rem;font-size:var(--feega-text-lg);line-height:1.4;color:var(--feega-fg-muted);text-wrap:pretty}
.fl-eyebrow{display:inline-flex;align-items:center;gap:var(--feega-space-2);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0.02em;color:var(--feega-fg-muted);text-transform:uppercase}
.fl-eyebrow::before{content:"";width:6px;height:6px;background:var(--feega-accent)}
.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}
.fl-testimonials-grid{padding-block:var(--feega-space-section)}
.fl-testimonials-grid .head{display:flex;flex-direction:column;align-items:flex-start;gap:var(--feega-space-6);margin-bottom:var(--feega-space-12)}
.fl-testimonials-grid .grid{columns:3 18rem;column-gap:var(--feega-space-3);padding:0;list-style:none}
.fl-testimonials-grid li{display:grid;gap:var(--feega-space-6);margin-bottom:var(--feega-space-3);padding:var(--feega-space-6);border-radius:var(--feega-radius-lg);background:var(--feega-surface);break-inside:avoid}
.fl-testimonials-grid li:nth-child(3n+1){background:var(--feega-raised);box-shadow:inset 0 0 0 1px var(--feega-line)}
.fl-testimonials-grid blockquote{margin:0;font-size:1.125rem;font-weight:500;line-height:1.35;letter-spacing:-0.03em}
.fl-testimonials-grid blockquote::before{content:"“";display:block;height:0.6em;color:var(--feega-accent);font-size:2.5em;line-height:1}
.fl-testimonials-grid .who{display:flex;align-items:center;gap:var(--feega-space-3);font-size:var(--feega-text-sm)}
.fl-testimonials-grid .who span:last-child{display:grid}
.fl-testimonials-grid .who b{font-weight:600}
.fl-testimonials-grid .who small{color:var(--feega-fg-muted)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
