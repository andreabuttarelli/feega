<template>
  <section class="fl-hero-media">
    <div class="fl-container top">
      <h1 class="title">see it in ninety seconds</h1>
      <div class="side">
        <p>Two lines on what the video shows. Keep it under a minute and a half, captions on.</p>
        <a class="fl-btn fl-btn--primary" href="#">get started</a>
      </div>
    </div>
    <div class="fl-container">
      <div class="media fl-dots">
        <span class="label">video placeholder, 16:9</span>
        <button class="play" type="button" aria-label="Play video"><svg class="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M0 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM0 4h1v1h-1z" /></svg></button>
        <span class="time">01:30</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fl-hero-media{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-hero-media) *,:where(.fl-hero-media) *::before,:where(.fl-hero-media) *::after{box-sizing:border-box}
:where(.fl-hero-media) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-hero-media) a{color:inherit;text-decoration:none}
:where(.fl-hero-media) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
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
.fl-hero-media{padding-block:var(--feega-space-section)}
.fl-hero-media .top{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:end;gap:var(--feega-space-8);margin-bottom:var(--feega-space-12)}
.fl-hero-media .title{font-family:var(--feega-font-display);font-size:var(--feega-text-display);font-weight:500;line-height:0.92;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}
.fl-hero-media .side{display:grid;justify-items:start;gap:var(--feega-space-6);color:var(--feega-fg-muted);font-size:var(--feega-text-lg);line-height:1.4}
.fl-hero-media .media{position:relative;display:grid;place-items:center;aspect-ratio:16/9;overflow:hidden;border-radius:var(--feega-radius-lg);background-color:var(--feega-surface)}
.fl-hero-media .label{position:absolute;top:16px;left:18px;font-family:var(--feega-font-mono);font-size:var(--feega-text-xs);color:var(--feega-fg-subtle);text-transform:uppercase}
.fl-hero-media .time{position:absolute;right:18px;bottom:16px;padding:2px 8px;border-radius:var(--feega-radius-xs);background:var(--feega-raised);font-family:var(--feega-font-mono);font-size:var(--feega-text-xs)}
.fl-hero-media .play{display:grid;place-items:center;width:clamp(64px,10vw,104px);aspect-ratio:1;border:0;border-radius:var(--feega-radius-full);background:var(--feega-accent);color:var(--feega-accent-fg);box-shadow:var(--feega-shadow-float);cursor:pointer;transition:transform var(--feega-dur) var(--feega-ease)}
.fl-hero-media .play:hover{transform:scale(1.06)}
.fl-hero-media .play .fl-px{width:28%;margin-left:6%}
@media (max-width:820px){.fl-hero-media .top{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
