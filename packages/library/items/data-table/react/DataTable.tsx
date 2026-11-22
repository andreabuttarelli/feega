import './DataTable.css';

export function DataTable() {
  return (
    <div className="fl-data-table" role="region" aria-label="Projects table" tabIndex="0">
      <table>
        <caption>Projects</caption>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col" className="num">Updated</th></tr>
        </thead>
        <tbody>
          <tr><th scope="row">Project one</th><td><span className="fl-badge">Active</span></td><td>Owner one</td><td className="num">2 days ago</td></tr>
          <tr><th scope="row">Project two</th><td><span className="fl-badge">Draft</span></td><td>Owner two</td><td className="num">5 days ago</td></tr>
          <tr><th scope="row">Project three</th><td><span className="fl-badge">Active</span></td><td>Owner three</td><td className="num">1 week ago</td></tr>
          <tr><th scope="row">Project four</th><td><span className="fl-badge">Archived</span></td><td>Owner four</td><td className="num">1 month ago</td></tr>
        </tbody>
      </table>
    </div>
  );
}
