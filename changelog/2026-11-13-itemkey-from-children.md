# A group's key is built from its children's keys

An edit inside a group made `spliceOf` key every new ancestor group by serialising its whole
subtree, about 10 ms of the patched paint on landings. `itemKey` now keys a group as its own
shell plus its children's cached keys, so one changed leaf costs work proportional to its depth.
Keys stay exact strings: no hash over children was introduced, so no new collision risk.
