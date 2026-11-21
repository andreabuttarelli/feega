export type AppleCredential = {
  identityToken: string;
  authorizationCode: string;
  user: string;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
};

export type HelperError = { code: string; message: string };

export type HelperResult = { ok: true; credential: AppleCredential } | { ok: false; error: HelperError };

export const BAD_OUTPUT = 'bad_output';

const fail = (message: string): HelperResult => ({ ok: false, error: { code: BAD_OUTPUT, message } });

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export function parseHelperOutput(stdout: string): HelperResult {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(stdout.trim());
  } catch {
    return fail('helper printed no JSON');
  }

  const error = body?.error as Record<string, unknown> | undefined;
  if (error) {
    return { ok: false, error: { code: text(error.code) ?? BAD_OUTPUT, message: text(error.message) ?? '' } };
  }

  const identityToken = text(body?.identityToken);
  const authorizationCode = text(body?.authorizationCode);
  const user = text(body?.user);
  if (!identityToken || !authorizationCode || !user) {
    return fail('helper output is missing the credential');
  }

  return { ok: true, credential: { identityToken, authorizationCode, user, givenName: text(body.givenName), familyName: text(body.familyName), email: text(body.email) } };
}

export const parseAvailability = (stdout: string): boolean => {
  try {
    return JSON.parse(stdout.trim()).available === true;
  } catch {
    return false;
  }
};
