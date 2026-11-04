# Magnetic ports, cable ties, wire cut

While you drag a wire, `magnetPort` picks the nearest port within 56 px that
`connectionRefusal` accepts. A spring-eased gooey SVG bubble (an feGaussianBlur +
alpha-threshold filter) merges it with the wire end, and letting go connects there.
Ports that would refuse the wire are dimmed. Hovering a port shows a small bubble.

Ties: `nodes_connections.tie jsonb {id,x,y}` (migration `20261103120000_connection_tie`).
Wires that share a `tie.id` make up the bundle. A tied wire's cubic is bent so that its
t=0.5 point lands on the tie (`throughPoint`), so we need no route segments and no
changes to the overlay keys. We rejected a separate `ties` table: it would need RLS,
realtime and a cascade for a record with no other fields. Alt-drag across wires creates
a tie (`tieAcross`), and `set_edge_tie` is the page action, the canvas op and the
optimistic REGISTRY row. Wire cut: a × appears at the curve's midpoint on hover.
