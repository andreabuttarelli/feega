import './HeroCentered.css';

export function HeroCentered() {
  return (
    <section className="fl-hero-centered">
      <div className="field fl-dots" aria-hidden="true"></div>
      <div className="fl-container inner">
        <a className="pill" href="#"><span className="new">new</span>version 2.0 is out <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
        <h1 className="title">the headline that says what you do</h1>
        <p className="lead">One or two sentences on who it is for and what changes for them. Plain words, no buzzwords, under thirty.</p>
        <div className="cta">
          <a className="fl-btn fl-btn--primary" href="#">get started free</a>
          <a className="fl-btn" href="#">book a demo <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
        </div>
        <ul className="points">
          <li>free to start</li>
          <li>no card needed</li>
          <li>cancel anytime</li>
        </ul>
      </div>
    </section>
  );
}
