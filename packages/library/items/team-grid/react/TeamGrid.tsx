import './TeamGrid.css';

export function TeamGrid() {
  return (
    <section className="fl-team-grid">
      <div className="fl-container head">
        <p className="fl-eyebrow">team</p>
        <h2 className="fl-title">the people behind it</h2>
        <p className="fl-lead">Placeholder people. Replace names, roles and photos.</p>
      </div>
      <ul className="fl-container grid">
        <li><span className="photo" aria-hidden="true">NS</span><b>Name Surname</b><span className="role">Founder</span></li>
        <li><span className="photo" aria-hidden="true">FL</span><b>First Last</b><span className="role">Design</span></li>
        <li><span className="photo" aria-hidden="true">AB</span><b>Alex Example</b><span className="role">Engineering</span></li>
        <li><span className="photo" aria-hidden="true">SP</span><b>Sam Placeholder</b><span className="role">Engineering</span></li>
        <li><span className="photo" aria-hidden="true">RS</span><b>Robin Sample</b><span className="role">Growth</span></li>
        <li><span className="photo" aria-hidden="true">KD</span><b>Kai Demo</b><span className="role">Support</span></li>
      </ul>
    </section>
  );
}
