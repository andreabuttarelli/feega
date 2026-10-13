# Steps list template

New built-in `builtin:steps-list`: an agent-style progress list (heading, thin rail, steps with line icons landing one by one, newest highlighted, shimmering status label). Custom component like the other templates; model is a pure function of t, tested in `steps-list/model.test.ts`. Steps are one text field (`Label - detail` per line or `;`) instead of a list field, to keep keyFields at five. No media, so no sample-table row.
