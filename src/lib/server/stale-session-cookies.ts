const FOREIGN_SESSION = /^sb-[^.]+-auth-token(\.\d+)?$/;

export function staleSessionCookieNames(names: string[], ownName: string): string[] {
  return names.filter((name) => FOREIGN_SESSION.test(name) && name !== ownName && !name.startsWith(`${ownName}.`));
}
