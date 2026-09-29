# Quick Reference — feega CLI

## Comandi rapidi

```bash
# Panoramica
feega brands                              # Lista brand
feega dashboard <slug>                    # Dashboard completa
feega status <slug>                       # Status dettagliato
feega health                              # Stato API (Supabase, Gemini, Zernio)

# Contenuti
feega content <slug>                      # Tutti i post
feega content <slug> --status pending_user  # Solo pending
feega content <slug> --clear pending_user # Elimina in blocco per status
feega approve <slug> --all                # Approva tutti
feega calendar <slug>                     # Calendario
feega calendar <slug> --month 2026-07     # Mese specifico

# Post (editing)
feega post <slug> <id>                    # Dettaglio post
feega post <slug> <id> edit --caption "..."  # Modifica caption
feega post <slug> <id> render             # Genera l'immagine mancante
feega post <slug> <id> approve            # Approva
feega post <slug> <id> reject             # Elimina (solo pending)
feega post <slug> <id> publish            # Pubblica ora
feega post <slug> <id> reschedule --scheduledFor "2026-06-20T10:00"

# Prodotti
feega products <slug>                     # Lista
feega products <slug> sync                # Re-importa dallo store collegato

# Ads
feega ads <slug>                          # Campagne Meta del brand
feega ads <slug> --approve <id>           # Approva e lancia (spende budget)
feega ads <slug> --pause <id>             # Pausa
feega ads <slug> --resume <id>            # Riattiva

# Account e billing
feega upgrade <slug>                      # Apri checkout piano
feega update                              # Aggiorna la CLI
```

## Status post

| Status | Colore | Significato |
|--------|--------|-------------|
| `pending_user` | 🟡 Giallo | In attesa di approvazione |
| `approved` | 🔵 Blu | Approvato, in attesa di scheduling |
| `scheduled` | 🟢 Verde | Schedulato per pubblicazione |
| `published` | 🟢 Verde | Pubblicato |
| `failed` | 🔴 Rosso | Pubblicazione fallita |
