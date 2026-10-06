# Un nodo motion scritto con il nome del formato si apre nel suo formato

Prima: `motionNodeSchema` accettava solo i valori dell'enum (`16:9`, `9:16`…). Un nodo con
`format: 'landscape'` falliva il parse e `motionOf` ripiegava sull'intero default: 9:16, e con lui
si perdevano `docHeadRevision` e gli asset. L'editor apriva una tela verticale.

Ora lo schema traduce i nomi (`landscape`, `vertical`, `square`, `portrait`) nel valore dell'enum
prima di validare. Scartato riscrivere i dati esistenti: il nome è un input plausibile da agenti e
script, e normalizzarlo in lettura copre anche le scritture future.
