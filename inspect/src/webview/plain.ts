import type { HostMessage } from '../messages';

export const plain = (message: HostMessage): HostMessage => JSON.parse(JSON.stringify(message));
