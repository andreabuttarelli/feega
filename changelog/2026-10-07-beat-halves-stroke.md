# cut_to_beat a mezzo beat, contorno acceso dal colore

Emersi dal golden dub.co (`scratchpad/dub-launch/golden/gaps.md`, punti 3 e 11).

- `cutToBeat` prende una `Division` (`beat` | `half`): con `half` la griglia aggiunge il punto
  medio fra due beat. Prima un montaggio a mezzo beat veniva allungato a un beat intero e andava
  posato a mano. Default invariato.
- `add_shape` con `stroke` e senza `strokeKind` accende `solid`: il default `none` rendeva
  invisibile un contorno chiesto esplicitamente (lo shockwave del logo nel golden).
