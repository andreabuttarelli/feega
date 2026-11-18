/**
 * LA FORMA VERA DELLE COLONNE `jsonb`, DENTRO AI TIPI GENERATI.
 *
 * `database.types.ts` viene da `supabase gen types` e non può sapere altro che «jsonb» — Postgres
 * non gli dice cosa contiene un CHECK, quindi ogni colonna arriva come `Json`, cioè "qualunque
 * JSON". Il CHECK sul database e lo Zod in `node-data.ts`/`jsonb-schemas.ts` fermano la forma
 * sbagliata, ma solo a runtime: scrivere `{ type: 'image', data: { content: '...' } }` in TypeScript
 * compilava lo stesso.
 *
 * Questo file non genera niente di nuovo: prende gli STESSI schemi Zod che già producono i CHECK
 * (`looseNodeJsonSchema`) e la validazione runtime (`validateNodeData`, `validateJsonbColumn`), e
 * ne deriva il tipo con `z.infer`. Se uno schema Zod cambia, questi tipi cambiano con lui — non è
 * una terza copia della forma, è la stessa riga letta un'altra volta.
 *
 * PERCHÉ UN OVERLAY E NON `Database` A MANO: `database.types.ts` si rigenera con `npm run db:types`
 * e ogni modifica manuale sparirebbe alla corsa successiva. Un overlay separato — `Overwrite<Row,
 * Patch>` applicato tabella per tabella — sopravvive alla rigenerazione perché non tocca il file
 * generato: lo importa e lo restringe da fuori.
 *
 * `nodes.type`/`nodes.data` sono DUE COLONNE SIBLING nella stessa riga, non un campo annidato: il
 * discriminante e il payload vivono uno accanto all'altro in `Row`/`Insert`/`Update`. L'unione
 * discriminata sostituisce ENTRAMBE le chiavi insieme (`NodeTypeAndData`), altrimenti `type` da
 * solo e `data` da solo restano due `Json` scorrelati e `{type: 'image', data: {content}}`
 * tornerebbe a compilare.
 */
import { z } from 'zod';
import type { Database } from '$lib/database.types';
import { NODE_DATA_SCHEMAS } from '$lib/canvas/node-data';
import { canvasViewportSchema } from '$lib/server/org-data/jsonb-schemas';

type Overwrite<Row, Patch> = Omit<Row, keyof Patch> & Patch;

type NodeTypeAndData = {
  [K in keyof typeof NODE_DATA_SCHEMAS]: { type: K; data: z.infer<(typeof NODE_DATA_SCHEMAS)[K]> };
}[keyof typeof NODE_DATA_SCHEMAS];

type CanvasViewport = z.infer<typeof canvasViewportSchema>;

type Tables = Database['public']['Tables'];

type NarrowedNodes = {
  Row: Overwrite<Tables['nodes']['Row'], NodeTypeAndData>;
  Insert: Overwrite<Tables['nodes']['Insert'], NodeTypeAndData>;
  Update: Overwrite<Tables['nodes']['Update'], Partial<NodeTypeAndData>>;
  Relationships: Tables['nodes']['Relationships'];
};

type NarrowedCanvases = {
  Row: Overwrite<Tables['canvases']['Row'], { viewport: CanvasViewport | null }>;
  Insert: Overwrite<Tables['canvases']['Insert'], { viewport?: CanvasViewport | null }>;
  Update: Overwrite<Tables['canvases']['Update'], { viewport?: CanvasViewport | null }>;
  Relationships: Tables['canvases']['Relationships'];
};

/**
 * IL DATABASE NARROWED — le stesse 26+ tabelle di `Database`, con le colonne validate
 * (`nodes.type`+`data`, `canvases.viewport`) sostituite dalla loro forma vera. Ogni altra
 * tabella, e ogni altra colonna jsonb — quelle che `jsonb-schemas.ts` registra `free_form`, col
 * motivo scritto lì — resta `Json` esattamente come il generatore l'ha scritta: non c'è ancora un
 * codice reale la cui forma vada derivata, e imporne una qui sarebbe un contratto inventato.
 */
export type NarrowedDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Tables, 'nodes' | 'canvases'> & {
      nodes: NarrowedNodes;
      canvases: NarrowedCanvases;
    };
  };
};
