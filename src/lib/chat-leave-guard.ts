export type LeaveVerdict = 'allow' | 'confirm';

type Destination = 'unload' | 'same-page' | 'project-canvas' | 'project-page' | 'other-project' | 'outside';

const VERDICTS: Record<Destination, LeaveVerdict> = {
  unload: 'allow',
  'same-page': 'allow',
  'project-canvas': 'allow',
  'project-page': 'confirm',
  'other-project': 'confirm',
  outside: 'confirm'
};

function destination(projectId: string, from: URL, to: URL | null): Destination {
  if (!to || to.origin !== from.origin) {
    return 'unload';
  }
  if (to.pathname === from.pathname) {
    return 'same-page';
  }
  const root = `/p/${projectId}`;
  if (to.pathname === root || to.pathname.startsWith(`${root}/c/`)) {
    return 'project-canvas';
  }
  if (to.pathname.startsWith(`${root}/`)) {
    return 'project-page';
  }
  return to.pathname.startsWith('/p/') ? 'other-project' : 'outside';
}

export function leaveVerdict(projectId: string, from: URL, to: URL | null): LeaveVerdict {
  return VERDICTS[destination(projectId, from, to)];
}
