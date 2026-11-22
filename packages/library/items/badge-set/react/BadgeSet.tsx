import './BadgeSet.css';

export function BadgeSet() {
  return (
    <div className="fl-badge-set">
      <div className="row"><span className="fl-badge">Draft</span><span className="fl-badge fl-badge--accent">In review</span><span className="fl-badge fl-badge--success">Live</span><span className="fl-badge fl-badge--danger">Failed</span></div>
      <div className="row"><span className="solid">New</span><span className="count">12</span><span className="count count--accent">3</span><span className="outline">v2.0</span><span className="mono">beta</span></div>
      <div className="row"><span className="tag">design<button type="button" aria-label="Remove design"><svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></button></span><span className="tag">frontend<button type="button" aria-label="Remove frontend"><svg className="fl-px" viewBox="0 0 6 6" aria-hidden="true"><path d="M0 0h1v1h-1zM5 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM1 4h1v1h-1zM4 4h1v1h-1zM0 5h1v1h-1zM5 5h1v1h-1z" /></svg></button></span></div>
    </div>
  );
}
