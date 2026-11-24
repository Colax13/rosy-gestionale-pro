/**
 * I piani di Rosy e la prova gratuita.
 *
 * - Ogni salone che si iscrive parte con la PROVA: GIORNI_PROVA giorni con
 *   tutto acceso, senza carta. La prova si conta dalla data di nascita del
 *   salone (`salons/{id}.createdAt`), che le regole del database non lasciano
 *   riscrivere: non si può allungare da soli.
 * - Il piano pagato sta in `abbonamenti/{id}`, che scrive SOLO il server
 *   (oggi il pannello di chi gestisce Rosy, domani Stripe). Il salone lo
 *   legge e basta: nessuno si regala il Pro dalla console del browser.
 * - Finita la prova senza un piano, il gestionale si ferma su una schermata
 *   che invita a sceglierne uno. I dati restano dove sono.
 *
 * Qui solo regole, senza database: si provano con `npm run prova:piani`.
 */

export const GIORNI_PROVA = 14;

export type Piano = 'base' | 'pro' | 'fondatori';
export type Livello = 'pro' | 'base' | 'nessuno';

export interface InfoPiano {
  nome: string;
  /** Euro al mese, IVA esclusa. Solo per mostrarlo: l'incasso verrà con Stripe. */
  prezzo_mese: number;
  livello: Exclude<Livello, 'nessuno'>;
  descrizione: string;
}

export const PIANI: Record<Piano, InfoPiano> = {
  base: {
    nome: 'Base', prezzo_mese: 19, livello: 'base',
    descrizione: 'Agenda, clienti, servizi, operatrici e prenotazione online senza commissioni.'
  },
  pro: {
    nome: 'Pro', prezzo_mese: 39, livello: 'pro',
    descrizione: 'Tutto il Base, più Rosy (IA), messaggi automatici, buoni, prodotti e report.'
  },
  fondatori: {
    nome: 'Fondatori', prezzo_mese: 12.5, livello: 'pro',
    descrizione: 'Tutto, al prezzo di lancio bloccato per i primi saloni: 149 € l\'anno.'
  }
};

/** Le pagine che chiedono il livello Pro. Le altre sono di tutti i piani. */
export const PAGINE_PRO = ['rosie', 'automazioni', 'buoni', 'prodotti', 'report'] as const;

export interface Abbonamento {
  piano: Piano;
  /** Fino a quando vale (ISO o data). Assente = senza scadenza. */
  fino_al?: string | Date | null;
}

export interface Accesso {
  /** Che cosa può usare adesso. */
  livello: Livello;
  /** Il piano pagato in corso, se c'è. */
  piano: Piano | null;
  /** In prova gratuita (e senza un piano pagato). */
  inProva: boolean;
  /** Giorni di prova che restano, oggi compreso. 0 se non è in prova. */
  giorniProva: number;
  /** Prova finita e nessun piano valido: il gestionale si ferma. */
  scaduto: boolean;
  /** Quando finisce la prova o il piano, se si sa. */
  scadenza: Date | null;
}

const GIORNO = 24 * 60 * 60 * 1000;

/** Legge una data comunque sia scritta (Date, ISO, Timestamp di Firestore). */
export function aData(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  if (typeof v._seconds === 'number') return new Date(v._seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Quando finisce la prova di un salone nato quel giorno. */
export function fineProva(creatoIl: any): Date | null {
  const nato = aData(creatoIl);
  return nato ? new Date(nato.getTime() + GIORNI_PROVA * GIORNO) : null;
}

/**
 * Che cosa può usare il salone adesso.
 * Se non si sa quando è nato (scheda non letta) si lascia lavorare in prova:
 * una rete giù non deve chiudere fuori chi sta in salone. Il muro vero, per
 * le funzioni Pro, sta nelle regole del database.
 */
export function statoAccesso(creatoIl: any, abbonamento: Abbonamento | null | undefined, adesso: Date = new Date()): Accesso {
  const piano = abbonamento?.piano && PIANI[abbonamento.piano] ? abbonamento.piano : null;
  const finoAl = aData(abbonamento?.fino_al);
  const pianoValido = !!piano && (!finoAl || finoAl.getTime() > adesso.getTime());
  if (pianoValido) {
    return { livello: PIANI[piano!].livello, piano, inProva: false, giorniProva: 0, scaduto: false, scadenza: finoAl };
  }

  const fine = fineProva(creatoIl);
  if (!fine) {
    return { livello: 'pro', piano: null, inProva: true, giorniProva: GIORNI_PROVA, scaduto: false, scadenza: null };
  }
  const resta = fine.getTime() - adesso.getTime();
  if (resta > 0) {
    return { livello: 'pro', piano: null, inProva: true, giorniProva: Math.ceil(resta / GIORNO), scaduto: false, scadenza: fine };
  }
  return { livello: 'nessuno', piano: null, inProva: false, giorniProva: 0, scaduto: true, scadenza: fine };
}

/** True se quella pagina si può usare con quel livello. */
export function paginaNelPiano(chiave: string, livello: Livello): boolean {
  if (livello === 'nessuno') return false;
  if ((PAGINE_PRO as readonly string[]).includes(chiave)) return livello === 'pro';
  return true;
}

/** La riga da mostrare nel menù: "Prova gratuita · 9 giorni", "Piano Pro". */
export function etichettaAccesso(a: Accesso): string {
  if (a.piano) return `Piano ${PIANI[a.piano].nome}`;
  if (a.inProva) return `Prova gratuita · ${a.giorniProva} ${a.giorniProva === 1 ? 'giorno' : 'giorni'}`;
  return 'Prova terminata';
}
