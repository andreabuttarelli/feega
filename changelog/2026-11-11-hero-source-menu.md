# Hero prompt: source dropdown on phones

Below 810px the three icon-only source buttons were unreadable, so they become one menu
(`prompt/SourceMenu.svelte`): trigger says "Import" or the chosen source (`sourceTrigger`),
items carry icons, "Clear" appears once a source is set. Arrow/Home/End move focus,
Escape/Tab close and return focus to the trigger. Desktop keeps the inline buttons.
