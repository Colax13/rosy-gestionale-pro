import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, X, Pencil, RefreshCw } from 'lucide-react';
import { adminApi, SaloneIscritto } from '@/lib/api-client';
import { PIANI, Piano } from '@/lib/piani';

const giorno = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function stato(s: SaloneIscritto): { testo: string; classe: string } {
  if (s.piano) return { testo: `Piano ${PIANI[s.piano as Piano]?.nome || s.piano}${s.scadenza ? ` · fino al ${giorno(s.scadenza)}` : ''}`, classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (s.in_prova) return { testo: `In prova · ${s.giorni_prova} ${s.giorni_prova === 1 ? 'giorno' : 'giorni'}`, classe: 'bg-sky-50 text-sky-700 border-sky-200' };
  return { testo: 'Prova finita', classe: 'bg-red-50 text-red-700 border-red-200' };
}

/**
 * Il pannello di chi gestisce Rosy: i saloni iscritti, a che punto sono
 * (prova, piano, scaduti) e quanto usano l'IA. L'elenco si guarda; il piano
 * si cambia dal riquadro a parte.
 */
export default function PannelloAdmin() {
  const [saloni, setSaloni] = useState<SaloneIscritto[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [aperto, setAperto] = useState<SaloneIscritto | null>(null);

  const carica = () => {
    setErrore(null);
    adminApi.saloni().then(setSaloni).catch((e: any) => { setErrore(e?.message || 'Elenco non disponibile.'); setSaloni([]); });
  };
  useEffect(carica, []);

  const conti = useMemo(() => {
    const l = saloni || [];
    const paganti = l.filter(s => s.piano);
    return {
      iscritti: l.length,
      inProva: l.filter(s => s.in_prova).length,
      paganti: paganti.length,
      scaduti: l.filter(s => s.scaduto).length,
      alMese: paganti.reduce((t, s) => t + (PIANI[s.piano as Piano]?.prezzo_mese || 0), 0)
    };
  }, [saloni]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-bold text-zinc-900 flex items-center gap-3"><ShieldCheck className="text-fuchsia-500" size={28} /> Saloni iscritti</h1>
          <p className="text-zinc-500 mt-1 text-sm">Chi usa Rosy, a che punto è la prova e quale piano ha.</p>
        </div>
        <button onClick={carica} className="px-3 py-2 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 self-start"><RefreshCw size={15} /> Aggiorna</button>
      </header>

      {errore && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> {errore}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          ['Iscritti', String(conti.iscritti)],
          ['In prova', String(conti.inProva)],
          ['Con un piano', String(conti.paganti)],
          ['Prova finita', String(conti.scaduti)],
          ['Incasso al mese', `${conti.alMese.toLocaleString('it-IT', { maximumFractionDigits: 2 })} €`]
        ].map(([etichetta, valore]) => (
          <div key={etichetta} className="bg-white border border-zinc-200 rounded-xl p-4">
            <p className="text-xs text-zinc-500">{etichetta}</p>
            <p className="text-2xl font-bold mt-1 text-zinc-900">{valore}</p>
          </div>
        ))}
      </div>

      {saloni === null ? (
        <p className="text-sm text-zinc-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carico i saloni…</p>
      ) : saloni.length === 0 && !errore ? (
        <p className="text-sm text-zinc-500">Ancora nessun salone iscritto.</p>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
          {saloni.map(s => {
            const st = stato(s);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{s.nome || 'Salone senza nome'}</p>
                  <p className="text-xs text-zinc-500 truncate">{[s.email, s.telefono, s.indirizzo ? `/${s.indirizzo}` : ''].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="text-xs text-zinc-500 w-40">Iscritto il {giorno(s.iscritto_il)}<br />{s.domande_ia_mese} domande a Rosy nel mese</div>
                <span className={`text-[11px] px-2 py-1 rounded-full border ${st.classe}`}>{st.testo}</span>
                <button onClick={() => setAperto(s)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5"><Pencil size={13} /> Piano</button>
              </div>
            );
          })}
        </div>
      )}

      {aperto && <CambiaPiano salone={aperto} onChiudi={() => setAperto(null)} onFatto={() => { setAperto(null); carica(); }} />}
    </div>
  );
}

function CambiaPiano({ salone, onChiudi, onFatto }: { salone: SaloneIscritto; onChiudi: () => void; onFatto: () => void }) {
  const [piano, setPiano] = useState<Piano>((salone.piano as Piano) || 'fondatori');
  const [mesi, setMesi] = useState('12');
  const [nota, setNota] = useState(salone.nota || '');
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');

  const esegui = async (azione: () => Promise<void>) => {
    setLavoro(true); setErrore('');
    try { await azione(); onFatto(); }
    catch (e: any) { setErrore(e?.message || 'Non riuscito.'); setLavoro(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-zinc-900/30" onClick={() => !lavoro && onChiudi()} />
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-900 truncate">{salone.nome || 'Salone'}</h2>
            <p className="text-xs text-zinc-500 truncate">{salone.email}</p>
          </div>
          <button onClick={onChiudi} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500" aria-label="Chiudi"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <p className="text-xs font-medium text-zinc-600 mb-2">Piano</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PIANI) as Piano[]).map(p => (
                <button key={p} onClick={() => setPiano(p)} className={`px-3 py-2 rounded-lg border text-sm font-medium ${piano === p ? 'bg-fuchsia-600 border-fuchsia-600 text-white' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>{PIANI[p].nome}</button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-2">{PIANI[piano].descrizione}</p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Per quanti mesi (0 = senza scadenza)</span>
            <input value={mesi} onChange={e => setMesi(e.target.value)} inputMode="numeric" className="w-28 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-fuchsia-500" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Nota (es. "pagato con bonifico il 12/1")</span>
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-fuchsia-500" />
          </label>
          {errore && <p className="text-sm text-red-600">{errore}</p>}
          {salone.piano && (
            <button onClick={() => confirm('Tolgo il piano a questo salone? Torna alla prova (se non è finita) o si ferma.') && esegui(() => adminApi.togli(salone.id))} disabled={lavoro} className="px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50">Togli il piano</button>
          )}
        </div>
        <div className="px-5 py-4 border-t border-zinc-200 flex justify-end gap-2">
          <button onClick={onChiudi} disabled={lavoro} className="px-4 py-2.5 text-sm font-medium rounded-xl border border-zinc-200 text-zinc-700">Annulla</button>
          <button onClick={() => esegui(() => adminApi.attiva(salone.id, piano, Math.max(0, Math.trunc(Number(mesi) || 0)), nota))} disabled={lavoro} className="px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center gap-2">
            {lavoro && <Loader2 size={15} className="animate-spin" />} Attiva il piano
          </button>
        </div>
      </div>
    </div>
  );
}
