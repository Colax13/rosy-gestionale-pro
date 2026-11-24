/**
 * L'indirizzo corto del salone: rosy.it/rdsalon invece di
 * rosy.it/Xk29fJ…/prenota. È quello che si mette nella bio di Instagram, su
 * WhatsApp e sul cartello col QR.
 *
 * Il salone lo sceglie da solo (glielo si propone dal nome); sta in
 * `indirizzi/{indirizzo}` → il suo salone. Chi arriva prima lo prende.
 * Qui solo le regole su come dev'essere scritto.
 */

export const LUNGHEZZA_MINIMA = 3;
export const LUNGHEZZA_MASSIMA = 40;

/**
 * Parole che non possono essere l'indirizzo di un salone: sono pagine del
 * gestionale o del sito. Lo stesso elenco sta in `vercel.json`, nella riga
 * che manda gli indirizzi corti alla loro anteprima.
 */
export const RISERVATI = [
  'agenda', 'clienti', 'catalogo', 'report', 'dipendenti', 'settings', 'prodotti', 'automazioni',
  'buoni-spa', 'buoni', 'rosy', 'rosie', 'hub', 'admin', 'api', 'assets', 'icone', 'accesso', 'login',
  'prenota', 'privacy', 'termini', 'prezzi', 'piani', 'demo', 'anteprima', 'www', 'app', 'help', 'aiuto',
  'index', 'manifest', 'favicon', 'robots', 'sitemap', 'rosy-chat'
];

/** Dal nome del salone a un indirizzo proponibile: "RD Salon & Spa" → "rd-salon-spa". */
export function indirizzoDaNome(nome: string): string {
  const pulito = (nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LUNGHEZZA_MASSIMA)
    .replace(/-+$/g, '');
  if (pulito.length >= LUNGHEZZA_MINIMA && !RISERVATI.includes(pulito)) return pulito;
  return pulito ? `salone-${pulito}`.slice(0, LUNGHEZZA_MASSIMA) : '';
}

/** Che cosa non va in quell'indirizzo. Vuoto = va bene. */
export function erroreIndirizzo(indirizzo: string): string {
  const i = indirizzo || '';
  if (i.length < LUNGHEZZA_MINIMA) return `Almeno ${LUNGHEZZA_MINIMA} caratteri.`;
  if (i.length > LUNGHEZZA_MASSIMA) return `Al massimo ${LUNGHEZZA_MASSIMA} caratteri.`;
  if (!/^[a-z0-9-]+$/.test(i)) return 'Solo lettere minuscole, numeri e trattini (niente spazi né accenti).';
  if (!/^[a-z0-9]/.test(i) || !/[a-z0-9]$/.test(i)) return 'Deve cominciare e finire con una lettera o un numero.';
  if (/--/.test(i)) return 'Niente due trattini di fila.';
  if (RISERVATI.includes(i)) return 'Questo nome è riservato: scegline un altro.';
  return '';
}

export const indirizzoValido = (indirizzo: string) => erroreIndirizzo(indirizzo) === '';

/** True se quel pezzo di percorso ("/rdsalon") può essere l'indirizzo di un salone. */
export function sembraIndirizzo(pezzo: string): boolean {
  return indirizzoValido(pezzo);
}

/** Il link di prenotazione da condividere: quello corto se il salone ce l'ha. */
export function linkCorto(origine: string, indirizzo: string | null | undefined, salonId: string): string {
  const base = (origine || '').replace(/\/+$/, '');
  return indirizzo && indirizzoValido(indirizzo) ? `${base}/${indirizzo}` : `${base}/${salonId}/prenota`;
}

/** Come si legge il link su un cartello: senza "https://". */
export const linkDaLeggere = (link: string) => (link || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
