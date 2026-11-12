# Code import signs in with the project's test account

A route behind a login used to be imported as the login page under the route's name, with no
warning: the capture opened `/billing`, the app redirected to `/login`, and the board named
`/billing` showed a sign-in form.

Now each capture checks where the tab landed (`lockedOut` in `code-import/sign-in.ts`): a final
path different from the one asked that is the account's login path, a sign-in path
(`/login`, `/sign-in`, …), or a page with a password field, is locked. A locked route is not
imported; it comes back in `locked` (label, reason, detail) and in `skipped`. If every route is
locked the import answers `sign_in_needed` (422).

When the project has a test account (`app_accounts`), code import signs in once before
capturing, on the account's login PATH rebased onto the sandbox origin: cookies of the deployed
domain do not carry over. The login is `appBrowse` itself with an in-memory account store, so
there is one login routine and the sandbox session never lands on the saved one. Every capture
tab gets that session through `restore`. A failed login is reported on each locked route; public
routes import as before.

The test account can now be set where users look for it: a form in project settings, `PUT
/api/v1/projects/:id/app-account`, `feega app-account <id> --login-url --email --password`, MCP
`set_app_account`. An empty password keeps the saved one; a new account resets the session. The
import dialog shows the saved account or links to settings.

Discarded: exporting app-browse's private `signIn` (leaner: no settle and screenshot after
login) — widening it needs the owner's approval; a second login routine in code import.

Limits: an app whose auth needs a database or secrets the sandbox lacks still fails to sign in;
importing from the deployed URL is the alternative. A login form rendered without a redirect is
not detected. Folder imports (local mode) do not sign in.
