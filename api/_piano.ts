// Che cosa può usare un salone, visto dal server.
//
// Il browser nasconde le pagine che il piano non ha, ma chi sa scrivere una
// richiesta a mano le salterebbe: per le cose che costano (l'IA) o che
// toccano le clienti (la prenotazione online) il controllo si rifà qui.
import type { Firestore } from 'firebase-admin/firestore';
import { statoAccesso, Accesso } from '../salone-app/frontend/lib/piani';

const memoria = new Map<string, { quando: number; accesso: Accesso }>();
const MEMORIA_MS = 60 * 1000;

export async function accessoDelSalone(db: Firestore, salonId: string): Promise<Accesso> {
  const c = memoria.get(salonId);
  if (c && Date.now() - c.quando < MEMORIA_MS) return c.accesso;
  const [scheda, abbonamento] = await Promise.all([
    db.collection('salons').doc(salonId).get(),
    db.collection('abbonamenti').doc(salonId).get()
  ]);
  const accesso = statoAccesso(
    scheda.exists ? (scheda.data() as any)?.createdAt : new Date(),
    abbonamento.exists ? (abbonamento.data() as any) : null
  );
  memoria.set(salonId, { quando: Date.now(), accesso });
  return accesso;
}
