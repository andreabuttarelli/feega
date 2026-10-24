# Creating a section no longer throws

The canvas page imported `Stack` as a type only, then used `Stack.Back`
when a section was created (to send it behind its members). At runtime
that is a ReferenceError. `Stack` is now a value import. svelte-check
reported it; CI does not run svelte-check, so it slipped through.
