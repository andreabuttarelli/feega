import './Changelog.css';

export function Changelog() {
  return (
    <section className="fl-changelog">
      <div className="fl-container head">
        <p className="fl-eyebrow">changelog</p>
        <h2 className="fl-title">what is new</h2>
      </div>
      <ol className="fl-container list">
        <li><time dateTime="2026-11-20">Nov 20, 2026</time><div className="entry"><span className="fl-badge fl-badge--accent">new</span><h3>Dark mode everywhere</h3><p>Every page follows the system theme. Pick one in settings to override it.</p></div></li>
        <li><time dateTime="2026-11-12">Nov 12, 2026</time><div className="entry"><span className="fl-badge fl-badge--success">improved</span><h3>Faster first load</h3><p>Pages open in half the time on slow connections.</p></div></li>
        <li><time dateTime="2026-11-03">Nov 3, 2026</time><div className="entry"><span className="fl-badge fl-badge--danger">fixed</span><h3>Export keeps your fonts</h3><p>Exports no longer fall back to the system font.</p></div></li>
      </ol>
    </section>
  );
}
