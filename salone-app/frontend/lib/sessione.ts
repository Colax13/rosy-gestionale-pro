// Chi sta usando il programma, e che cosa gli è permesso.
//
// Il salone è uno solo, ma ci lavorano in più persone. Il titolare entra con
// Google; le operatrici entrano con un indirizzo e una password che il
// titolare crea per loro dalla scheda dell'operatore.
//
// I dati non cambiano posto: ogni documento porta già `userId` = il salone, e
// il salone ha lo stesso identificativo del titolare. Quello che cambia è chi
// può leggerli: chi entra viene riconosciuto come titolare (se il salone è
// suo) oppure come membro, leggendo `membri/{uid}`. Se non è né l'uno né
// l'altro, il salone è il suo e basta — che è esattamente come funzionava
// prima, così chi usa già il programma non si accorge di niente.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../src/lib/firebase';
import { Accesso, Abbonamento, statoAccesso, paginaNelPiano } from './piani';

/** Le pagine su cui si può dare o togliere l'accesso. */
export const PAGINE = [
  { chiave: 'agenda',      etichetta: 'Agenda',       percorsi: ['/agenda'] },
  { chiave: 'clienti',     etichetta: 'Clienti',      percorsi: ['/clienti'] },
  { chiave: 'catalogo',    etichetta: 'Servizi',      percorsi: ['/catalogo'] },
  { chiave: 'buoni',       etichetta: 'Buoni',        percorsi: ['/buoni-spa'] },
  { chiave: 'prodotti',    etichetta: 'Prodotti',     percorsi: ['/prodotti'] },
  { chiave: 'report',      etichetta: 'Report',       percorsi: ['/report'] },
  { chiave: 'dipendenti',  etichetta: 'Operatori',    percorsi: ['/dipendenti'] },
  { chiave: 'automazioni', etichetta: 'Automazioni',  percorsi: ['/automazioni'] },
  { chiave: 'rosie',       etichetta: 'Rosy',         percorsi: ['/rosy', '/rosie', '/'] },
  // Le impostazioni restano al titolare: le regole del database non lasciano
  // scrivere il salone a nessun altro, e un permesso che non funziona è
  // peggio di un permesso che non c'è.
  { chiave: 'impostazioni',etichetta: 'Impostazioni', percorsi: ['/settings'], soloTitolare: true }
] as const;

/** Le pagine che si possono davvero concedere a un'operatrice. */
export const PAGINE_CONCEDIBILI = PAGINE.filter(p => !('soloTitolare' in p && p.soloTitolare));

/**
 * Come sopra, ma senza le funzioni riservate che questo salone non ha: non ha
 * senso far spuntare al titolare un permesso per una pagina che nel suo
 * gestionale non esiste.
 */
export function pagineConcedibili() {
  const livello = accessoCorrente().livello;
  return PAGINE_CONCEDIBILI.filter(p => paginaNelPiano(p.chiave, livello));
}

export type ChiavePagina = typeof PAGINE[number]['chiave'];

/** Combinazioni pronte, per non dover spuntare dieci caselle ogni volta. */
export const PROFILI: { nome: string; descrizione: string; permessi: ChiavePagina[] }[] = [
  {
    nome: 'Solo agenda',
    descrizione: 'Vede e gestisce gli appuntamenti, nient\'altro.',
    permessi: ['agenda']
  },
  {
    nome: 'Agenda e clienti',
    descrizione: 'Appuntamenti, anagrafica clienti e listino servizi.',
    permessi: ['agenda', 'clienti', 'catalogo']
  },
  {
    nome: 'Agenda e buoni',
    descrizione: 'Appuntamenti e registro dei buoni.',
    permessi: ['agenda', 'buoni']
  },
  {
    nome: 'Tutto tranne i conti',
    descrizione: 'Tutto, ma non report, operatori e impostazioni.',
    permessi: ['agenda', 'clienti', 'catalogo', 'buoni', 'prodotti', 'rosie']
  }
];

export interface Sessione {
  uid: string;
  salonId: string;
  /** Il titolare vede e fa tutto; l'operatrice solo quello che le è concesso. */
  titolare: boolean;
  nome: string;
  /** null = nessun limite. */
  permessi: ChiavePagina[] | null;
  /**
   * L'indirizzo del titolare del salone — non quello di chi è entrato.
   * Da qui si capisce quali funzioni riservate sono accese: vale per il
   * titolare e per chi lavora con lui, che deve vedere le stesse pagine.
   */
  emailSalone: string | null;
  /**
   * Prova gratuita, piano e che cosa si può usare. Vale per tutto il salone:
   * l'operatrice ha lo stesso piano della titolare. Assente (anteprima,
   * prove) = tutto acceso.
   */
  accesso?: Accesso;
  /** L'indirizzo corto del salone ("rdsalon"), se l'ha scelto. */
  indirizzo?: string | null;
}

let corrente: Sessione | null = null;

const TUTTO_ACCESO: Accesso = { livello: 'pro', piano: null, inProva: false, giorniProva: 0, scaduto: false, scadenza: null };

/** Che cosa può usare il salone di chi è entrato. */
export function accessoCorrente(): Accesso {
  return corrente?.accesso || TUTTO_ACCESO;
}

