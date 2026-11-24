// Le parti di Skebby che si possono provare senza chiamarli davvero.
import { cifra, decifra, nascondi } from '../../../api/_conto-sms';
import { leggiCrediti } from '../../../api/_skebby';
import { leggiRispostaLogin, mittenteValido } from '../../../api/_skebby';

let ok = 0, ko = 0;
const check = (nome: string, atteso: any, avuto: any) => {
  const uguale = JSON.stringify(atteso) === JSON.stringify(avuto);
  console.log(uguale ? `  OK   ${nome}` : `  KO   ${nome}\n       atteso: ${JSON.stringify(atteso)}\n       avuto:  ${JSON.stringify(avuto)}`);
  uguale ? ok++ : ko++;
};

check('risposta in testo semplice', { userKey: 'UK123', sessionKey: 'SK456' }, leggiRispostaLogin('UK123;SK456'));
check('con spazi e a capo',         { userKey: 'UK123', sessionKey: 'SK456' }, leggiRispostaLogin('  UK123 ; SK456 \n'));
check('risposta in JSON',           { userKey: 'UK1', sessionKey: 'SK1' }, leggiRispostaLogin('{"user_key":"UK1","session_key":"SK1"}'));
check('JSON con il token',          { userKey: 'UK1', sessionKey: 'TOK' }, leggiRispostaLogin('{"user_key":"UK1","access_token":"TOK"}'));
check('risposta vuota',             null, leggiRispostaLogin(''));
check('risposta a metà',            null, leggiRispostaLogin('UK123'));
check('JSON rotto',                 null, leggiRispostaLogin('{"user_key":'));

check('mittente normale',      'RD SALON',    mittenteValido('RD SALON'));
check('mittente con simboli',  'RDSALON',     mittenteValido('RD_SALON!'));
check('mittente troppo lungo', 'RD SALON Pa', mittenteValido('RD SALON Parrucchieri'));
check('mittente assente',      '',            mittenteValido(undefined));

// --- i crediti e il conto del salone
check('crediti del tipo usato', { crediti: 412, euro: 3.5 }, leggiCrediti({ money: 3.5, sms: [{ type: 'SI', quantity: 9 }, { type: 'GP', quantity: 412 }] }, 'GP'));
check('crediti: tipo assente, si prende quello che c\'è', { crediti: 9 }, leggiCrediti({ sms: [{ type: 'SI', quantity: 9 }] }, 'GP'));
check('crediti: risposta vuota', {}, leggiCrediti({}));

const SEGRETO = 'una-chiave-lunga-per-le-prove';
const busta = cifra('password segreta!', SEGRETO);
check('la password cifrata non si legge', false, busta.includes('segreta'));
check('e si decifra con la stessa chiave', 'password segreta!', decifra(busta, SEGRETO));
check('due cifrature sono diverse', true, cifra('x', SEGRETO) !== cifra('x', SEGRETO));
let sbagliata = false;
try { decifra(busta, 'un-altra-chiave-lunga-diversa'); } catch { sbagliata = true; }
check('con un\'altra chiave non si apre', true, sbagliata);
let senza = '';
try { cifra('x', ''); } catch (e: any) { senza = e.message; }
check('senza chiave non si salva niente', 'segreto-mancante', senza);
check('utente nascosto', 'ma•••@salone.it', nascondi('mario.rossi@salone.it'));
check('utente senza chiocciola', 'ma•••', nascondi('mariorossi'));

console.log(`\n${ok} passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);
