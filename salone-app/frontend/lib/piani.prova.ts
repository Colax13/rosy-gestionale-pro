import { statoAccesso, paginaNelPiano, etichettaAccesso, fineProva, GIORNI_PROVA } from './piani';
import { conAnteprima, titoloAnteprima, logoUsabile } from './anteprima-link';
import { indirizzoDaNome, erroreIndirizzo, linkCorto, linkDaLeggere, sembraIndirizzo } from './indirizzo';

let ok = 0, ko = 0;
const check = (nome: string, atteso: any, avuto: any) => {
  const uguale = JSON.stringify(atteso) === JSON.stringify(avuto);
  console.log(uguale ? `  OK   ${nome}` : `  KO   ${nome}\n       atteso: ${JSON.stringify(atteso)}\n       avuto:  ${JSON.stringify(avuto)}`);
  uguale ? ok++ : ko++;
};

const oggi = new Date('2027-01-20T10:00:00Z');
const giorniFa = (n: number) => new Date(oggi.getTime() - n * 86400000);
const fra = (n: number) => new Date(oggi.getTime() + n * 86400000);
const breve = (a: any) => [a.livello, a.piano, a.inProva, a.giorniProva, a.scaduto];

check('appena iscritto: prova piena', ['pro', null, true, GIORNI_PROVA, false], breve(statoAccesso(oggi, null, oggi)));
check('a metà prova', ['pro', null, true, 9, false], breve(statoAccesso(giorniFa(5), null, oggi)));
check('ultimo giorno', 1, statoAccesso(giorniFa(13.5), null, oggi).giorniProva);
check('prova finita', ['nessuno', null, false, 0, true], breve(statoAccesso(giorniFa(15), null, oggi)));
check('piano base', ['base', 'base', false, 0, false], breve(statoAccesso(giorniFa(60), { piano: 'base' }, oggi)));
check('piano pro con scadenza futura', ['pro', 'pro', false, 0, false], breve(statoAccesso(giorniFa(60), { piano: 'pro', fino_al: fra(10) }, oggi)));
check('fondatori vale come pro', 'pro', statoAccesso(giorniFa(60), { piano: 'fondatori' }, oggi).livello);
check('piano scaduto e prova finita: fermo', ['nessuno', null, false, 0, true], breve(statoAccesso(giorniFa(60), { piano: 'pro', fino_al: giorniFa(1) }, oggi)));
check('piano scaduto ma ancora in prova', ['pro', null, true, 4, false], breve(statoAccesso(giorniFa(10), { piano: 'base', fino_al: giorniFa(1) }, oggi)));
check('piano inventato non vale', true, statoAccesso(giorniFa(60), { piano: 'oro' as any }, oggi).scaduto);
check('data di nascita ignota: si lascia lavorare', ['pro', null, true, GIORNI_PROVA, false], breve(statoAccesso(null, null, oggi)));
check('data come Timestamp di Firestore', 9, statoAccesso({ seconds: giorniFa(5).getTime() / 1000 }, null, oggi).giorniProva);
check('piano base durante la prova: vale il piano', 'base', statoAccesso(giorniFa(2), { piano: 'base' }, oggi).livello);
check('fine prova', fra(GIORNI_PROVA).toISOString(), fineProva(oggi)!.toISOString());

check('agenda nel base', true, paginaNelPiano('agenda', 'base'));
check('buoni non nel base', false, paginaNelPiano('buoni', 'base'));
check('buoni nel pro', true, paginaNelPiano('buoni', 'pro'));
check('niente a prova finita', false, paginaNelPiano('agenda', 'nessuno'));
check('etichetta prova', 'Prova gratuita · 9 giorni', etichettaAccesso(statoAccesso(giorniFa(5), null, oggi)));
check('etichetta ultimo giorno', 'Prova gratuita · 1 giorno', etichettaAccesso(statoAccesso(giorniFa(13.5), null, oggi)));
check('etichetta piano', 'Piano Fondatori', etichettaAccesso(statoAccesso(oggi, { piano: 'fondatori' }, oggi)));

// --- l'indirizzo corto
check('dal nome', 'rd-salon-e-spa', indirizzoDaNome('RD Salon & Spa'));
check('accenti e simboli', 'perle-e-forbici', indirizzoDaNome('  Perlé è Forbici!! '));
check('nome riservato', 'salone-agenda', indirizzoDaNome('Agenda'));
check('nome troppo corto', 'salone-ab', indirizzoDaNome('Ab'));
check('nome vuoto', '', indirizzoDaNome('***'));
check('valido', '', erroreIndirizzo('rdsalon'));
check('maiuscole no', true, erroreIndirizzo('RdSalon') !== '');
check('spazi no', true, erroreIndirizzo('rd salon') !== '');
check('trattino in testa no', true, erroreIndirizzo('-rdsalon') !== '');
check('riservato no', true, erroreIndirizzo('clienti') !== '');
check('corto no', true, erroreIndirizzo('rd') !== '');
check('un codice salone non sembra un indirizzo', false, sembraIndirizzo('Xk29fJqLmN0pQrStUvWxYz012345'));
check('link corto', 'https://rosy.it/rdsalon', linkCorto('https://rosy.it/', 'rdsalon', 'abc'));
check('link lungo senza indirizzo', 'https://rosy.it/abc/prenota', linkCorto('https://rosy.it', null, 'abc'));
check('da leggere', 'rosy.it/rdsalon', linkDaLeggere('https://rosy.it/rdsalon'));

// --- l'anteprima del link
const paginaBase = '<html><head><title>Rosy</title><meta charset="utf-8"></head><body></body></html>';
const conTag = conAnteprima(paginaBase, { nome: 'RD "Salon" <b>', descrizione: '', logo: 'https://x.it/logo.png', url: 'https://rosy.it/rdsalon', immagineDiRiserva: 'https://rosy.it/icone/icona-512.png' });
check('titolo', 'Prenota ora da RD Salon', titoloAnteprima(' RD Salon '));
check('titolo nella pagina, ripulito', true, conTag.includes('<title>Prenota ora da RD &quot;Salon&quot; &lt;b&gt;</title>'));
check('un titolo solo', 1, (conTag.match(/<title>/g) || []).length);
check('immagine del salone', true, conTag.includes('og:image" content="https://x.it/logo.png"'));
check('indirizzo della pagina', true, conTag.includes('og:url" content="https://rosy.it/rdsalon"'));
check('logo incollato dentro la scheda: non si usa', false, logoUsabile('data:image/png;base64,AAAA'));
check('senza logo: immagine di riserva', true, conAnteprima(paginaBase, { nome: 'X', url: 'u', immagineDiRiserva: 'https://rosy.it/i.png' }).includes('og:image" content="https://rosy.it/i.png"'));

console.log(`\n${ok} ok, ${ko} ko`);
if (ko) process.exit(1);
