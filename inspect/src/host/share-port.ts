export type ShareRequest = { dir: string; editorUrl: string; visitorsCanEdit: boolean };

export type ShareInfo = { id: string; url: string; expiresAt: string };

export type ShareHost = {
  start: (request: ShareRequest) => Promise<ShareInfo>;
  stop: (id: string) => Promise<void>;
};
