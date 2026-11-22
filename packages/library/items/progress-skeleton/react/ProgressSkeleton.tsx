import './ProgressSkeleton.css';

export function ProgressSkeleton() {
  return (
    <div className="fl-progress-skeleton">
      <div className="bars">
        <label>Uploading <span>64%</span><progress max="100" value="64">64%</progress></label>
        <label>Storage used <span>8.2 of 10 GB</span><progress className="warn" max="100" value="82">82%</progress></label>
        <p className="spin" role="status"><i aria-hidden="true"></i>Building preview…</p>
      </div>
      <div className="skel" aria-busy="true" aria-label="Loading">
        <span className="b img"></span>
        <span className="b line w70"></span>
        <span className="b line"></span>
        <span className="b line w40"></span>
      </div>
    </div>
  );
}
