<footer class="fl-footer">
  <div class="fl-container">
    <div class="top">
      <div class="about">
        <a class="brand" href="#" aria-label="Yourbrand home"><svg class="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M2 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM2 4h1v1h-1z" /></svg><span>yourbrand</span></a>
        <p>One line on what the product is and who it is for.</p>
        <p class="status"><span></span>all systems normal</p>
      </div>
      <nav aria-label="Footer" class="cols">
        <div><h3>product</h3><ul><li><a href="#">features</a></li><li><a href="#">pricing</a></li><li><a href="#">changelog</a></li><li><a href="#">roadmap</a></li></ul></div>
        <div><h3>company</h3><ul><li><a href="#">about</a></li><li><a href="#">blog</a></li><li><a href="#">careers</a></li><li><a href="#">contact</a></li></ul></div>
        <div><h3>resources</h3><ul><li><a href="#">docs</a></li><li><a href="#">guides</a></li><li><a href="#">support</a></li><li><a href="#">status</a></li></ul></div>
      </nav>
    </div>
    <p class="word" aria-hidden="true">yourbrand</p>
    <div class="bottom">
      <p>&copy; 2026 Yourbrand</p>
      <ul><li><a href="#">privacy</a></li><li><a href="#">terms</a></li><li><a href="#">cookies</a></li></ul>
    </div>
  </div>
</footer>

<style>
.fl-footer{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-footer) *,:where(.fl-footer) *::before,:where(.fl-footer) *::after{box-sizing:border-box}
:where(.fl-footer) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-footer) a{color:inherit;text-decoration:none}
:where(.fl-footer) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-px{display:block;flex:none;width:1em;height:auto;fill:currentColor;shape-rendering:crispEdges}
.fl-footer{padding-top:var(--feega-space-16);border-top:1px solid var(--feega-line);overflow:hidden}
.fl-footer .top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:var(--feega-space-12)}
.fl-footer .about{display:grid;align-content:start;justify-items:start;gap:var(--feega-space-4)}
.brand{display:inline-flex;align-items:center;gap:10px;font-size:1.125rem;font-weight:600;letter-spacing:-0.04em}
.brand .fl-px{width:16px;color:var(--feega-accent)}
.fl-footer .about > p{max-width:18rem;color:var(--feega-fg-muted)}
.fl-footer .about .status{display:inline-flex;align-items:center;gap:8px;font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);letter-spacing:0;text-transform:uppercase}
.fl-footer .status span{width:6px;height:6px;border-radius:var(--feega-radius-full);background:var(--feega-success);box-shadow:0 0 0 3px var(--feega-success-soft)}
.fl-footer .cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--feega-space-8)}
.fl-footer h3{margin-bottom:var(--feega-space-4);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);font-weight:400;letter-spacing:0.02em;color:var(--feega-fg-subtle);text-transform:uppercase}
.fl-footer ul{display:grid;gap:var(--feega-space-2);padding:0;list-style:none}
.fl-footer .cols a{font-weight:500;transition:color var(--feega-dur-fast) var(--feega-ease)}
.fl-footer .cols a:hover{color:var(--feega-accent-text)}
.fl-footer .word{margin-top:var(--feega-space-16);font-family:var(--feega-font-display);font-size:clamp(4rem,19vw,16rem);font-weight:500;line-height:0.78;letter-spacing:-0.06em;color:var(--feega-surface);white-space:nowrap;user-select:none}
.fl-footer .bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--feega-space-4);padding-block:var(--feega-space-6);border-top:1px solid var(--feega-line);font-size:var(--feega-text-sm);color:var(--feega-fg-muted)}
.fl-footer .bottom ul{display:flex;gap:var(--feega-space-6)}
.fl-footer .bottom a:hover{color:var(--feega-fg)}
@media (max-width:760px){.fl-footer .top{grid-template-columns:minmax(0,1fr)}.fl-footer .cols{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
