import './StatsBand.css';

export function StatsBand() {
  return (
    <section className="fl-stats-band">
      <dl className="fl-container grid">
        <div><dt>teams using it</dt><dd>12k<span>+</span></dd></div>
        <div><dt>pages shipped</dt><dd>3.4<span>m</span></dd></div>
        <div><dt>median setup</dt><dd>2<span>min</span></dd></div>
        <div><dt>uptime, last 90 days</dt><dd>99.9<span>%</span></dd></div>
      </dl>
      <p className="fl-container note">Placeholder figures. Replace with your own.</p>
    </section>
  );
}
