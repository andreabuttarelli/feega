import './HeroBento.css';

export function HeroBento() {
  return (
    <section className="fl-hero-bento">
      <div className="fl-container grid">
        <div className="tile main">
          <p className="tag">brightside / 2026</p>
          <h1>brands people remember, sites they use</h1>
          <div className="cta"><a className="fl-btn fl-btn--primary" href="#">start a project</a><a className="fl-btn" href="#">see the work</a></div>
        </div>
        <div className="tile metric"><b>3.1×</b><span>more qualified leads after launch</span></div>
        <div className="tile art fl-dots" aria-hidden="true"><div className="sel" aria-hidden="true"><span className="tag">div.card</span><i></i><i></i><i></i><i></i></div><span className="box"></span></div>
        <div className="tile note"><p>“They shipped in six weeks and our sales calls doubled.”</p><span>Dana Lopez, Fieldhouse</span></div>
        <a className="tile go" href="#"><span>read the case study</span><svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
      </div>
    </section>
  );
}
