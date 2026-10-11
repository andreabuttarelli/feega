# Fix rounds stop at the cap; one language per script

- v6 fixer turns spent $0.65–1.56 on a $0.75 share: the self-check
  rounds had no budget stop and the delivery loop ran up to 3 of them.
  Self-check rounds now stop on `overBudget`, and the loop takes no
  further round once over budget (the first look still happens).
- v6 feega mixed Italian lines with "Make your brand move.". The
  copywriter now writes every line in the site copy's language and keeps
  the promise verbatim only when it is in that language.
