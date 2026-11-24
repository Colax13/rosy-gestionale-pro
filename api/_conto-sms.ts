// Il conto SMS di ogni salone.
//
// Rosy non paga gli SMS dei saloni: ogni salone collega il SUO conto Skebby
// (pagina Automazioni), compra lì i suoi crediti e i messaggi partono da lì,
// col suo nome come mittente. Qui si tengono utente e password di quel conto.
//
// Dove stanno: `conti_sms/{salone}`, una raccolta che le regole del database
// non lasciano leggere né scrivere a nessun browser — passa tutto dal server.
// La password è cifrata con una chiave che sta solo nelle variabili del
// server (SEGRETO_CONTI_SMS): chi leggesse il database non la vedrebbe.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { ContoSkebby, mittenteValido } from './_skebby';
import { postinoSms } from './_messaggi';
import { accessoDelSalone } from './_piano';
import { funzioneAccesa } from '../salone-app/frontend/lib/funzioni';

const RACCOLTA = 'conti_sms';

function chiave(segreto = process.env.SEGRETO_CONTI_SMS): Buffer {
  if (!segreto || segreto.length < 16) throw new Error('segreto-mancante');
  return createHash('sha256').update(segreto).digest();
}

/** Cifra un testo: esce "iv.etichetta.cifrato" in base64. */
export function cifra(testo: string, segreto?: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chiave(segreto), iv);
  const cifrato = Buffer.concat([c.update(testo, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), cifrato].map(b => b.toString('base64')).join('.');
}

export function decifra(busta: string, segreto?: string): string {
  const [iv, etichetta, cifrato] = (busta || '').split('.').map(p => Buffer.from(p, 'base64'));
  const d = createDecipheriv('aes-256-gcm', chiave(segreto), iv);
  d.setAuthTag(etichetta);
  return Buffer.concat([d.update(cifrato), d.final()]).toString('utf8');
}

/** "mario.rossi@salone.it" → "ma•••@salone.it": per mostrarlo senza scriverlo tutto. */
export function nascondi(utente: string): string {
  const [nome, dominio] = (utente || '').split('@');
  const visibile = nome.slice(0, 2);
  return dominio ? `${visibile}•••@${dominio}` : `${visibile}•••`;
}

const memoria = new Map<string, { quando: number; conto: ContoSkebby | null }>();
const MEMORIA_MS = 60 * 1000;

/** Il conto Skebby collegato da quel salone. null = non ne ha. */
export async function contoDelSalone(db: Firestore, salonId: string): Promise<ContoSkebby | null> {
  const c = memoria.get(salonId);
  if (c && Date.now() - c.quando < MEMORIA_MS) return c.conto;
  let conto: ContoSkebby | null = null;
  const doc = await db.collection(RACCOLTA).doc(salonId).get();
  if (doc.exists) {
    const d = doc.data() as any;
    try {
      conto = { utente: d.utente, password: decifra(d.password), mittente: d.mittente || '' };
    } catch (err) {
      console.error('Conto SMS: non riesco a decifrare la password di', salonId, err);
    }
  }
  memoria.set(salonId, { quando: Date.now(), conto });
  return conto;
}

export async function salvaConto(db: Firestore, salonId: string, conto: ContoSkebby): Promise<void> {
  await db.collection(RACCOLTA).doc(salonId).set({
    userId: salonId,
    utente: conto.utente,
    password: cifra(conto.password),
    mittente: mittenteValido(conto.mittente),
    collegato_il: FieldValue.serverTimestamp()
  });
  memoria.delete(salonId);
}

export async function togliConto(db: Firestore, salonId: string): Promise<void> {
  await db.collection(RACCOLTA).doc(salonId).delete();
  memoria.delete(salonId);
}

export interface SmsDelSalone {
  /** Si possono mandare SMS per questo salone, adesso. */
  attivi: boolean;
  /** Il conto da usare: quello del salone, o null per il postino del server. */
  conto: ContoSkebby | null;
  /** Perché no, detto in modo che si sappia cosa fare. */
  motivo?: string;
}

/**
 * Gli SMS di un salone partono se:
 *  - il salone è in prova o ha il piano Pro (i messaggi automatici sono lì);
 *  - e ha collegato il suo conto SMS — oppure è fra i saloni a cui chi
 *    gestisce Rosy ha acceso il postino del server (SALONI_CON_SMS).
 */
export async function smsDelSalone(db: Firestore, salonId: string, emailTitolare?: string | null): Promise<SmsDelSalone> {
  if ((await accessoDelSalone(db, salonId)).livello !== 'pro') {
    return { attivi: false, conto: null, motivo: 'i messaggi automatici fanno parte del piano Pro.' };
  }
  const conto = await contoDelSalone(db, salonId);
  if (conto) return { attivi: true, conto };
  if (postinoSms() && funzioneAccesa('messaggi_automatici', emailTitolare)) return { attivi: true, conto: null };
  return { attivi: false, conto: null, motivo: 'il salone non ha ancora collegato un conto SMS (pagina Automazioni).' };
}
