export const foldKey = (plugin: string, section: string) => JSON.stringify([plugin, section]);

export const isOpen = (closed: string[], key: string) => !closed.includes(key);

export const toggled = (closed: string[], key: string) => (isOpen(closed, key) ? [...closed, key] : closed.filter((k) => k !== key));
