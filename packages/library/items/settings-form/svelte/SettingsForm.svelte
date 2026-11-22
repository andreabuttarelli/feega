<section class="fl-settings-form">
  <form method="post" action="#">
    <header class="head">
      <h1>Profile</h1>
      <p>How other people see you across the workspace.</p>
    </header>
    <div class="row">
      <div class="label"><b>Photo</b><span>Square, at least 256 px.</span></div>
      <div class="control photo"><span class="fl-avatar" aria-hidden="true">NS</span><button class="fl-btn fl-btn--sm" type="button">Upload</button><button class="fl-btn fl-btn--sm fl-btn--ghost" type="button">Remove</button></div>
    </div>
    <div class="row">
      <label class="label" for="fl-settings-name"><b>Name</b><span>Your full name.</span></label>
      <div class="control"><input class="fl-input" id="fl-settings-name" name="name" value="Name Surname" autocomplete="name" /></div>
    </div>
    <div class="row">
      <label class="label" for="fl-settings-email"><b>Email</b><span>Used to log in.</span></label>
      <div class="control"><input class="fl-input" id="fl-settings-email" type="email" name="email" value="name@example.com" autocomplete="email" /><span class="fl-badge fl-badge--success">Verified</span></div>
    </div>
    <div class="row">
      <label class="label" for="fl-settings-bio"><b>Bio</b><span>A line or two. Shown on your profile.</span></label>
      <div class="control"><textarea class="fl-input" id="fl-settings-bio" name="bio" rows="3" maxlength="160" placeholder="What you work on"></textarea></div>
    </div>
    <div class="row">
      <div class="label"><b>Email me</b><span>You can change this anytime.</span></div>
      <div class="control toggles">
        <label><input class="fl-switch" type="checkbox" role="switch" name="updates" checked />Product updates</label>
        <label><input class="fl-switch" type="checkbox" role="switch" name="digest" />Weekly digest</label>
      </div>
    </div>
    <footer class="actions">
      <button class="fl-btn fl-btn--sm fl-btn--ghost" type="reset">Cancel</button>
      <button class="fl-btn fl-btn--sm fl-btn--ink" type="submit">Save changes</button>
    </footer>
  </form>
</section>

<style>
.fl-settings-form{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-settings-form) *,:where(.fl-settings-form) *::before,:where(.fl-settings-form) *::after{box-sizing:border-box}
:where(.fl-settings-form) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-settings-form) a{color:inherit;text-decoration:none}
:where(.fl-settings-form) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
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
.fl-field{display:grid;gap:var(--feega-space-2);font-size:var(--feega-text-sm);font-weight:500}
.fl-input{width:100%;min-height:44px;padding:0 var(--feega-space-4);border:1px solid var(--feega-line);border-radius:var(--feega-radius-md);background:var(--feega-input);color:var(--feega-fg);font:inherit;font-size:var(--feega-text-body);font-weight:400;letter-spacing:var(--feega-tracking);transition:border-color var(--feega-dur-fast) var(--feega-ease),box-shadow var(--feega-dur-fast) var(--feega-ease)}
.fl-input::placeholder{color:var(--feega-fg-subtle)}
.fl-input:hover{border-color:var(--feega-line-strong)}
.fl-input:focus{outline:none;border-color:var(--feega-accent);box-shadow:0 0 0 4px var(--feega-accent-soft)}
.fl-switch{appearance:none;position:relative;flex:none;width:40px;height:24px;margin:0;border-radius:var(--feega-radius-full);background:var(--feega-line-strong);cursor:pointer;transition:background-color var(--feega-dur) var(--feega-ease)}
.fl-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:var(--feega-radius-full);background:var(--feega-raised);box-shadow:var(--feega-shadow);transition:transform var(--feega-dur) var(--feega-ease)}
.fl-switch:checked{background:var(--feega-accent)}
.fl-switch:checked::after{transform:translateX(16px)}
.fl-avatar{display:inline-grid;flex:none;place-items:center;width:32px;height:32px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:600;letter-spacing:0}
.fl-badge{display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:0 10px;border-radius:var(--feega-radius-full);background:var(--feega-surface);color:var(--feega-fg-muted);font-size:var(--feega-text-xs);font-weight:500;letter-spacing:0;white-space:nowrap}
.fl-badge::before{content:"";width:6px;height:6px;border-radius:var(--feega-radius-full);background:currentColor}
.fl-badge--accent{background:var(--feega-accent-soft);color:var(--feega-accent-text)}
.fl-badge--success{background:var(--feega-success-soft);color:var(--feega-success)}
.fl-badge--danger{background:var(--feega-danger-soft);color:var(--feega-danger)}
.fl-settings-form{padding:clamp(1.5rem,5vw,4rem) var(--feega-gutter)}
.fl-settings-form form{max-width:48rem;margin-inline:auto}
.fl-settings-form .head{display:grid;gap:var(--feega-space-2);padding-bottom:var(--feega-space-8)}
.fl-settings-form h1{font-family:var(--feega-font-display);font-size:clamp(2.5rem,5vw,3.5rem);font-weight:600;line-height:0.95;letter-spacing:-0.05em}
.fl-settings-form .head p{color:var(--feega-fg-muted)}
.fl-settings-form .row{display:grid;grid-template-columns:minmax(0,15rem) minmax(0,1fr);gap:var(--feega-space-4) var(--feega-space-8);padding-block:var(--feega-space-6);border-top:1px solid var(--feega-line)}
.fl-settings-form .label{display:grid;align-content:start;gap:2px;font-size:var(--feega-text-sm)}
.fl-settings-form .label b{font-weight:500}
.fl-settings-form .label span{color:var(--feega-fg-muted)}
.fl-settings-form .control{display:flex;flex-wrap:wrap;align-items:center;gap:var(--feega-space-3)}
.fl-settings-form .control .fl-input{flex:1 1 14rem}
.fl-settings-form textarea.fl-input{min-height:96px;padding-block:12px;resize:vertical}
.fl-settings-form .photo .fl-avatar{width:56px;height:56px;font-size:var(--feega-text-sm)}
.fl-settings-form .toggles{display:grid;gap:var(--feega-space-4)}
.fl-settings-form .toggles label{display:flex;align-items:center;gap:var(--feega-space-3);font-size:var(--feega-text-sm);font-weight:500;cursor:pointer}
.fl-settings-form .actions{display:flex;justify-content:flex-end;gap:var(--feega-space-2);padding-top:var(--feega-space-6);border-top:1px solid var(--feega-line)}
@media (max-width:640px){.fl-settings-form .row{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
