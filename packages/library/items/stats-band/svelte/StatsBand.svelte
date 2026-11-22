<section class="fl-stats-band">
  <dl class="fl-container grid">
    <div><dt>teams using it</dt><dd>12k<span>+</span></dd></div>
    <div><dt>pages shipped</dt><dd>3.4<span>m</span></dd></div>
    <div><dt>median setup</dt><dd>2<span>min</span></dd></div>
    <div><dt>uptime, last 90 days</dt><dd>99.9<span>%</span></dd></div>
  </dl>
  <p class="fl-container note">Placeholder figures. Replace with your own.</p>
</section>

<style>
.fl-stats-band{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-stats-band) *,:where(.fl-stats-band) *::before,:where(.fl-stats-band) *::after{box-sizing:border-box}
:where(.fl-stats-band) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-stats-band) a{color:inherit;text-decoration:none}
:where(.fl-stats-band) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-stats-band{padding-block:var(--feega-space-16)}
.fl-stats-band .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-block:1px solid var(--feega-line)}
.fl-stats-band .grid > div{display:flex;flex-direction:column-reverse;justify-content:flex-end;gap:var(--feega-space-3);padding:var(--feega-space-8) var(--feega-space-6)}
.fl-stats-band .grid > div + div{border-left:1px solid var(--feega-line)}
.fl-stats-band dt{font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-muted);text-transform:uppercase}
.fl-stats-band dd{font-size:clamp(3rem,6vw,5rem);font-weight:500;line-height:0.9;letter-spacing:var(--feega-tracking-tight)}
.fl-stats-band dd span{color:var(--feega-accent)}
.fl-stats-band .note{margin-top:var(--feega-space-3);color:var(--feega-fg-subtle);font-size:var(--feega-text-xs)}
@media (max-width:820px){.fl-stats-band .grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fl-stats-band .grid > div:nth-child(3){border-left:0}.fl-stats-band .grid > div:nth-child(n+3){border-top:1px solid var(--feega-line)}}
@media (max-width:420px){.fl-stats-band .grid > div{padding:var(--feega-space-6) var(--feega-space-4)}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
