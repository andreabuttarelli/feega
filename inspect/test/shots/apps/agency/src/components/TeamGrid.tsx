import './TeamGrid.css';

export function TeamGrid() {
  return (
    <section className="fl-team-grid">
      <div className="fl-container head">
        <p className="fl-eyebrow">studio</p>
        <h2 className="fl-title">the people behind the work</h2>
        <p className="fl-lead">Strategists, designers and engineers working as one small team.</p>
      </div>
      <ul className="fl-container grid">
        <li><span className="photo" aria-hidden="true">IC</span><b>Iris Calder</b><span className="role">Founder</span></li>
        <li><span className="photo" aria-hidden="true">TR</span><b>Tomas Reyes</b><span className="role">Design</span></li>
        <li><span className="photo" aria-hidden="true">AB</span><b>Nina Okafor</b><span className="role">Engineering</span></li>
        <li><span className="photo" aria-hidden="true">LM</span><b>Leo Marchetti</b><span className="role">Engineering</span></li>
        <li><span className="photo" aria-hidden="true">AL</span><b>Ava Lindqvist</b><span className="role">Growth</span></li>
        <li><span className="photo" aria-hidden="true">JP</span><b>Jon Park</b><span className="role">Support</span></li>
      </ul>
    </section>
  );
}
