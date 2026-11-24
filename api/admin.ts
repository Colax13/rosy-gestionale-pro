// POST /api/admin — il pannello di chi gestisce Rosy (non dei saloni).
//
// Due cose: vedere i saloni iscritti (prova, piano, quanto usano l'IA) e
// attivare o togliere un piano a mano, finché i pagamenti con carta non ci
// sono. È il solo punto che scrive `abbonamenti/{salone}`.
//
// Entra solo chi ha l'indirizzo scritto in ADMIN_EMAILS (su Vercel, separati
// da virgola). Senza quella variabile non entra nessuno.
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { database, chiEntra } from './_firebase';
import { eGestore } from '../salone-app/frontend/lib/funzioni';
import { PIANI, Piano, statoAccesso, aData } from '../salone-app/frontend/lib/piani';
import { meseDi, idConsumo } from '../salone-app/frontend/lib/consumi-ia';

interface Richiesta { method?: string; body?: any; headers?: Record<string, string | string[] | undefined> }
interface Risposta {
  status(codice: number): Risposta;
  json(corpo: unknown): void;
  setHeader(nome: string, valore: string): void;
}

function corpo(req: Richiesta): any {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

const intestazione = (req: Richiesta, nome: string): string => {
  const v = req.headers?.[nome] ?? req.headers?.[nome.toLowerCase()];
  return Array.isArray(v) ? v[0] : (v || '');
};

/** True se quell'indirizzo gestisce Rosy: conta solo la variabile del server. */
const eAdmin = (email: string | null | undefined) => eGestore(email, process.env.ADMIN_EMAILS || '');

export default async function handler(req: Richiesta, res: Risposta) {
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || '').toUpperCase() !== 'POST') {
    res.status(405).json({ errore: 'Questo indirizzo risponde solo in POST.' });
    return;
  }

  let chi: any;
  try {
    chi = await chiEntra(intestazione(req, 'authorization'));
  } catch (err: any) {
    const senzaChiave = err?.message === 'chiave-mancante';
    res.status(senzaChiave ? 503 : 401).json({
      errore: senzaChiave ? 'Il server non è ancora configurato: manca FIREBASE_SERVICE_ACCOUNT.' : 'Richiesta non riconosciuta: esci e rientra.'
    });
    return;
  }
  if (!eAdmin(chi.email)) {
    res.status(403).json({ errore: 'Questa pagina è solo per chi gestisce Rosy.' });
    return;
  }

  try {
    const db = database();
    const { azione, salonId, piano, mesi, nota } = corpo(req);

    if (azione === 'attiva' || azione === 'togli') {
      if (!salonId || typeof salonId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(salonId)) {
        res.status(400).json({ errore: 'Manca il salone.' });
        return;
      }
      const rif = db.collection('abbonamenti').doc(salonId);
      if (azione === 'togli') {
        await rif.delete();
        res.status(200).json({ fatto: true });
        return;
      }
      if (!piano || !PIANI[piano as Piano]) {
        res.status(400).json({ errore: 'Piano non valido.' });
        return;
      }
      const quantiMesi = Math.trunc(Number(mesi) || 0);
      const dati: any = {
        piano,
        attivato_il: FieldValue.serverTimestamp(),
        attivato_da: chi.email || chi.uid,
        nota: typeof nota === 'string' ? nota.slice(0, 300) : ''
      };
      // Senza mesi il piano non scade: lo si toglie a mano.
      if (quantiMesi > 0) {
        const fine = new Date();
        fine.setMonth(fine.getMonth() + quantiMesi);
        dati.fino_al = Timestamp.fromDate(fine);
      } else {
        dati.fino_al = null;
      }
      await rif.set(dati);
      res.status(200).json({ fatto: true });
      return;
    }

    // L'elenco dei saloni. Finché sono qualche centinaio si legge tutto.
    const [saloni, abbonamenti] = await Promise.all([
      db.collection('salons').get(),
      db.collection('abbonamenti').get()
    ]);
    const perSalone = new Map(abbonamenti.docs.map(d => [d.id, d.data() as any]));
    const mese = meseDi();
    const consumi = saloni.empty ? [] : await db.getAll(...saloni.docs.map(d => db.collection('consumi_ia').doc(idConsumo(d.id, mese))));
    const adesso = new Date();

    const elenco = saloni.docs.map((d, i) => {
      const s = d.data() as any;
      const abb = perSalone.get(d.id) || null;
      const accesso = statoAccesso(s.createdAt, abb, adesso);
      return {
        id: d.id,
        nome: s.salonDetails?.nomeSalone || '',
        email: s.ownerEmail || '',
        indirizzo: s.indirizzo || '',
        telefono: s.salonDetails?.telefono || '',
        iscritto_il: aData(s.createdAt)?.toISOString() || null,
        piano: accesso.piano,
        in_prova: accesso.inProva,
        giorni_prova: accesso.giorniProva,
        scaduto: accesso.scaduto,
        scadenza: accesso.scadenza?.toISOString() || null,
        nota: abb?.nota || '',
        domande_ia_mese: consumi[i]?.exists ? Number((consumi[i].data() as any).domande) || 0 : 0
      };
    }).sort((a, b) => (b.iscritto_il || '').localeCompare(a.iscritto_il || ''));

    res.status(200).json({ saloni: elenco, mese });
  } catch (err: any) {
    console.error('Admin: errore', err);
    res.status(500).json({ errore: err?.message || 'Errore del server.' });
  }
}
