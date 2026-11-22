<template>
  <footer class="fl-footer">
    <div class="fl-container">
      <div class="top">
        <div class="about">
          <a class="brand" href="#">Brand</a>
          <p>A one-line description of what you make.</p>
        </div>
        <nav aria-label="Product"><h2>Product</h2><ul><li><a href="#">Features</a></li><li><a href="#">Pricing</a></li><li><a href="#">Changelog</a></li></ul></nav>
        <nav aria-label="Company"><h2>Company</h2><ul><li><a href="#">About</a></li><li><a href="#">Blog</a></li><li><a href="#">Contact</a></li></ul></nav>
        <nav aria-label="Legal"><h2>Legal</h2><ul><li><a href="#">Privacy</a></li><li><a href="#">Terms</a></li></ul></nav>
      </div>
      <p class="legal">Brand. All rights reserved.</p>
    </div>
  </footer>
</template>

<style scoped>
.fl-container{width:min(var(--feega-max-width),100% - 2 * var(--feega-gutter));margin-inline:auto}
.fl-footer{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-footer *,.fl-footer *::before,.fl-footer *::after{box-sizing:border-box}
.fl-footer a{color:inherit}
.fl-footer :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-footer{padding-block:var(--feega-space-12) var(--feega-space-8);border-top:1px solid var(--feega-line)}
.fl-footer .top{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr));gap:var(--feega-space-8)}
.fl-footer .about{grid-column:span 2}
.fl-footer .brand{font-weight:700;font-size:1.125rem;letter-spacing:-0.03em;text-decoration:none}
.fl-footer .about p{margin:var(--feega-space-2) 0 0;max-width:28ch;color:var(--feega-fg-muted)}
.fl-footer h2{margin:0 0 var(--feega-space-3);font-size:0.875rem;font-weight:600}
.fl-footer ul{display:grid;gap:var(--feega-space-2);margin:0;padding:0;list-style:none}
.fl-footer nav a{color:var(--feega-fg-muted);text-decoration:none}
.fl-footer nav a:hover{color:var(--feega-fg)}
.fl-footer .legal{margin:var(--feega-space-12) 0 0;color:var(--feega-fg-muted);font-size:0.875rem}
@media (max-width:480px){.fl-footer .about{grid-column:1 / -1}}
</style>
