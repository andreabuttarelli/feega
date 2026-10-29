# SWR: a late revalidation no longer outlives clear()

`SwrCache.clear()` (after every save, org switch) left in-flight revalidations alive; they stored
their pre-save answer back and fired `invalidate`. A generation counter now drops them.
Keys are separate entries: a late answer for one never reaches another (test added).
This does not explain settings pages rendering with another page's data; that is not
reproduced. The cache cannot mix keys.
