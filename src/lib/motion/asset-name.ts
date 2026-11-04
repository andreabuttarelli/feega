const UPLOAD_ID = /^[0-9a-f-]{36}-/i;

export const uploadName = (path: string | null): string => (path?.split('/').pop() ?? '').replace(UPLOAD_ID, '');
