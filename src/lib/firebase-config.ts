/// <reference types="vite/client" />
// La configurazione di Firebase di QUESTO prodotto.
//
// Questo gestionale è nato copiando quello di un salone solo: il suo progetto
// Firebase (e quindi i dati delle sue clienti) non deve entrare qui nemmeno
// per sbaglio. Per questo la configurazione non sta più scritta in un file
// del programma: arriva dalle variabili d'ambiente (VITE_FIREBASE_…), che si
// mettono su Vercel e nel file `.env.local` di chi sviluppa. Vedi
// `docs/AVVIO-PRO.md`.
//
// Senza variabili il programma parte lo stesso con una configurazione finta,
// così l'anteprima con i dati finti funziona; il gestionale vero mostra
// invece una schermata che dice che cosa manca.

const v = (import.meta as any).env || {};

export const firebaseConfig = {
  apiKey: v.VITE_FIREBASE_API_KEY || 'non-configurato',
  authDomain: v.VITE_FIREBASE_AUTH_DOMAIN || 'non-configurato.firebaseapp.com',
  projectId: v.VITE_FIREBASE_PROJECT_ID || 'non-configurato',
  appId: v.VITE_FIREBASE_APP_ID || '',
  storageBucket: v.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: v.VITE_FIREBASE_MESSAGING_SENDER_ID || ''
};

/** Il database Firestore: quasi sempre quello predefinito. */
export const firestoreDatabaseId: string = v.VITE_FIREBASE_DATABASE_ID || '(default)';

/** True se le chiavi vere ci sono. */
export const firebaseConfigurato = !!(v.VITE_FIREBASE_API_KEY && v.VITE_FIREBASE_PROJECT_ID);

/** I nomi delle variabili che mancano, da mostrare a chi configura. */
export const variabiliMancanti: string[] = [
  ['VITE_FIREBASE_API_KEY', v.VITE_FIREBASE_API_KEY],
  ['VITE_FIREBASE_AUTH_DOMAIN', v.VITE_FIREBASE_AUTH_DOMAIN],
  ['VITE_FIREBASE_PROJECT_ID', v.VITE_FIREBASE_PROJECT_ID],
  ['VITE_FIREBASE_APP_ID', v.VITE_FIREBASE_APP_ID]
].filter(([, valore]) => !valore).map(([nome]) => nome as string);
