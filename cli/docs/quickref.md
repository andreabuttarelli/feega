# Quick Reference — feega CLI

## Comandi rapidi

```bash
# Panoramica
feega brands                              # Lista brand
feega dashboard <slug>                    # Dashboard completa
feega status <slug>                       # Status dettagliato
feega health                              # Stato API (Supabase, Gemini, Zernio)

# Prodotti
feega products <slug>                     # Lista
feega products <slug> sync                # Re-importa dallo store collegato

# Ads
feega ads <slug>                          # Campagne Meta del brand
feega ads <slug> --approve <id>           # Approva e lancia (spende budget)
feega ads <slug> --pause <id>             # Pausa
feega ads <slug> --resume <id>            # Riattiva

# Account e billing
feega upgrade <slug> --credits 16         # Checkout piano mensile (--top-up N: ricarica)
feega update                              # Aggiorna la CLI
```

