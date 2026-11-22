import { Permission, type Manifest } from './manifest';
import { Call, OpKind } from './protocol';

export const CALL_PERMISSION: Record<Call, Permission | null> = {
  [Call.Selection]: Permission.Selection,
  [Call.Project]: Permission.Project,
  [Call.SourceText]: Permission.Source,
  [Call.Propose]: null,
  [Call.Preview]: Permission.EditStyle,
  [Call.Fetch]: null,
  [Call.PickFile]: Permission.PickFile,
  [Call.Notify]: null,
  [Call.Render]: null,
  [Call.Overlay]: null
};

export const OP_PERMISSION: Record<OpKind, Permission> = {
  [OpKind.Style]: Permission.EditStyle,
  [OpKind.Attributes]: Permission.EditAttributes,
  [OpKind.Insert]: Permission.EditInsert,
  [OpKind.Dependency]: Permission.EditDependency,
  [OpKind.Asset]: Permission.EditAsset
};

export const missing = (manifest: Manifest, needed: Permission | null): string | null => (needed === null || manifest.grants.includes(needed) ? null : `${manifest.id} lacks the ${needed} permission`);

export function hostAllowed(manifest: Manifest, url: string): string | null {
  const host = URL.canParse(url) ? new URL(url).hostname : null;
  if (host === null) {
    return `${url} is not a web address`;
  }
  return manifest.hosts.includes(host) ? null : `${manifest.id} may not reach ${host}`;
}
