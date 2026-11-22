import './Pagination.css';

export function Pagination() {
  return (
    <nav className="fl-pagination" aria-label="Pagination">
      <a className="step" href="#" aria-label="Previous page"><svg className="fl-px prev" viewBox="0 0 5 3" aria-hidden="true"><path d="M0 0h1v1h-1zM4 0h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1zM2 2h1v1h-1z" /></svg><span>Previous</span></a>
      <ol>
        <li><a href="#">1</a></li>
        <li><a href="#">2</a></li>
        <li><a href="#" aria-current="page">3</a></li>
        <li><a href="#">4</a></li>
        <li className="gap" aria-hidden="true">…</li>
        <li><a href="#">12</a></li>
      </ol>
      <span className="count">Page 3 of 12</span>
      <a className="step" href="#" aria-label="Next page"><span>Next</span><svg className="fl-px next" viewBox="0 0 5 3" aria-hidden="true"><path d="M0 0h1v1h-1zM4 0h1v1h-1zM1 1h1v1h-1zM3 1h1v1h-1zM2 2h1v1h-1z" /></svg></a>
    </nav>
  );
}
