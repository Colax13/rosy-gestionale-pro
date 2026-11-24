// Il collegamento con Skebby, che è il postino degli SMS.
//
// Skebby non sa niente di appuntamenti: riceve "manda questo testo a questo
// numero" e lo manda. Quando mandarlo, a chi, e che cosa c'è scritto lo decide
// il nostro codice — le parole stanno in `salone-app/frontend/lib/messaggi.ts`.
//
// Come funziona il loro servizio: prima ci si presenta con utente e password e
// si riceve una coppia di chiavi buone per un po' (`login`), poi si manda
// (`sms`) mettendo quelle chiavi nelle intestazioni. Le chiavi si tengono da
// parte finché la funzione resta calda, così non si rifà il giro ogni volta;
// se scadono, ci si ripresenta una volta e si riprova.

const BASE = process.env.SKEBBY_URL || 'https://api.skebby.it/API/v1.0/REST';

export interface Chiavi { userKey: string; sessionKey: string }

/**
 * Legge la risposta del login.
 *
 * Il loro servizio risponde `user_key;session_key` in testo semplice, ma su
 * alcuni account risponde in JSON. Si reggono tutte e due invece di fidarsi:
 * se cambia la forma, non si smette di mandare messaggi.
 */
export function leggiRispostaLogin(corpo: string): Chiavi | null {
  const testo = (corpo || '').trim();
  if (!testo) return null;

  if (testo.startsWith('{')) {
    try {
      const dati = JSON.parse(testo);
      const userKey = dati.user_key || dati.userKey;
      const sessionKey = dati.session_key || dati.sessionKey || dati.access_token;
      return userKey && sessionKey ? { userKey, sessionKey } : null;
    } catch {
      return null;
    }
  }

  const pezzi = testo.split(';').map(p => p.trim()).filter(Boolean);
  return pezzi.length >= 2 ? { userKey: pezzi[0], sessionKey: pezzi[1] } : null;
}

/** Il mittente alfanumerico: al massimo 11 caratteri, e solo lettere e numeri. */
export function mittenteValido(nome: string | undefined): string {
  return (nome || '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 11);
}

/**
 * Un conto Skebby: quello del singolo salone (lo collega lui dalla pagina
 * Automazioni, e paga lui i suoi SMS) oppure, se non lo si passa, quello
 * scritto nelle variabili del server.
 */
export interface ContoSkebby { utente: string; password: string; mittente?: string; tipo?: string }

function contoDelServer(): ContoSkebby | null {
  const utente = process.env.SKEBBY_USER, password = process.env.SKEBBY_PASSWORD;
  return utente && password ? { utente, password, mittente: process.env.SKEBBY_MITTENTE, tipo: process.env.SKEBBY_TIPO } : null;
}

// Le chiavi di sessione, conto per conto: ogni salone ha le sue.
const chiaviInCorso = new Map<string, Chiavi>();

async function entra(conto: ContoSkebby): Promise<Chiavi> {
  const { utente, password } = conto;
  if (!utente || !password) throw new Error('skebby-non-configurato');

  const risposta = await fetch(`${BASE}/login`, {
    method: 'GET',
    headers: { 'Authorization': `Basic ${Buffer.from(`${utente}:${password}`).toString('base64')}` }
  });

  const corpo = await risposta.text();
  if (!risposta.ok) throw new Error(`Skebby non accetta utente e password (${risposta.status}). ${corpo}`.trim());

  const chiavi = leggiRispostaLogin(corpo);
  if (!chiavi) throw new Error('Skebby ha risposto al login in un modo che non riconosco.');

  chiaviInCorso.set(utente, chiavi);
  return chiavi;
}

/**
 * Controlla che utente e password siano giusti e dice quanti SMS restano.
 * Serve quando il salone collega il suo conto, e per mostrargli i crediti.
 */
export async function statoSkebby(conto: ContoSkebby): Promise<{ ok: boolean; motivo?: string; crediti?: number; euro?: number }> {
  let chiavi: Chiavi;
  try {
    chiaviInCorso.delete(conto.utente);
    chiavi = await entra(conto);
  } catch (err: any) {
    return { ok: false, motivo: /non accetta/.test(err?.message || '') ? 'Utente o password di Skebby non corretti.' : (err?.message || 'Skebby non risponde.') };
  }
  try {
    const r = await fetch(`${BASE}/status`, { headers: { 'Content-Type': 'application/json', 'user_key': chiavi.userKey, 'Session_key': chiavi.sessionKey } });
    if (!r.ok) return { ok: true };
    return { ok: true, ...leggiCrediti(await r.json().catch(() => ({})), conto.tipo || 'GP') };
  } catch {
    return { ok: true };
  }
}

/** Dalla risposta di `status`: quanti SMS del tipo usato restano, e il credito in euro. */
export function leggiCrediti(dati: any, tipo = 'GP'): { crediti?: number; euro?: number } {
  const elenco: any[] = Array.isArray(dati?.sms) ? dati.sms : [];
  const riga = elenco.find(x => x?.type === tipo) || elenco.find(x => Number(x?.quantity) > 0);
  const crediti = riga && Number.isFinite(Number(riga.quantity)) ? Number(riga.quantity) : undefined;
  const euro = Number.isFinite(Number(dati?.money)) ? Number(dati.money) : undefined;
  return { ...(crediti !== undefined ? { crediti } : {}), ...(euro !== undefined ? { euro } : {}) };
}

export interface EsitoSkebby { mandato: boolean; motivo?: string; creditiRimasti?: number }

async function provaAMandare(chiavi: Chiavi, numero: string, testo: string, conto: ContoSkebby) {
  const mittente = mittenteValido(conto.mittente);
  return fetch(`${BASE}/sms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user_key': chiavi.userKey,
      'Session_key': chiavi.sessionKey
    },
    body: JSON.stringify({
      // GP = "Classic Plus", quello con la conferma di consegna e il mittente
      // scritto a lettere. Si cambia da Vercel se il salone compra un altro
      // tipo di pacchetto.
      message_type: conto.tipo || 'GP',
      message: testo,
      recipient: [numero],
      ...(mittente ? { sender: mittente } : {}),
      returnCredits: true
    })
  });
}

/** Manda un SMS. `numero` va scritto internazionale, con il più davanti. */
export async function mandaConSkebby(numero: string, testo: string, contoScelto?: ContoSkebby | null): Promise<EsitoSkebby> {
  const conto = contoScelto || contoDelServer();
  if (!conto) throw new Error('skebby-non-configurato');
  let chiavi = chiaviInCorso.get(conto.utente) || await entra(conto);

  let risposta = await provaAMandare(chiavi, numero, testo, conto);

  // Le chiavi scadono. Se è quello, ci si ripresenta una volta sola: se
  // riprovassimo all'infinito, un utente sbagliato diventerebbe un ciclo.
  if (risposta.status === 401 || risposta.status === 403) {
    chiaviInCorso.delete(conto.utente);
    chiavi = await entra(conto);
    risposta = await provaAMandare(chiavi, numero, testo, conto);
  }

  const corpo = await risposta.text();
  if (!risposta.ok) {
    return { mandato: false, motivo: `Skebby ha rifiutato l'invio (${risposta.status}). ${corpo}`.trim() };
  }

  try {
    const dati = JSON.parse(corpo);
    if (dati.result && dati.result !== 'OK') {
      return { mandato: false, motivo: `Skebby dice: ${dati.result}` };
    }
    return { mandato: true, creditiRimasti: dati.remaining_credits };
  } catch {
    // Risposta senza JSON ma con esito buono: si prende per buona.
    return { mandato: true };
  }
}
