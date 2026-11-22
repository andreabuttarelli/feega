import './NotificationList.css';

export function NotificationList() {
  return (
    <section className="fl-notification-list" aria-label="Notifications">
      <header><h2>Notifications <span>3</span></h2><a href="#">Mark all as read</a></header>
      <ul>
        <li className="unread"><a href="#"><span className="fl-avatar" aria-hidden="true">NS</span><span className="text"><b>Name Surname</b> commented on <b>Pricing page</b></span><time>2m</time></a></li>
        <li className="unread"><a href="#"><span className="fl-avatar" aria-hidden="true">FL</span><span className="text"><b>First Last</b> published <b>Home</b></span><time>1h</time></a></li>
        <li className="unread"><a href="#"><span className="fl-avatar sys" aria-hidden="true"><svg className="fl-px" viewBox="0 0 9 8" aria-hidden="true"><path d="M4 0h1v1h-1zM3 1h1v1h-1zM4 1h1v1h-1zM5 1h1v1h-1zM2 2h1v1h-1zM3 2h1v1h-1zM5 2h1v1h-1zM6 2h1v1h-1zM2 3h1v1h-1zM3 3h1v1h-1zM5 3h1v1h-1zM6 3h1v1h-1zM1 4h1v1h-1zM2 4h1v1h-1zM3 4h1v1h-1zM5 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM1 5h1v1h-1zM2 5h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM0 6h1v1h-1zM1 6h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM5 6h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM8 6h1v1h-1zM0 7h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1z" /></svg></span><span className="text"><b>Build</b> failed on <b>Blog index</b></span><time>3h</time></a></li>
        <li><a href="#"><span className="fl-avatar" aria-hidden="true">AE</span><span className="text"><b>Alex Example</b> invited you to <b>Website</b></span><time>Yesterday</time></a></li>
      </ul>
    </section>
  );
}
