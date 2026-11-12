# Code import: publish needs the user's GitHub, folder uploads withhold secrets

**Publish.** `codePublish` used the same GitHub call as reads, which fell back to the server's
`GITHUB_TOKEN` without a user connection: any user could open a branch and PR, as the server, on
any repo that token can write. `githubSource` now takes `{ read, write }`; reads keep the fallback
(public repos on self-host), writes use only the user's connection, else `no_github`.
`GITHUB_TOKEN` has no other use under `src/`.

**Folder upload.** `snapshotOf` honoured only `.gitignore`. A fixed table (`SECRET_FILES`,
`SECRET_CONTENT`) now withholds `.env`/`.env.*` (templates kept), `*.pem`, `*.key`, `id_rsa*` and
an `.npmrc` with `_auth`/`_authToken`, regardless of `.gitignore` negations. The snapshot reports
them in `withheld`; the dialog does not show it yet.

**Not done.** The sandbox port is a public `*.vercel.run` URL (SDK: "public domain") for the
import window. Gating the origin proxy with a per-import header needs the capture browser to send
it, which lives in files another change owns; left for a follow-up.
