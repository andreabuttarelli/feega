import './FormInputs.css';

export function FormInputs() {
  return (
    <form className="fl-form-inputs" action="#">
      <label className="fl-field" htmlFor="fl-inputs-name">Project name<input className="fl-input" id="fl-inputs-name" type="text" placeholder="My website" /><small>Shown in the sidebar.</small></label>
      <label className="fl-field bad" htmlFor="fl-inputs-url">Domain<input className="fl-input" id="fl-inputs-url" type="text" defaultValue="example" aria-invalid="true" aria-describedby="fl-inputs-url-error" /><small id="fl-inputs-url-error">Enter a full domain, like example.com.</small></label>
      <label className="fl-field" htmlFor="fl-inputs-plan">Plan<select className="fl-input" id="fl-inputs-plan"><option>Starter</option><option>Pro</option><option>Business</option></select></label>
      <label className="fl-field" htmlFor="fl-inputs-notes">Notes<textarea className="fl-input" id="fl-inputs-notes" rows="3" placeholder="Anything we should know"></textarea></label>
      <fieldset><legend>Visibility</legend>
        <label className="radio"><input type="radio" name="fl-inputs-visibility" defaultChecked />Private</label>
        <label className="radio"><input type="radio" name="fl-inputs-visibility" />Team</label>
        <label className="radio"><input type="radio" name="fl-inputs-visibility" />Public</label>
      </fieldset>
      <fieldset><legend>Options</legend>
        <label className="fl-check"><input type="checkbox" defaultChecked />Send me updates</label>
        <label className="toggle"><input className="fl-switch" type="checkbox" defaultChecked />Auto publish</label>
      </fieldset>
    </form>
  );
}
