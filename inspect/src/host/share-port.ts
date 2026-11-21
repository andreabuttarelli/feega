export type ShareRequest = { dir: string; projectName?: string; editorUrl: string; appUrl?: string; visitorsCanEdit: boolean };

export type ShareInfo = { id: string; url: string; expiresAt: string };

export type ShareHost = {
  start: (request: ShareRequest) => Promise<ShareInfo>;
  stop: (id: string) => Promise<void>;
};
