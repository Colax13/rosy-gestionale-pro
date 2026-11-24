/// <reference types="vite/client" />
// Funzioni che dipendono da un apparecchio o da un conto di UN salone, e che
// quindi non si accendono con il piano ma salone per salone.
//
// Le PAGINE (Buoni, Prodotti, Report, Rosy…) non stanno più qui: si aprono in
// base al piano del salone, vedi `piani.ts`. Qui restano solo le due cose che
// hanno bisogno di qualcosa di fisico o di un conto esterno:
//
//  - `messaggi_automatici`: gli SMS partono da un "postino" (un tablet con
//    una SIM, o un conto Skebby) che è di un salone preciso. Acceso per il
//    salone sbagliato, le sue clienti riceverebbero SMS dal numero di un
//    altro salone.
//  - `buoni_dal_foglio`: i buoni pagati online letti da un foglio Google, che
//    è di un salone preciso.
//
// A chi sono accese lo dicono le variabili d'ambiente (indirizzi email dei
// TITOLARI, separati da virgola), non il codice:
//    SALONI_CON_SMS / VITE_SALONI_CON_SMS
//    SALONI_CON_FOGLIO_BUONI / VITE_SALONI_CON_FOGLIO_BUONI
// Senza variabili sono spente per tutti, che è il modo giusto di sbagliare.

export type ChiaveFunzione = 'messaggi_automatici' | 'buoni_dal_foglio';

const VARIABILE: Record<ChiaveFunzione, string> = {
  messaggi_automatici: 'SALONI_CON_SMS',
  buoni_dal_foglio: 'SALONI_CON_FOGLIO_BUONI'
};

/** Legge una variabile sia sul server (process.env) sia nel browser (VITE_…). */
function variabile(nome: string): string {
  const delServer = typeof process !== 'undefined' ? process.env?.[nome] || process.env?.[`VITE_${nome}`] : '';
  const delBrowser = (import.meta as any).env?.[`VITE_${nome}`];
  return delServer || delBrowser || '';
}

/** True se quella chiave è una funzione riservata (e non una pagina normale). */
export function eRiservata(chiave: string): chiave is ChiaveFunzione {
  return Object.prototype.hasOwnProperty.call(VARIABILE, chiave);
}

/**
 * Gli indirizzi si confrontano senza maiuscole e senza spazi attorno.
 */
export function normalizzaEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

/** "a@x.it, B@y.it" → ['a@x.it', 'b@y.it'] */
export function leggiElenco(testo?: string | null): string[] {
  return (testo || '').split(/[,;\s]+/).map(normalizzaEmail).filter(Boolean);
}

/**
 * True se quella funzione è accesa per il salone di quell'indirizzo.
 * Una chiave che non è una funzione riservata è accesa per tutti. Senza
 * indirizzo la risposta è no. `elenco` serve alle prove.
 */
export function funzioneAccesa(chiave: string, emailSalone?: string | null, elenco?: string): boolean {
  if (!eRiservata(chiave)) return true;
  const email = normalizzaEmail(emailSalone);
  if (!email) return false;
  return leggiElenco(elenco ?? variabile(VARIABILE[chiave])).includes(email);
}

/**
 * True se quell'indirizzo è di chi gestisce Rosy (ADMIN_EMAILS sul server,
 * VITE_ADMIN_EMAILS nel browser). Nel browser serve solo a mostrare la voce
 * del menù: chi entra davvero nel pannello lo decide il server.
 */
export function eGestore(email?: string | null, elenco?: string): boolean {
  const e = normalizzaEmail(email);
  return !!e && leggiElenco(elenco ?? variabile('ADMIN_EMAILS')).includes(e);
}
