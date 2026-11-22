import './SettingsForm.css';

export function SettingsForm() {
  return (
    <form className="fl-settings-form" method="post" action="#">
      <fieldset>
        <legend>Profile</legend>
        <label className="fl-field">Name<input type="text" name="name" autoComplete="name" /></label>
        <label className="fl-field">Email<input type="email" name="email" autoComplete="email" /><span className="hint">Used for sign-in and receipts.</span></label>
      </fieldset>
      <fieldset>
        <legend>Preferences</legend>
        <label className="fl-field">Theme<select name="theme"><option>System</option><option>Light</option><option>Dark</option></select></label>
        <label className="fl-check"><input type="checkbox" name="updates" defaultChecked />Email me product updates</label>
      </fieldset>
      <div className="actions">
        <button className="fl-btn" type="reset">Cancel</button>
        <button className="fl-btn fl-btn--primary" type="submit">Save changes</button>
      </div>
    </form>
  );
}
