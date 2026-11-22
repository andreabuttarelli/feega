import './BentoGrid.css';

export function BentoGrid() {
  return (
    <section className="fl-bento-grid">
      <div className="fl-container head">
        <p className="fl-eyebrow">features</p>
        <h2 className="fl-title">everything in one place</h2>
      </div>
      <ul className="fl-container grid">
        <li className="big fl-dots"><div className="art"><span className="win"><i></i><i></i><i></i></span><span className="cur"><svg className="fl-px" viewBox="0 0 8 9" aria-hidden="true"><path d="M0 0h1v1h-1zM0 1h1v1h-1zM1 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM0 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1z" /></svg></span></div><h3>edit where it runs</h3><p>Click anything on the live page and change it in place.</p></li>
        <li className="tall"><span className="ic"><svg className="fl-px" viewBox="0 0 6 7" aria-hidden="true"><path d="M4 0h1v1h-1zM5 0h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1z" /></svg></span><h3>instant</h3><p>Changes show before you let go of the mouse.</p><div className="meter"><i></i></div></li>
        <li><span className="ic"><svg className="fl-px" viewBox="0 0 8 8" aria-hidden="true"><path d="M2 0h1v1h-1zM3 0h1v1h-1zM4 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM5 1h1v1h-1zM6 1h1v1h-1zM1 2h1v1h-1zM6 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1z" /></svg></span><h3>private</h3><p>Nothing leaves your machine.</p></li>
        <li><span className="ic"><svg className="fl-px" viewBox="0 0 12 7" aria-hidden="true"><path d="M3 0h1v1h-1zM8 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM7 1h1v1h-1zM8 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM11 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM3 6h1v1h-1zM8 6h1v1h-1z" /></svg></span><h3>your components</h3><p>Uses the ones you have.</p></li>
        <li className="wide accent"><span className="ic"><svg className="fl-px" viewBox="0 0 8 6" aria-hidden="true"><path d="M6 0h1v1h-1zM7 0h1v1h-1zM6 1h1v1h-1zM7 1h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM3 3h1v1h-1zM4 3h1v1h-1zM6 3h1v1h-1zM7 3h1v1h-1zM0 4h1v1h-1zM1 4h1v1h-1zM3 4h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM0 5h1v1h-1zM1 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1z" /></svg></span><h3>see what moved</h3><p>Every change gets a before and after.</p><b>+38%</b></li>
      </ul>
    </section>
  );
}
