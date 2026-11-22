<template>
  <div class="fl-dropdown-menu">
    <details>
      <summary class="fl-btn fl-btn--sm">Options <svg class="fl-px" viewBox="0 0 5 3" aria-hidden="true"><path d="M0 0h1v1h-1zM4 0h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1zM2 2h1v1h-1z" /></svg></summary>
      <ul class="menu" role="menu">
        <li role="none"><a role="menuitem" href="#"><svg class="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM1 0h1v1h-1zM2 0h1v1h-1zM3 0h1v1h-1zM0 1h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM0 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM0 3h1v1h-1zM5 3h1v1h-1zM0 4h1v1h-1zM5 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1z" /></svg>Rename<kbd>R</kbd></a></li>
        <li role="none"><a role="menuitem" href="#"><svg class="fl-px" viewBox="0 0 12 7" aria-hidden="true"><path d="M3 0h1v1h-1zM8 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM7 1h1v1h-1zM8 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM11 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM3 6h1v1h-1zM8 6h1v1h-1z" /></svg>Duplicate<kbd>⌘D</kbd></a></li>
        <li role="none"><a role="menuitem" href="#"><svg class="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM3 3h1v1h-1zM6 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM5 5h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1z" /></svg>Share<kbd>⌘S</kbd></a></li>
        <li class="sep" role="separator"></li>
        <li role="none"><a class="danger" role="menuitem" href="#"><svg class="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg>Delete<kbd>⌫</kbd></a></li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.fl-dropdown-menu{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-dropdown-menu) *,:where(.fl-dropdown-menu) *::before,:where(.fl-dropdown-menu) *::after{box-sizing:border-box}
:where(.fl-dropdown-menu) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-dropdown-menu) a{color:inherit;text-decoration:none}
:where(.fl-dropdown-menu) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
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
.fl-dropdown-menu{min-height:16rem;padding:var(--feega-space-6) var(--feega-gutter)}
.fl-dropdown-menu details{position:relative;display:inline-block}
.fl-dropdown-menu summary{list-style:none}
.fl-dropdown-menu summary::-webkit-details-marker{display:none}
.fl-dropdown-menu summary .fl-px{width:8px;transition:transform var(--feega-dur) var(--feega-ease)}
.fl-dropdown-menu details[open] summary .fl-px{transform:rotate(180deg)}
.fl-dropdown-menu .menu{position:absolute;top:calc(100% + 6px);left:0;z-index:10;display:grid;width:min(14rem,calc(100vw - 2 * var(--feega-gutter)));margin:0;padding:6px;border-radius:var(--feega-radius-md);background:var(--feega-raised);box-shadow:var(--feega-shadow-float),inset 0 0 0 1px var(--feega-line);list-style:none;transform-origin:top left;animation:fl-dropdown-menu-in var(--feega-dur) var(--feega-ease)}
@keyframes fl-dropdown-menu-in{from{opacity:0;transform:scale(0.96) translateY(-4px)}}
.fl-dropdown-menu .menu a{display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:var(--feega-radius-sm);font-size:var(--feega-text-sm);font-weight:500}
.fl-dropdown-menu .menu a:hover,.fl-dropdown-menu .menu a:focus-visible{background:var(--feega-surface);outline:none}
.fl-dropdown-menu .menu .fl-px{width:12px;color:var(--feega-fg-subtle)}
.fl-dropdown-menu kbd{margin-left:auto;font-family:var(--feega-font-mono);font-size:11px;color:var(--feega-fg-subtle)}
.fl-dropdown-menu .sep{height:1px;margin:6px 4px;background:var(--feega-line)}
.fl-dropdown-menu .danger,.fl-dropdown-menu .danger .fl-px{color:var(--feega-danger)}
.fl-dropdown-menu .menu .danger:hover{background:var(--feega-danger-soft)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
