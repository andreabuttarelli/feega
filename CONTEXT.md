# feega

Feega is a VS Code extension and `npx feega` for editing a running web app visually and landing the change in the source. This glossary fixes the language.

## Language

**Extension**:
The Feega VS Code extension (`inspect/`). Opens the running app next to the code, lets the user select an element and edit it.
_Avoid_: plugin, add-on.

**Launcher**:
`npx feega` (`npx/`), the same editor outside VS Code.

**Source map plugin**:
`feega-source-map` (`packages/source-map`), the dev-only plugin that tags DOM nodes with the file and line that rendered them.

**Edit**:
A change the user makes to a selected element. It is written to the source file, never kept in a side store.

**Account**:
The signed-in user and their organisation on `oh.feega.app`. The editor signs in through `/cli/callback`.

**Dashboard**:
The signed-in landing page of the web app: a preview of Feega Cloud, with links to the extension and GitHub.

**Credits**:
The balance an organisation spends on paid features. Never expire. Billing and the Stripe webhook are kept for existing subscribers.
