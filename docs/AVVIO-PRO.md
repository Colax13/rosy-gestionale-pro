# Rosy — mettere in linea il prodotto

Questo repo è la versione **in vendita** di Rosy. È nato copiando il gestionale
di un salone, ma da qui in poi è separato: **progetto Firebase suo, dominio
suo, chiavi sue**. Niente di quel salone deve finire qui dentro.

Il codice è pronto. Quello che segue lo puoi fare solo tu, perché servono i
tuoi account. Ordine consigliato; tempo: un'ora circa.

## 1. Firebase nuovo (gratis per cominciare)

1. https://console.firebase.google.com → **Aggiungi progetto** (es. `rosy-pro`).
2. **Authentication** → Inizia → attiva **Google** e **Email/password**.
3. **Firestore Database** → Crea database → modalità produzione → zona `eur3`.
4. **Regole**: Firestore → Regole → incolla TUTTO il file `firestore.rules` di
   questo repo → Pubblica.
5. **Indici**: Firestore → Indici → crea l'indice composto su `appuntamenti`:
   `userId` crescente + `data_ora` crescente (e quello su `disponibilita`:
   `userId` + `giorno`). Sono scritti in `firestore.indexes.json`.
6. **Chiavi del browser**: Impostazioni progetto → Le tue app → **</> Web** →
   registra l'app → copia i valori nelle variabili `VITE_FIREBASE_…`.
7. **Chiave del server**: Impostazioni progetto → Account di servizio →
   **Genera nuova chiave privata** → il contenuto del file, su una riga sola,
   va in `FIREBASE_SERVICE_ACCOUNT`.
8. Quando arrivano i primi clienti paganti passa al piano **Blaze** (a
   consumo) e metti un **avviso di budget**: si paga a fine mese, pochi euro.

## 2. Hosting

Il sito gira su **Vercel**: importa questo repo e metti le variabili di
`.env.example` in Settings → Environment Variables.

> Il piano gratuito di Vercel (Hobby) non permette l'uso commerciale. Per
> vendere serve il piano Pro, oppure spostare il sito su un hosting che lo
> consente. Da decidere prima del lancio.

In Authentication → Impostazioni → **Domini autorizzati** aggiungi il dominio
del sito (quello di Vercel e poi il tuo).

## 3. Chi gestisce Rosy

Metti il tuo indirizzo Google in `ADMIN_EMAILS` e `VITE_ADMIN_EMAILS`. Entrando
con quell'account trovi nel menù in basso a sinistra **Saloni iscritti**: chi
si è iscritto, a che punto è la prova, quante domande fa a Rosy. Da lì attivi
un piano a mano (bonifico, contanti) finché non c'è Stripe.

## 4. Come funziona per un salone

1. Apre il sito, entra con Google, compila i dati del salone.
2. Sceglie il suo **indirizzo corto** (`tuodominio/nome-salone`).
3. Parte la **prova gratuita di 14 giorni** con tutto acceso, senza carta.
4. Alla fine della prova il gestionale si ferma su "scegli un piano": ti
   scrive (WhatsApp o email di `VITE_CONTATTO_…`) e tu attivi il piano.
5. I dati restano sempre: a prova finita può scaricarli.

Piani e prezzi stanno in `salone-app/frontend/lib/piani.ts`; i giorni di
prova anche in `firestore.rules` (funzione `inProva`): se li cambi, cambiali
in tutti e due i posti.

## 5. Gli SMS: li paga il salone

Rosy non anticipa gli SMS di nessuno. Ogni salone, dalla pagina
**Automazioni → Conto SMS del salone**, collega il suo conto Skebby (utente e
password) e compra lì i suoi crediti: conferme, promemoria e codici di
verifica partono da quel conto, col suo nome come mittente.

Perché funzioni serve una variabile sul server: `SEGRETO_CONTI_SMS`, una
frase lunga a tua scelta (almeno 16 caratteri). Con quella il server cifra le
password dei conti prima di salvarle. **Non cambiarla dopo**: le password già
salvate non si aprirebbero più e i saloni dovrebbero ricollegare il conto.

Senza conto collegato gli SMS non partono e il salone usa WhatsApp a mano.

## 6. Che cosa manca ancora (in ordine)

- **Pagamenti con carta (Stripe)** e fattura elettronica: servono partita IVA
  e account. Il punto dove agganciarli è `api/admin.ts` (oggi l'unico che
  scrive `abbonamenti/{salone}`).
- **Termini di servizio e privacy del prodotto**, pagina di presentazione.

## Provare senza Firebase

`npm run anteprima` apre il gestionale con dati finti su http://localhost:5199
- `/?piano=base` come lo vede un salone col piano Base
- `/?prova=5` a cinque giorni dall'iscrizione
- `/prova-finita` la schermata di prova terminata
- `/admin` il pannello dei saloni iscritti
