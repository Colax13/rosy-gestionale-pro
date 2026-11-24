'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, CheckCircle2, AlertTriangle, Loader2, X, Pencil, ExternalLink, Unplug } from 'lucide-react';
import { smsApi, StatoSms } from '@/lib/api-client';
import { sessioneCorrente } from '@/lib/sessione';

/**
 * Il collegamento del conto SMS del salone. Qui si vede com'è messo (collegato
 * o no, quanti SMS restano); per collegarlo o cambiarlo si apre il riquadro a
 * parte, con i passaggi scritti. Lo fa solo la titolare.
 */
export default function ContoSms({ onCambiato }: { onCambiato?: (attivi: boolean) => void }) {
  const [stato, setStato] = useState<StatoSms | null>(null);
  const [errore, setErrore] = useState('');
  const [aperto, setAperto] = useState(false);
  const titolare = sessioneCorrente()?.titolare !== false;

  const carica = () => {
    setErrore('');
    smsApi.stato().then(s => { setStato(s); onCambiato?.(s.attivi); }).catch((e: any) => setErrore(e?.message || 'Stato degli SMS non disponibile.'));
  };
  useEffect(carica, []);

  return (
    <section className="mb-8 bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-fuchsia-600/10 text-fuchsia-600 flex items-center justify-center shrink-0"><MessageSquare size={20} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-zinc-900">Conto SMS del salone</h2>
          {errore ? (
            <p className="text-sm text-red-600 mt-0.5">{errore}</p>
          ) : !stato ? (
            <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Controllo…</p>
          ) : stato.collegato && stato.problema ? (
            <p className="text-sm text-amber-700 mt-0.5 flex items-start gap-1.5"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> Il conto {stato.utente} non risponde più: {stato.problema} Ricollegalo.</p>
          ) : stato.collegato ? (
            <p className="text-sm text-zinc-600 mt-0.5 flex flex-wrap items-center gap-x-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" /> Collegato ({stato.utente})
              {stato.mittente ? <> · mittente <strong className="text-zinc-900">{stato.mittente}</strong></> : null}
              {stato.crediti !== null ? <> · restano <strong className={stato.crediti < 50 ? 'text-amber-600' : 'text-zinc-900'}>{stato.crediti} SMS</strong></> : null}
            </p>
          ) : stato.attivi ? (
            <p className="text-sm text-zinc-600 mt-0.5 flex items-center gap-1.5"><CheckCircle2 size={15} className="text-emerald-600" /> Gli SMS sono attivi per questo salone.</p>
          ) : (
            <p className="text-sm text-zinc-600 mt-0.5">
              Non collegato: conferme e promemoria via SMS non partono. Collega il tuo conto Skebby: i messaggi li paghi tu, a consumo, senza passare da Rosy.
            </p>
          )}
          {stato && !stato.attivi && stato.collegato && !stato.problema && <p className="text-xs text-amber-700 mt-1">{stato.motivo}</p>}
        </div>
        {titolare && stato && (
          <button onClick={() => setAperto(true)} className="self-start md:self-center px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-700 text-white flex items-center gap-2 shrink-0">
            <Pencil size={14} /> {stato.collegato ? 'Modifica' : 'Collega il conto SMS'}
          </button>
        )}
      </div>

      {aperto && stato && <CollegaSms stato={stato} onChiudi={() => setAperto(false)} onFatto={() => { setAperto(false); carica(); }} />}
    </section>
  );
}

function CollegaSms({ stato, onChiudi, onFatto }: { stato: StatoSms; onChiudi: () => void; onFatto: () => void }) {
  const [utente, setUtente] = useState('');
  const [password, setPassword] = useState('');
  const [mittente, setMittente] = useState(stato.mittente || '');
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');

  const collega = async () => {
    if (!utente.trim() || !password) { setErrore('Scrivi utente e password del conto Skebby.'); return; }
    setLavoro(true); setErrore('');
    try { await smsApi.collega(utente.trim(), password, mittente.trim()); onFatto(); }
    catch (e: any) { setErrore(e?.message || 'Collegamento non riuscito.'); setLavoro(false); }
  };

  const scollega = async () => {
    if (!confirm('Scollego il conto SMS? Conferme e promemoria via SMS smettono di partire.')) return;
    setLavoro(true); setErrore('');
    try { await smsApi.scollega(); onFatto(); }
    catch (e: any) { setErrore(e?.message || 'Non riuscito.'); setLavoro(false); }
  };

  const campo = 'w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 outline-none focus:border-fuchsia-500';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-zinc-900/30" onClick={() => !lavoro && onChiudi()} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">Conto SMS del salone</h2>
          <button onClick={onChiudi} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500" aria-label="Chiudi"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <ol className="text-sm text-zinc-700 space-y-2.5 list-decimal pl-5">
            <li>Apri un conto su <a href="https://www.skebby.it" target="_blank" rel="noreferrer" className="text-fuchsia-700 font-medium inline-flex items-center gap-1">skebby.it <ExternalLink size={12} /></a> a nome del salone.</li>
            <li>Compra un pacchetto di SMS <strong>Classic+</strong> (quelli con il nome del salone come mittente). Si pagano solo quelli che compri: un SMS costa pochi centesimi.</li>
            <li>Scrivi qui sotto l'utente e la password di quel conto. Rosy li custodisce cifrati e li usa solo per mandare i tuoi messaggi.</li>
          </ol>

          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">Utente Skebby (l'email o il nome con cui entri)</span>
              <input value={utente} onChange={e => setUtente(e.target.value)} autoComplete="off" placeholder={stato.collegato ? stato.utente : ''} className={campo} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">Password Skebby</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className={campo} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-600">Mittente (facoltativo, massimo 11 lettere o numeri)</span>
              <input value={mittente} onChange={e => setMittente(e.target.value.slice(0, 11))} placeholder="Es. SALONEANNA" className={campo} />
              <span className="text-xs text-zinc-500">È il nome che la cliente legge al posto del numero. Va prima registrato su Skebby (lo chiede la legge): finché non è approvato lascialo vuoto.</span>
            </label>
          </div>

          {errore && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{errore}</p>}

          {stato.collegato && (
            <div className="pt-4 border-t border-zinc-100">
              <button onClick={scollega} disabled={lavoro} className="px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 flex items-center gap-1.5">
                <Unplug size={13} /> Scollega il conto
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-zinc-200 flex justify-end gap-2">
          <button onClick={onChiudi} disabled={lavoro} className="px-4 py-2.5 text-sm font-medium rounded-xl border border-zinc-200 text-zinc-700">Annulla</button>
          <button onClick={collega} disabled={lavoro} className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center gap-2">
            {lavoro && <Loader2 size={15} className="animate-spin" />} {lavoro ? 'Controllo il conto…' : 'Collega'}
          </button>
        </div>
      </div>
    </div>
  );
}
