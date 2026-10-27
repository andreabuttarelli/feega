# Docs: Connect Figma, Connect Drive and Dropbox

web-docs had one line about the Figma token and nothing on Drive or Dropbox.

- `integrations/connect-figma.mdx`: token scopes derived from the calls in `import-images.ts` (`GET /v1/files/:key/images` needs File content read, `GET /v1/me` for Test needs Current user read), where it is stored, remove, errors.
- `integrations/connect-drive-dropbox.mdx`: connect from the picker, import, export, errors, REST endpoints.
- OneDrive does not exist in code: not documented.
- Demos `connect-figma` and `connect-cloud` stop before saving a token and before the provider consent screen.
- Gaps found, not fixed here: no disconnect for Drive/Dropbox (`cloudTokenStore.remove` has no caller), Figma image failures are silent, Drive export at the root sends an empty parent, picker errors show raw codes.
