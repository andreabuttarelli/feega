import './HeroProduct.css';

export function HeroProduct() {
  return (
    <section className="fl-hero-product">
      <div className="fl-container head">
        <p className="fl-eyebrow">for product teams</p>
        <h1 className="title">show the product, not a promise</h1>
        <p className="fl-lead">One sentence on what the screenshot below lets people do. Replace the mockup with a real capture.</p>
        <div className="cta">
          <a className="fl-btn fl-btn--primary" href="#">start free</a>
          <a className="fl-btn" href="#">take the tour <svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></a>
        </div>
      </div>
      <div className="fl-container">
        <figure className="shot fl-dots" aria-label="Product screenshot placeholder">
          <div className="window">
            <div className="chrome"><i></i><i></i><i></i><span>app.example.com</span></div>
            <div className="app">
              <div className="side"><b></b><b></b><b></b><b></b><b></b></div>
              <div className="body">
                <div className="row"><span className="h"></span><span className="pill"></span></div>
                <div className="cards"><span></span><span></span><span></span></div>
                <div className="chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
              </div>
            </div>
          </div>
          <figcaption>screenshot placeholder</figcaption>
        </figure>
      </div>
    </section>
  );
}
