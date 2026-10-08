# Galleria minimale, dentro la shell di /app

- Con sessione la galleria usa `AppShell` (estratta da `/app/+layout.svelte`, voce "Gallery" in
  `app-nav`); senza sessione resta pubblica, stesso stile, senza sidebar.
- Card: solo anteprima grande, titolo e autore. Filtri come testo. Niente bordi.
- `GalleryPlayer`: con hover parte al passaggio del mouse, sul touch quando è in vista;
  `CompositionPlayer` ora si ferma su `restFrame` quando non è attivo.
- Pagina item: video grande, una riga di info, un solo bottone Remix.
- Seed: ogni item senza render ha un poster, fotografato dal suo HTML con Playwright al 40% della
  durata. Senza, le composizioni 3D a riposo erano nere (troppi contesti WebGL insieme).
