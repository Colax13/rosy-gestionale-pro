'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link as LinkIcon, Copy, Check, Pencil, X, Loader2, Printer, Download, ExternalLink } from 'lucide-react';
import { indirizzoApi } from '@/lib/api-client';
import { idSalone, sessioneCorrente, ricordaIndirizzo } from '@/lib/sessione';
import { linkCorto, linkDaLeggere, erroreIndirizzo, indirizzoDaNome } from '@/lib/indirizzo';
import { paginaCartello } from '@/lib/cartello';

/**
 * Il link di prenotazione del salone, il suo QR e il cartello da stampare.
 * Qui si guarda e si copia; per cambiare l'indirizzo si apre il riquadro a
 * parte ("Cambia indirizzo"), solo la titolare.
 */
export default function LinkPrenotazione({ nomeSalone }: { nomeSalone: string }) {
  const sessione = sessioneCorrente();
  const salonId = idSalone() || '';
  const [indirizzo, setIndirizzo] = useState<string | null>(sessione?.indirizzo || null);
  const [qr, setQr] = useState('');
  const [copiato, setCopiato] = useState(false);
  const [modifica, setModifica] = useState(false);

  // La sessione lo sa già; si rilegge per chi l'ha cambiato da un'altra postazione.
  useEffect(() => {
    indirizzoApi.attuale().then(i => { setIndirizzo(i); ricordaIndirizzo(i); }).catch(() => {});
  }, []);

  const link = linkCorto(window.location.origin, indirizzo, salonId);

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#18181b', light: '#ffffff' } })
      .then(setQr).catch(() => setQr(''));
  }, [link]);

  const copia = async () => {
    try { await navigator.clipboard.writeText(link); setCopiato(true); setTimeout(() => setCopiato(false), 2000); }
    catch { window.prompt('Copia il link:', link); }
  };

  const scaricaQr = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `qr-prenotazioni-${indirizzo || 'salone'}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const stampaCartello = async () => {
    const qrSvg = await QRCode.toString(link, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#18181b', light: '#ffffff' } });
    const pagina = paginaCartello({ nomeSalone, linkDaLeggere: linkDaLeggere(link), qrSvg });
    const finestra = window.open('', '_blank');
    if (!finestra) { alert('Il browser ha bloccato la finestra del cartello: consenti le finestre a comparsa per questo sito e riprova.'); return; }
    finestra.document.open();
    finestra.document.write(pagina);
    finestra.document.close();
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-zinc-500 mb-2">Link di prenotazione per le clienti</label>
      <div className="bg-white p-4 rounded-xl border border-zinc-200 flex flex-col md:flex-row gap-5">
        <div className="shrink-0 self-center md:self-start w-36 h-36 rounded-xl border border-zinc-200 bg-white flex items-center justify-center overflow-hidden">
          {qr ? <img src={qr} alt="QR del link di prenotazione" className="w-full h-full" /> : <Loader2 size={18} className="animate-spin text-zinc-400" />}
        </div>

        <div className="min-w-0 flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-fuchsia-600/10 text-fuchsia-500 flex items-center justify-center shrink-0"><LinkIcon size={20} /></div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-zinc-900 break-all">{linkDaLeggere(link)}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {indirizzo
                  ? 'Mettilo nella bio di Instagram, su WhatsApp e su Google: chi lo apre prenota subito.'
                  : 'Scegli un indirizzo corto con il nome del salone: è più facile da leggere e da ricordare.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={copia} className="px-3 py-2 bg-zinc-900 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium flex items-center gap-2">
              {copiato ? <Check size={15} /> : <Copy size={15} />} {copiato ? 'Copiato' : 'Copia link'}
            </button>
            <button onClick={stampaCartello} className="px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-medium flex items-center gap-2">
              <Printer size={15} /> Cartello da stampare
            </button>
            <button onClick={scaricaQr} disabled={!qr} className="px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-800 rounded-lg text-sm font-medium border border-zinc-300 flex items-center gap-2 disabled:opacity-50">
              <Download size={15} /> Scarica il QR
            </button>
            <a href={link} target="_blank" rel="noreferrer" className="px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-800 rounded-lg text-sm font-medium border border-zinc-300 flex items-center gap-2">
              <ExternalLink size={15} /> Apri
            </a>
            {sessione?.titolare !== false && (
              <button onClick={() => setModifica(true)} className="px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-800 rounded-lg text-sm font-medium border border-zinc-300 flex items-center gap-2">
                <Pencil size={15} /> {indirizzo ? 'Cambia indirizzo' : 'Scegli l\'indirizzo'}
              </button>
            )}
          </div>
        </div>
      </div>

      {modifica && (
        <CambiaIndirizzo
          attuale={indirizzo}
          proposta={indirizzoDaNome(nomeSalone)}
          onChiudi={() => setModifica(false)}
          onSalvato={nuovo => { setIndirizzo(nuovo); ricordaIndirizzo(nuovo); setModifica(false); }}
        />
      )}
    </div>
  );
}

function CambiaIndirizzo({ attuale, proposta, onChiudi, onSalvato }: { attuale: string | null; proposta: string; onChiudi: () => void; onSalvato: (indirizzo: string) => void }) {
  const [valore, setValore] = useState(attuale || proposta);
  const [salvo, setSalvo] = useState(false);
  const [errore, setErrore] = useState('');
  const problema = valore ? erroreIndirizzo(valore) : 'Scrivi l\'indirizzo.';

  const salva = async () => {
    if (problema) return;
    setSalvo(true);
    setErrore('');
    try { await indirizzoApi.imposta(valore); onSalvato(valore); }
    catch (e: any) { setErrore(e?.message || 'Non sono riuscito a salvare.'); }
    finally { setSalvo(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-2xl">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900">Indirizzo del salone</h3>
          <button onClick={onChiudi} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500" aria-label="Chiudi"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center border border-zinc-300 rounded-lg overflow-hidden focus-within:border-fuchsia-500">
            <span className="pl-3 pr-1 text-zinc-400 text-sm whitespace-nowrap">{window.location.host}/</span>
            <input
              autoFocus
              value={valore}
              onChange={e => { setValore(e.target.value.toLowerCase().replace(/\s+/g, '-')); setErrore(''); }}
              onKeyDown={e => { if (e.key === 'Enter') salva(); }}
              className="flex-1 min-w-0 py-2.5 pr-3 outline-none text-sm text-zinc-900"
              aria-label="Indirizzo del salone"
            />
          </div>
          {(errore || (valore && problema)) && <p className="text-xs text-red-600">{errore || problema}</p>}
          {attuale && attuale !== valore && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              Cambiandolo, il vecchio link ({attuale}) e i QR già stampati smettono di funzionare.
            </p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-zinc-200 flex justify-end gap-2">
          <button onClick={onChiudi} disabled={salvo} className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-200 text-zinc-700">Annulla</button>
          <button onClick={salva} disabled={salvo || !!problema || valore === attuale} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
            {salvo && <Loader2 size={15} className="animate-spin" />} Salva
          </button>
        </div>
      </div>
    </div>
  );
}
