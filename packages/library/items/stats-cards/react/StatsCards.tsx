import './StatsCards.css';

export function StatsCards() {
  return (
    <section className="fl-stats-cards" aria-label="Key metrics">
      <article className="card"><header><span>Revenue</span><em className="fl-badge fl-badge--success">+8.2%</em></header><p className="v">$48,210</p><div className="spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
      <article className="card"><header><span>Active users</span><em className="fl-badge fl-badge--success">+3.1%</em></header><p className="v">3,904</p><div className="spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
      <article className="card"><header><span>Conversion</span><em className="fl-badge fl-badge--danger">−0.4%</em></header><p className="v">4.6%</p><div className="spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
      <article className="card"><header><span>Open tickets</span><em className="fl-badge fl-badge--accent">5 new</em></header><p className="v">27</p><div className="spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
    </section>
  );
}
