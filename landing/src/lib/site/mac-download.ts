import { MAC_GUIDE_URL } from './links';

export const INSTALL_GUIDE_URL = MAC_GUIDE_URL;
export const RELEASES_API_URL = 'https://api.github.com/repos/andreabuttarelli/feega/releases?per_page=30';

const APP_TAG_PREFIX = 'app-v';

export type MacArch = 'arm64' | 'x64';

export type ReleaseSummary = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string; browser_download_url: string }[];
};

export function pickMacDownload(releases: ReleaseSummary[], { arch }: { arch: MacArch }): string {
  const suffix = `-mac-${arch}.dmg`;

  for (const release of releases) {
    if (release.draft || !release.tag_name.startsWith(APP_TAG_PREFIX)) {
      continue;
    }

    const asset = release.assets.find((a) => a.name.endsWith(suffix));
    if (asset) {
      return asset.browser_download_url;
    }
  }

  return INSTALL_GUIDE_URL;
}

export function wantedArch(query: string | null, clientHintArch: string | null): MacArch {
  if (query === 'x64' || query === 'arm64') {
    return query;
  }

  return clientHintArch?.replaceAll('"', '') === 'x86' ? 'x64' : 'arm64';
}

export function isMobile(userAgent: string): boolean {
  return /iPhone|iPad|iPod|Android/i.test(userAgent);
}
