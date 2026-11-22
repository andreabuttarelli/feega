import './BlogCards.css';

export function BlogCards() {
  return (
    <section className="fl-blog-cards">
      <div className="fl-container head">
        <p className="fl-eyebrow">blog</p>
        <h2 className="fl-title">latest writing</h2>
      </div>
      <ul className="fl-container grid">
        <li><a href="#"><span className="cover fl-dots"><svg className="fl-px" viewBox="0 0 12 7" aria-hidden="true"><path d="M3 0h1v1h-1zM8 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM7 1h1v1h-1zM8 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM11 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM3 6h1v1h-1zM8 6h1v1h-1z" /></svg></span><span className="meta"><em>guide</em><time dateTime="2026-11-20">Nov 20</time><span>5 min</span></span><h3>A clear title that says what the reader gets</h3></a></li>
        <li><a href="#"><span className="cover fl-dots"><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M6 0h1v1h-1zM7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1z" /></svg></span><span className="meta"><em>story</em><time dateTime="2026-11-20">Nov 20</time><span>5 min</span></span><h3>How one team cut their release time in half</h3></a></li>
        <li><a href="#"><span className="cover fl-dots"><svg className="fl-px" viewBox="0 0 7 7" aria-hidden="true"><path d="M3 0h1v1h-1zM3 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM3 5h1v1h-1zM3 6h1v1h-1z" /></svg></span><span className="meta"><em>update</em><time dateTime="2026-11-20">Nov 20</time><span>5 min</span></span><h3>Everything that shipped this month</h3></a></li>
      </ul>
    </section>
  );
}
