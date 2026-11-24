/**
 * L'anteprima del link di prenotazione: quello che WhatsApp, Instagram,
 * Facebook e iMessage mostrano quando si incolla rosy.it/rdsalon — la foto
 * del salone, il nome e "Prenota ora", invece di un indirizzo nudo.
 *
 * Quei programmi non eseguono il gestionale: leggono solo l'intestazione
 * della pagina. Per questo il server (`api/pagina.ts`) la riscrive per ogni
 * salone prima di mandarla. Qui il testo e l'inserimento, senza rete, così
 * si provano da soli.
 */

export interface DatiAnteprima {
  nome: string;
  descrizione?: string;
  logo?: string;
  /** L'indirizzo completo della pagina: https://rosy.it/rdsalon */
  url: string;
  /** L'immagine da usare se il salone non ha un logo raggiungibile. */
  immagineDiRiserva: string;
}

const pulisci = (t: string) => String(t || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Un logo va bene solo se è un indirizzo https vero (non un'immagine incollata dentro la scheda). */
export const logoUsabile = (logo?: string) => !!logo && /^https:\/\/[^\s"'<>]+$/.test(logo) && logo.length < 600;

export function titoloAnteprima(nome: string): string {
  const n = (nome || '').trim();
  return n ? `Prenota ora da ${n}` : 'Prenota ora';
}

export function descrizioneAnteprima(d: Pick<DatiAnteprima, 'nome' | 'descrizione'>): string {
  const sua = (d.descrizione || '').replace(/\s+/g, ' ').trim();
  const base = 'Scegli il servizio e l\'orario: prenoti online in un minuto, senza telefonare.';
  return sua ? `${sua.slice(0, 140)}${sua.length > 140 ? '…' : ''} · Prenota online.` : base;
}

/** Le righe da mettere nell'intestazione della pagina. */
export function etichetteAnteprima(d: DatiAnteprima): string {
  const titolo = pulisci(titoloAnteprima(d.nome));
  const descrizione = pulisci(descrizioneAnteprima(d));
  const immagine = pulisci(logoUsabile(d.logo) ? d.logo! : d.immagineDiRiserva);
  const url = pulisci(d.url);
  return [
    `<title>${titolo}</title>`,
    `<meta name="description" content="${descrizione}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${pulisci(d.nome || 'Rosy')}" />`,
    `<meta property="og:title" content="${titolo}" />`,
    `<meta property="og:description" content="${descrizione}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${immagine}" />`,
    `<meta property="og:locale" content="it_IT" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${titolo}" />`,
    `<meta name="twitter:description" content="${descrizione}" />`,
    `<meta name="twitter:image" content="${immagine}" />`,
    `<link rel="canonical" href="${url}" />`
  ].join('\n    ');
}

/** La pagina del programma con l'intestazione di quel salone al posto del titolo generico. */
export function conAnteprima(html: string, d: DatiAnteprima): string {
  const etichette = etichetteAnteprima(d);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) return html.replace(/<title>[\s\S]*?<\/title>/i, etichette);
  return html.replace(/<\/head>/i, `    ${etichette}\n  </head>`);
}
