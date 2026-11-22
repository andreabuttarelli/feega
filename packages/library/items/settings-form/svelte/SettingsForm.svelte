<form class="fl-settings-form" method="post" action="#">
  <fieldset>
    <legend>Profile</legend>
    <label class="fl-field">Name<input type="text" name="name" autocomplete="name" /></label>
    <label class="fl-field">Email<input type="email" name="email" autocomplete="email" /><span class="hint">Used for sign-in and receipts.</span></label>
  </fieldset>
  <fieldset>
    <legend>Preferences</legend>
    <label class="fl-field">Theme<select name="theme"><option>System</option><option>Light</option><option>Dark</option></select></label>
    <label class="fl-check"><input type="checkbox" name="updates" checked />Email me product updates</label>
  </fieldset>
  <div class="actions">
    <button class="fl-btn" type="reset">Cancel</button>
    <button class="fl-btn fl-btn--primary" type="submit">Save changes</button>
  </div>
</form>

<style>
.fl-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--feega-space-2);min-height:40px;padding:0 var(--feega-space-4);border:1px solid var(--feega-line);border-radius:var(--feega-radius-sm);background:var(--feega-raised);color:var(--feega-fg);font:inherit;font-weight:500;text-decoration:none;cursor:pointer}
.fl-btn:hover{background:var(--feega-surface)}
.fl-btn--primary{background:var(--feega-accent);border-color:var(--feega-accent);color:var(--feega-accent-fg)}
.fl-btn--primary:hover{background:var(--feega-accent);opacity:0.9}
.fl-btn[disabled]{opacity:0.5;cursor:not-allowed}
.fl-field{display:grid;gap:var(--feega-space-1);font-size:0.875rem;font-weight:500}
.fl-field input,.fl-field select,.fl-field textarea{width:100%;min-height:40px;padding:0 var(--feega-space-3);border:1px solid var(--feega-line);border-radius:var(--feega-radius-sm);background:var(--feega-surface);color:var(--feega-fg);font:inherit;font-weight:400}
.fl-field input:hover,.fl-field select:hover{border-color:var(--feega-fg-muted)}
.fl-field .hint{font-weight:400;color:var(--feega-fg-muted)}
.fl-check{display:flex;align-items:center;gap:var(--feega-space-2);font-size:0.875rem}
.fl-check input{width:1.125rem;height:1.125rem;accent-color:var(--feega-accent)}
.fl-settings-form{font-family:var(--feega-font);line-height:1.5;color:var(--feega-fg);background:var(--feega-bg)}
.fl-settings-form *,.fl-settings-form *::before,.fl-settings-form *::after{box-sizing:border-box}
.fl-settings-form a{color:inherit}
.fl-settings-form :focus-visible{outline:2px solid var(--feega-focus);outline-offset:2px}
.fl-settings-form{display:grid;gap:var(--feega-space-6);max-width:36rem;padding:var(--feega-space-6)}
.fl-settings-form fieldset{display:grid;gap:var(--feega-space-4);margin:0;padding:var(--feega-space-6);border:1px solid var(--feega-line);border-radius:var(--feega-radius-md)}
.fl-settings-form legend{padding:0 var(--feega-space-2);font-weight:600}
.fl-settings-form .actions{display:flex;justify-content:flex-end;gap:var(--feega-space-2)}
</style>
