import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { Download, Loader2, LogOut, Check, Sparkles } from 'lucide-react';
import { auth } from '../lib/firebase';
import { variabiliMancanti } from '../lib/firebase-config';
import { backupApi } from '@/lib/api-client';
import { PIANI, Piano, Accesso, GIORNI_PROVA } from '@/lib/piani';
import RosyLogo from './RosyLogo';

/**
 * Come si chiede un piano finché i pagamenti con carta non ci sono: un
 * messaggio a chi gestisce Rosy. L'indirizzo sta nelle variabili d'ambiente
 * (VITE_CONTATTO_EMAIL, VITE_CONTATTO_WHATSAPP), così non è scritto nel codice.
 */
const env = (import.meta as any).env || {};
export function linkContatto(piano?: Piano): { href: string; etichetta: string } | null {
  const testo = `Ciao, vorrei attivare il piano ${piano ? PIANI[piano].nome : ''} di Rosy per il mio salone (${auth.currentUser?.email || ''}).`;
  const whatsapp = (env.VITE_CONTATTO_WHATSAPP || '').replace(/\D/g, '');
  if (whatsapp) return { href: `https://wa.me/${whatsapp}?text=${encodeURIComponent(testo)}`, etichetta: 'Scrivici su WhatsApp' };
  const email = env.VITE_CONTATTO_EMAIL || '';
  if (email) return { href: `mailto:${email}?subject=${encodeURIComponent('Attivazione piano Rosy')}&body=${encodeURIComponent(testo)}`, etichetta: 'Scrivici per attivarlo' };
  return null;
}

const euro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** I piani, in sola lettura, con il pulsante per chiederne uno. */
export function ElencoPiani({ attuale }: { attuale?: Piano | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(Object.keys(PIANI) as Piano[]).map(chiave => {
        const p = PIANI[chiave];
        const contatto = linkContatto(chiave);
        const suo = attuale === chiave;
        return (
          <div key={chiave} className={`rounded-xl border p-4 flex flex-col gap-2 bg-white ${suo ? 'border-fuchsia-500' : 'border-zinc-200'}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-zinc-900">{p.nome}</h3>
              {suo && <span className="text-[10px] font-bold text-white bg-fuchsia-600 rounded px-1.5 py-0.5">ATTUALE</span>}
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {chiave === 'fondatori' ? <>149 €<span className="text-sm font-normal text-zinc-500">/anno</span></> : <>{euro(p.prezzo_mese)} €<span className="text-sm font-normal text-zinc-500">/mese</span></>}
            </p>
            <p className="text-xs text-zinc-600 leading-relaxed flex-1">{p.descrizione}</p>
            {!suo && contatto && (
              <a href={contatto.href} target="_blank" rel="noreferrer" className="mt-1 text-center px-3 py-2 text-sm font-semibold rounded-lg bg-zinc-900 text-white hover:bg-zinc-700">
                Scegli {p.nome}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Prova finita (o piano scaduto) senza un piano valido: il gestionale si
 * ferma qui. I dati restano: si possono scaricare, e tornano tutti appena si
 * attiva un piano.
 */
export function ProvaFinita({ accesso, titolare }: { accesso: Accesso; titolare: boolean }) {
  const [scarico, setScarico] = useState(false);
  const [esito, setEsito] = useState('');
  const contatto = linkContatto();

  const scarica = async () => {
    setScarico(true);
    setEsito('');
    try {
      const { file, nome } = await backupApi.esporta();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setEsito('Backup scaricato.');
    } catch (e: any) {
      setEsito(`Backup non riuscito: ${e?.message || 'errore'}`);
    } finally {
      setScarico(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white border border-zinc-200 rounded-2xl shadow-xl p-6 md:p-10">
        <div className="flex items-center gap-3 mb-6"><RosyLogo size="md" /><span className="font-playfair font-bold text-xl text-zinc-900">Rosy</span></div>
        <h1 className="text-2xl md:text-3xl font-playfair font-bold text-zinc-900">
          {accesso.scadenza && accesso.piano === null ? `La prova gratuita di ${GIORNI_PROVA} giorni è finita` : 'Il piano è scaduto'}
        </h1>
        {titolare ? (
          <>
            <p className="text-zinc-600 mt-3 mb-6">
              I tuoi dati sono al sicuro e non si perde niente: agenda, clienti e tutto il resto tornano disponibili appena attivi un piano.
            </p>
            <ElencoPiani />
            {!contatto && <p className="text-sm text-zinc-500 mt-4">Per attivare un piano contatta chi ti ha fatto conoscere Rosy.</p>}
            <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-wrap items-center gap-3">
              <button onClick={scarica} disabled={scarico} className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50 flex items-center gap-2 disabled:opacity-60">
                {scarico ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Scarica i miei dati
              </button>
              <button onClick={() => signOut(auth)} className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 hover:bg-zinc-100 flex items-center gap-2">
                <LogOut size={15} /> Esci
              </button>
              {esito && <span className="text-sm text-zinc-500">{esito}</span>}
            </div>
          </>
        ) : (
          <>
            <p className="text-zinc-600 mt-3 mb-6">Il gestionale del salone è in pausa: chiedi alla titolare di riattivarlo.</p>
            <button onClick={() => signOut(auth)} className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50 flex items-center gap-2">
              <LogOut size={15} /> Esci
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Il riquadro "Il tuo piano" del menù: dove si è e che cosa si può scegliere. */
export function IlTuoPiano({ accesso }: { accesso: Accesso }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 p-4">
        {accesso.piano ? (
          <p className="text-sm text-zinc-800 flex items-center gap-2"><Check size={16} className="text-fuchsia-600" /> Hai il piano <strong>{PIANI[accesso.piano].nome}</strong>{accesso.scadenza ? `, valido fino al ${accesso.scadenza.toLocaleDateString('it-IT')}` : ''}.</p>
        ) : (
          <p className="text-sm text-zinc-800 flex items-center gap-2"><Sparkles size={16} className="text-fuchsia-600" /> Sei in prova gratuita: {accesso.giorniProva === 1 ? 'resta 1 giorno' : `restano ${accesso.giorniProva} giorni`}, con tutto acceso.</p>
        )}
      </div>
      <ElencoPiani attuale={accesso.piano} />
      {!linkContatto() && <p className="text-xs text-zinc-500">Per attivare un piano contatta chi ti ha fatto conoscere Rosy.</p>}
    </div>
  );
}

/** Mancano le chiavi di Firebase: il gestionale non può partire. */
export function ConfigurazioneMancante() {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-xl p-8">
        <h1 className="text-xl font-bold text-zinc-900">Rosy non è ancora collegata al suo database</h1>
        <p className="text-sm text-zinc-600 mt-3">Mancano queste variabili d'ambiente (su Vercel, o nel file <code>.env.local</code>):</p>
        <ul className="mt-3 text-sm font-mono text-zinc-800 space-y-1">
          {variabiliMancanti.map(v => <li key={v}>{v}</li>)}
        </ul>
        <p className="text-sm text-zinc-600 mt-4">I passaggi sono in <code>docs/AVVIO-PRO.md</code>. La demo con i dati finti funziona lo stesso: <code>npm run anteprima</code>.</p>
      </div>
    </div>
  );
}
