import './Steps.css';

export function Steps() {
  return (
    <section className="fl-steps">
      <div className="fl-container head">
        <p className="fl-eyebrow">how it works</p>
        <h2 className="fl-title">three steps, then done</h2>
      </div>
      <ol className="fl-container list">
        <li><span className="n">01</span><span className="ic"><svg className="fl-px" viewBox="0 0 6 5" aria-hidden="true"><path d="M0 0h1v1h-1zM1 1h1v1h-1zM2 2h1v1h-1zM1 3h1v1h-1zM0 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1z" /></svg></span><h3>install</h3><p>Run one command in your project. It finds the framework for you.</p></li>
        <li><span className="n">02</span><span className="ic"><svg className="fl-px" viewBox="0 0 8 9" aria-hidden="true"><path d="M0 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM0 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1z" /></svg></span><h3>select</h3><p>Open the page and click the thing you want to change.</p></li>
        <li><span className="n">03</span><span className="ic"><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM0 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1z" /></svg></span><h3>ship</h3><p>The change is in your source, ready for review.</p></li>
      </ol>
    </section>
  );
}
