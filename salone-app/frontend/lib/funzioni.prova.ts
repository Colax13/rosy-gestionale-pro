// Prova di che cosa vede chi entra: le pagine dipendono dal piano del salone
// e dai permessi della persona; SMS e foglio dei buoni dall'elenco dei saloni.
// Qui si controlla solo la maniglia; la serratura è in firestore.rules.
import { funzioneAccesa, eRiservata, normalizzaEmail, leggiElenco } from './funzioni';
import { impostaSessione, puoVedere, puoAprirePercorso, pagineConcedibili, primaPaginaPermessa, Sessione } from './sessione';
import { statoAccesso, Abbonamento } from './piani';

let ok = 0, ko = 0;
const check = (nome: string, atteso: any, avuto: any) => {
  const uguale = JSON.stringify(atteso) === JSON.stringify(avuto);
  console.log(uguale ? `  OK   ${nome}` : `  KO   ${nome}\n       atteso: ${JSON.stringify(atteso)}\n       avuto:  ${JSON.stringify(avuto)}`);
  uguale ? ok++ : ko++;
};

// --- SMS e foglio: salone per salone ----------------------------------------
const ELENCO = 'titolare@salone.it, Altro@Salone.it';
check('gli SMS sono riservati',          true,  eRiservata('messaggi_automatici'));
check('i buoni non più: sono del piano', false, eRiservata('buoni'));
check('accesi per chi è in elenco',      true,  funzioneAccesa('messaggi_automatici', ' Titolare@Salone.it ', ELENCO));
check('spenti per gli altri',            false, funzioneAccesa('messaggi_automatici', 'nuovo@salone.it', ELENCO));
check('spenti senza elenco',             false, funzioneAccesa('messaggi_automatici', 'titolare@salone.it', ''));
check('spenti se non si sa di chi è',    false, funzioneAccesa('messaggi_automatici', null, ELENCO));
check('una pagina normale è per tutti',  true,  funzioneAccesa('agenda', 'chiunque@esempio.it', ''));
check('indirizzo ripulito',              'a@b.it', normalizzaEmail(' A@B.IT '));
check('elenco letto',                    ['a@b.it', 'c@d.it'], leggiElenco('A@b.it;  c@d.it,'));

// --- le pagine: piano del salone e permessi della persona -------------------
const adesso = new Date();
const giorniFa = (n: number) => new Date(adesso.getTime() - n * 86400000);
const con = (nato: Date, abbonamento: Abbonamento | null, permessi: any = null): Sessione => ({
  uid: 'u', salonId: 's', titolare: permessi === null, nome: 'Rosanna', permessi, emailSalone: 't@s.it',
  accesso: statoAccesso(nato, abbonamento, adesso)
});

impostaSessione(con(giorniFa(2), null));
check('in prova: i buoni ci sono',            true, puoVedere('buoni'));
check('in prova: i prodotti ci sono',         true, puoAprirePercorso('/prodotti'));
check('in prova: i buoni si possono concedere', true, pagineConcedibili().some(p => p.chiave === 'buoni'));

impostaSessione(con(giorniFa(40), { piano: 'base' }));
check('base: niente buoni',                   false, puoVedere('buoni'));
check('base: voce sparita dal menù',          false, puoAprirePercorso('/buoni-spa'));
check('base: niente report',                  false, puoAprirePercorso('/report'));
check('base: niente da concedere',            false, pagineConcedibili().some(p => p.chiave === 'buoni'));
check('base: l\'agenda resta',                true,  puoAprirePercorso('/agenda'));
check('base: i clienti restano',              true,  puoAprirePercorso('/clienti'));

impostaSessione(con(giorniFa(40), { piano: 'pro' }));
check('pro: buoni, prodotti, report',         [true, true, true], [puoVedere('buoni'), puoVedere('prodotti'), puoVedere('report')]);

impostaSessione(con(giorniFa(40), { piano: 'fondatori' }));
check('fondatori: come il pro',               true, puoVedere('automazioni'));

impostaSessione(con(giorniFa(40), null));
check('prova finita: agenda chiusa',          false, puoAprirePercorso('/agenda'));
check('prova finita: le impostazioni restano', true, puoAprirePercorso('/settings'));

impostaSessione(con(giorniFa(40), { piano: 'pro' }, ['agenda', 'buoni']));
check('operatrice con il permesso',           true,  puoVedere('buoni'));
impostaSessione(con(giorniFa(40), { piano: 'pro' }, ['agenda']));
check('operatrice senza il permesso',         false, puoVedere('buoni'));

// Il permesso scritto nella sua scheda non basta: se il piano non ha la
// pagina, non esiste per nessuno.
impostaSessione(con(giorniFa(40), { piano: 'base' }, ['buoni']));
check('permesso senza piano: chiuso',         false, puoVedere('buoni'));
check('e non ci finisce nemmeno dopo l\'accesso', '/agenda', primaPaginaPermessa());

// Senza informazioni sul piano (anteprima) è tutto acceso.
impostaSessione({ uid: 'u', salonId: 's', titolare: true, nome: 'R', permessi: null, emailSalone: null });
check('anteprima: tutto acceso',              true, puoVedere('buoni'));

console.log(`\n${ok} passate, ${ko} fallite`);
if (ko) process.exit(1);
