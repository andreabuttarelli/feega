import type { Headers, VisitorInfo, VisitorRole } from './frame';

export const VISITOR_HEADER = 'x-feega-visitor';
export const VISIT_COOKIE = 'feega_visit';
export const AUTH_PATH = '/__feega/auth';
export const HOST_PATH = '/host';

const ROLES: readonly string[] = ['editor', 'viewer'] satisfies VisitorRole[];
const NON_ASCII = /[\u007f-￿]/g;

const asciiJson = (value: unknown) => JSON.stringify(value).replace(NON_ASCII, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

export const encodeVisitor = (visitor: VisitorInfo) => asciiJson({ userId: visitor.userId, name: visitor.name, role: visitor.role });

export function decodeVisitor(header: string | null | undefined): VisitorInfo | null {
  if (!header) {
    return null;
  }
  try {
    const value = JSON.parse(header) as Partial<VisitorInfo>;
    const valid = typeof value.userId === 'string' && value.userId !== '' && typeof value.name === 'string' && ROLES.includes(value.role as string);
    return valid ? { userId: value.userId!, name: value.name!, role: value.role! } : null;
  } catch {
    return null;
  }
}

export const canEdit = (role: VisitorRole) => role === 'editor';

export function withVisitor(headers: Headers, visitor: VisitorInfo): Headers {
  const kept = Object.entries(headers).filter(([name]) => name.toLowerCase() !== VISITOR_HEADER);
  return { ...Object.fromEntries(kept), [VISITOR_HEADER]: encodeVisitor(visitor) };
}
