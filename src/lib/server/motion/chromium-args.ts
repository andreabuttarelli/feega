export function extraChromiumArgs(env: Record<string, string | undefined>): string[] {
  return (env.CHROMIUM_ARGS ?? '').split(/\s+/).filter(Boolean);
}
