import './HeroMedia.css';

export function HeroMedia() {
  return (
    <section className="fl-hero-media">
      <div className="fl-container top">
        <h1 className="title">see it in ninety seconds</h1>
        <div className="side">
          <p>Two lines on what the video shows. Keep it under a minute and a half, captions on.</p>
          <a className="fl-btn fl-btn--primary" href="#">get started</a>
        </div>
      </div>
      <div className="fl-container">
        <div className="media fl-dots">
          <span className="label">video placeholder, 16:9</span>
          <button className="play" type="button" aria-label="Play video"><svg className="fl-px" viewBox="0 0 5 5" aria-hidden="true"><path d="M0 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM0 4h1v1h-1z" /></svg></button>
          <span className="time">01:30</span>
        </div>
      </div>
    </section>
  );
}
