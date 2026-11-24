// GET /api/pagina?indirizzo=rdsalon — la pagina di prenotazione dall'indirizzo
// corto, con l'anteprima del salone nell'intestazione.
//
// Ci arriva chi apre rosy.it/rdsalon (vedi `vercel.json`). Si risponde con la
// pagina del programma, identica, ma con titolo, descrizione e immagine di
// QUEL salone: è quello che WhatsApp e Instagram mostrano quando si incolla
// il link. Se qualcosa non va (salone che non esiste, database giù) si manda
// la pagina com'è: il link deve aprirsi sempre.
import { database } from './_firebase';
import { indirizzoValido } from '../salone-app/frontend/lib/indirizzo';
import { conAnteprima } from '../salone-app/frontend/lib/anteprima-link';

interface Richiesta { url?: string; query?: Record<string, string | string[]>; headers?: Record<string, string | string[] | undefined> }
interface Risposta {
  status(codice: number): Risposta;
  send(corpo: string): void;
  setHeader(nome: string, valore: string): void;
}

const intestazione = (req: Richiesta, nome: string): string => {
  const v = req.headers?.[nome];
  return (Array.isArray(v) ? v[0] : v) || '';
};

// La pagina del programma si rilegge ogni tanto, non a ogni richiesta.
let pagina: { html: string; quando: number; origine: string } | null = null;
const MEMORIA_MS = 5 * 60 * 1000;

async function paginaDelProgramma(origine: string): Promise<string> {
  if (pagina && pagina.origine === origine && Date.now() - pagina.quando < MEMORIA_MS) return pagina.html;
  const r = await fetch(`${origine}/index.html`, { headers: { 'x-rosy-interno': '1' } });
  if (!r.ok) throw new Error(`index.html: ${r.status}`);
  const html = await r.text();
  pagina = { html, quando: Date.now(), origine };
  return html;
}

export default async function handler(req: Richiesta, res: Risposta) {
  const host = intestazione(req, 'x-forwarded-host') || intestazione(req, 'host');
  const origine = `https://${host}`;
  const grezzo = req.query?.indirizzo ?? new URL(req.url || '/', 'http://x').searchParams.get('indirizzo');
  const indirizzo = ((Array.isArray(grezzo) ? grezzo[0] : grezzo) || '').toLowerCase();

  let html: string;
  try {
    html = await paginaDelProgramma(origine);
  } catch (err) {
    // Senza la pagina non c'è niente da mostrare: si rimanda a quella vera.
    console.error('Pagina: non leggo index.html', err);
    res.setHeader('Location', '/index.html');
    res.status(302).send('');
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  try {
    if (!indirizzoValido(indirizzo)) throw new Error('indirizzo non valido');
    const db = database();
    const trovato = await db.collection('indirizzi').doc(indirizzo).get();
    const salonId = trovato.exists ? (trovato.data() as any)?.salonId : null;
    if (!salonId) throw new Error('nessun salone');
    const dettagli = ((await db.collection('salons').doc(salonId).get()).data() as any)?.salonDetails || {};
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).send(conAnteprima(html, {
      nome: (dettagli.nomeSalone || '').trim(),
      descrizione: dettagli.descrizioneGenerale || '',
      logo: dettagli.logoUrl || '',
      url: `${origine}/${indirizzo}`,
      immagineDiRiserva: `${origine}/icone/icona-512.png`
    }));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  }
}
