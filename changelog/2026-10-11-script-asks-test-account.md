# write_script asks for a test account first, unprompted

User rule: for a SaaS, "Fammi un trailer motion di feega.app" alone must make the agent
ask for a test account and film the signed-in app. Until now that lived in the prompt
and in a `next` note from recreate_ui, which came only in the build turn: the verification
run built on the marketing page, took the cut review, and only then asked.

- `analyze_site` returns `appEntry`: the first link whose text leads into the app ("Log
  in", "Sign up", "Start for free", "Let’s start"…). The text table lives once, in
  `web/app-entry.ts`, shared with recreate_ui's `offersSignIn`.
- `write_script` refuses while the site leads into an app, it is not a store, no app
  account is kept for the project and the user did not decline (`app_account:
  declined`): the error tells the agent to ask for a TEST account and end the turn. The
  brief therefore comes after app_browse has seen the real screens.
- Shops (`store` shopify/woocommerce) and fictional brands are exempt.
