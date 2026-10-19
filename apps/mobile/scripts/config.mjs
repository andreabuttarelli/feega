import { readFileSync, writeFileSync } from 'node:fs';

const ENV_FILE = new URL('../../../.env', import.meta.url);
const PLIST = new URL('../ios/App/App/FeegaConfig.plist', import.meta.url);
const DEFAULT_WEB = 'https://oh.feega.app';

const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, '')])
);

const values = {
  SupabaseURL: env.PUBLIC_SUPABASE_URL,
  SupabaseAnonKey: env.PUBLIC_SUPABASE_ANON_KEY,
  WebBase: process.env.FEEGA_WEB ?? DEFAULT_WEB,
  ApiBase: process.env.FEEGA_API ?? process.env.FEEGA_WEB ?? DEFAULT_WEB
};

const entries = Object.entries(values)
  .map(([key, value]) => `  <key>${key}</key>\n  <string>${value}</string>`)
  .join('\n');

writeFileSync(PLIST, `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${entries}\n</dict>\n</plist>\n`);
console.log(`wrote FeegaConfig.plist (web ${values.WebBase}, api ${values.ApiBase})`);
