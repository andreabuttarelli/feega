import './Card.css';

export function Card() {
  return (
    <article className="fl-card">
      <a className="link" href="#">
        <div className="media fl-dots" role="img" aria-label="Placeholder cover"><svg className="fl-px" viewBox="0 0 12 7" aria-hidden="true"><path d="M3 0h1v1h-1zM8 0h1v1h-1zM2 1h1v1h-1zM3 1h1v1h-1zM7 1h1v1h-1zM8 1h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM6 2h1v1h-1zM7 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM0 3h1v1h-1zM1 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM11 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM3 6h1v1h-1zM8 6h1v1h-1z" /></svg></div>
        <div className="body">
          <p className="meta"><span>guide</span><span>6 min read</span></p>
          <h3>A clear title that says what the reader gets</h3>
          <p className="excerpt">Two lines of summary. Enough to decide whether to open it, short enough to scan.</p>
          <footer><span className="fl-avatar" aria-hidden="true">NS</span><span>Name Surname</span><svg className="fl-px" viewBox="0 0 7 5" aria-hidden="true"><path d="M4 0h1v1h-1zM5 1h1v1h-1zM0 2h1v1h-1zM1 2h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM4 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM5 3h1v1h-1zM4 4h1v1h-1z" /></svg></footer>
        </div>
      </a>
    </article>
  );
}
