import './HeroBento.css';

export function HeroBento() {
  return (
    <section className="fl-hero-bento">
      <div className="fl-container grid">
        <div className="tile main">
          <p className="tag">yourbrand / 2026</p>
          <h1>build the page your team keeps asking for</h1>
          <div className="cta"><a className="fl-btn fl-btn--primary" href="#">start free</a><a className="fl-btn" href="#">see examples</a></div>
        </div>
        <div className="tile metric"><b>4.2×</b><span>faster to ship, placeholder figure</span></div>
        <div className="tile art fl-dots" aria-hidden="true"><div className="sel" aria-hidden="true"><span className="tag">div.card</span><i></i><i></i><i></i><i></i></div><span className="box"></span></div>
        <div className="tile note"><p>“Replace with a short customer line.”</p><span>Name Surname, Company</span></div>
        <a className="tile go" href="#"><span>read the launch post</span><svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
      </div>
    </section>
  );
}
