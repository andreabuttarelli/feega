import { pageMountUrl } from './page-mount-url.js';

const MOUNT_ROUTE = '/__feega/mount';

const routeMountUrl = ({ file, name, props }) => `${MOUNT_ROUTE}?${new URLSearchParams({ file, name, props: JSON.stringify(props) })}`;

const MOUNT_HOSTS = [
  { serves: (win) => Boolean(win.next?.version), urlOf: (win, request) => pageMountUrl(win.location, request) },
  { serves: () => true, urlOf: (_win, request) => routeMountUrl(request) }
];

export const mountUrlFor = (win, request) => MOUNT_HOSTS.find((host) => host.serves(win)).urlOf(win, request);