/** Cambia l'indirizzo corto ricordato nella sessione (dopo averlo salvato). */
export function ricordaIndirizzo(indirizzo: string | null) {
  if (corrente) corrente = { ...corrente, indirizzo };
}

/**
 * La scheda del salone e il suo abbonamento, letti una volta all'accesso.
 * Se qualcosa non si legge si lascia lavorare (vedi `statoAccesso`).
 */
async function leggiSalone(salonId: string): Promise<{ email: string | null; accesso: Accesso; indirizzo: string | null }> {
  let scheda: any = null, abbonamento: Abbonamento | null = null;
  try {
    const s = await getDoc(doc(db, 'salons', salonId));
    scheda = s.exists() ? s.data() : null;
  } catch (err) {
    console.warn('Non sono riuscito a leggere la scheda del salone.', err);
  }
  try {
    const a = await getDoc(doc(db, 'abbonamenti', salonId));
    abbonamento = a.exists() ? (a.data() as Abbonamento) : null;
  } catch (err) {
    console.warn('Non sono riuscito a leggere l\'abbonamento.', err);
  }
  return {
    email: scheda?.ownerEmail || null,
    // Un salone senza scheda è appena nato: la prova parte adesso.
    accesso: statoAccesso(scheda ? scheda.createdAt : new Date(), abbonamento),
    indirizzo: scheda?.indirizzo || null
  };
}


/**
 * Capisce in che salone è entrata questa persona.
 * Il titolare non ha un documento in `membri`: il salone è il suo.
 */
export async function apriSessione(uid: string, nome: string, emailAccesso?: string | null): Promise<Sessione> {
  let sessione: Sessione = {
    uid, salonId: uid, titolare: true, nome, permessi: null,
    emailSalone: emailAccesso || null
  };

  try {
    const membro = await getDoc(doc(db, 'membri', uid));
    if (membro.exists()) {
      const dati = membro.data() as any;
      if (dati.attivo === false) {
        throw new Error("Questo accesso è stato sospeso. Chiedi alla titolare di riattivarlo.");
      }
      if (dati.salonId) {
        sessione = {
          uid,
          salonId: dati.salonId,
          titolare: false,
          nome: dati.nome || nome,
          permessi: Array.isArray(dati.permessi) ? dati.permessi : ['agenda'],
          // Chi lavora nel salone entra con il proprio indirizzo, che non dice
          // niente su quali funzioni ha quel salone: l'indirizzo che conta è
          // quello del titolare, scritto nella scheda del salone.
          emailSalone: null
        };
      }
    }
  } catch (err: any) {
    // Se il messaggio è nostro va mostrato; un errore di rete no: si continua
    // come titolare, che è il comportamento di sempre.
    if (err?.message?.includes('sospeso')) throw err;
    console.warn('Non sono riuscito a leggere il profilo: proseguo come titolare.', err);
  }

  const salone = await leggiSalone(sessione.salonId);
  sessione = {
    ...sessione,
    emailSalone: sessione.titolare ? (sessione.emailSalone || salone.email) : (salone.email || sessione.emailSalone),
    accesso: salone.accesso,
    indirizzo: salone.indirizzo
  };

  corrente = sessione;
  return sessione;
}

/** Solo per l'anteprima e le prove: apre una sessione senza passare da Firebase. */
export function impostaSessione(sessione: Sessione) {
  corrente = sessione;
}

export function chiudiSessione() {
  corrente = null;
}

export function sessioneCorrente(): Sessione | null {
  return corrente;
}

/** L'identificativo del salone a cui appartengono i dati. */
export function idSalone(): string | null {
  return corrente?.salonId || null;
}

/**
 * True se questa persona può aprire quella pagina.
 *
 * Due controlli distinti, e in quest'ordine:
 * 1. la pagina esiste in questo salone? (funzioni riservate)
 * 2. a questa persona è concessa? (permessi)
 * Il primo vale anche per il titolare: una pagina che il suo salone non ha,
 * non ce l'ha nemmeno lui.
 */
export function puoVedere(chiave: ChiavePagina): boolean {
  if (!corrente) return false;
  // Le impostazioni restano aperte anche a prova finita: è da lì che si
  // scarica il backup e si sceglie il piano.
  if (chiave !== 'impostazioni' && !paginaNelPiano(chiave, accessoCorrente().livello)) return false;
  if (corrente.permessi === null) return true;
  return corrente.permessi.includes(chiave);
}

/** True se può aprire quel percorso della barra laterale. */
export function puoAprirePercorso(percorso: string): boolean {
  if (!corrente) return false;
  const pagina = PAGINE.find(p => (p.percorsi as readonly string[]).includes(percorso));
  if (!pagina) return true;
  return puoVedere(pagina.chiave);
}

/** La prima pagina che questa persona può aprire: dove mandarla dopo l'accesso. */
export function primaPaginaPermessa(): string {
  if (!corrente) return '/';
  if (corrente.permessi === null) return '/';
  for (const pagina of PAGINE) {
    if (puoVedere(pagina.chiave)) return pagina.percorsi[0];
  }
  return '/agenda';
}
