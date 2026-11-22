import './SettingsForm.css';

export function SettingsForm() {
  return (
    <section className="fl-settings-form">
      <form method="post" action="#">
        <header className="head">
          <h1>Profile</h1>
          <p>How other people see you across the workspace.</p>
        </header>
        <div className="row">
          <div className="label"><b>Photo</b><span>Square, at least 256 px.</span></div>
          <div className="control photo"><span className="fl-avatar" aria-hidden="true">NS</span><button className="fl-btn fl-btn--sm" type="button">Upload</button><button className="fl-btn fl-btn--sm fl-btn--ghost" type="button">Remove</button></div>
        </div>
        <div className="row">
          <label className="label" htmlFor="fl-settings-name"><b>Name</b><span>Your full name.</span></label>
          <div className="control"><input className="fl-input" id="fl-settings-name" name="name" defaultValue="Name Surname" autoComplete="name" /></div>
        </div>
        <div className="row">
          <label className="label" htmlFor="fl-settings-email"><b>Email</b><span>Used to log in.</span></label>
          <div className="control"><input className="fl-input" id="fl-settings-email" type="email" name="email" defaultValue="name@example.com" autoComplete="email" /><span className="fl-badge fl-badge--success">Verified</span></div>
        </div>
        <div className="row">
          <label className="label" htmlFor="fl-settings-bio"><b>Bio</b><span>A line or two. Shown on your profile.</span></label>
          <div className="control"><textarea className="fl-input" id="fl-settings-bio" name="bio" rows="3" maxLength="160" placeholder="What you work on"></textarea></div>
        </div>
        <div className="row">
          <div className="label"><b>Email me</b><span>You can change this anytime.</span></div>
          <div className="control toggles">
            <label><input className="fl-switch" type="checkbox" role="switch" name="updates" defaultChecked />Product updates</label>
            <label><input className="fl-switch" type="checkbox" role="switch" name="digest" />Weekly digest</label>
          </div>
        </div>
        <footer className="actions">
          <button className="fl-btn fl-btn--sm fl-btn--ghost" type="reset">Cancel</button>
          <button className="fl-btn fl-btn--sm fl-btn--ink" type="submit">Save changes</button>
        </footer>
      </form>
    </section>
  );
}
