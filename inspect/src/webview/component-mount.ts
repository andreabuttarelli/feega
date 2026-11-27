import type { ComponentRow } from '../host/component-list';

const MOUNT_ROUTE = '/__feega/mount';

export const mountUrlOf = (base: string, { file, name, sample }: ComponentRow): string => new URL(`${MOUNT_ROUTE}?${new URLSearchParams({ file, name, props: JSON.stringify(sample?.props ?? {}), fit: '1' })}`, base).toString();
