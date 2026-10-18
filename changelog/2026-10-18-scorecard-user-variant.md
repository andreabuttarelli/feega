# Scorecard: a user variant that hovers before opening

The scorecard double-clicks the instant the pointer arrives, so hover prefetch never gets a head
start: the worst case. Variant `user` (`FLUID_VARIANTS=user`) moves onto the node and waits
300 ms before each click or double-click that selects or opens it. Both are reported; neither
replaces the other.
