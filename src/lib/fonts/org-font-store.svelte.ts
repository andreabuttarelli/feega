import { apiCall, withOrg } from '$lib/api/client';
import { orgFontCss, type OrgFontFace } from './org-fonts';

const HTTP_OK = 200;
const PATH = '/api/v1/org/fonts';

class OrgFontStore {
  faces = $state.raw<OrgFontFace[]>([]);
  readonly css = $derived(orgFontCss(this.faces));
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    this.loading ??= apiCall<{ fonts: OrgFontFace[] }>(withOrg(PATH)).then((answer) => {
      if (answer.status === HTTP_OK) {
        this.faces = answer.body.fonts;
      }
    });
    return this.loading;
  }

  refresh(): Promise<void> {
    this.loading = null;
    return this.load();
  }
}

export const orgFonts = new OrgFontStore();
