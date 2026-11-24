import { motion } from "motion/react";
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users, Scissors, Clock, ChevronRight, Calendar as CalendarIcon, AlertTriangle, Lightbulb, Info, Cake, X
} from "lucide-react";
import { auth } from "../../../../../src/lib/firebase";
import { appuntamentiApi, clientiApi, dipendentiApi, catalogoApi, prodottiApi } from "@/lib/api-client";
import { daQuanto, giorniDa } from "@/lib/tempo";
import { intervalliOccupati, turnoDelGiorno, dentroTurno } from "@/lib/servizi";
import { clientiDaRecuperare, compleanniInArrivo, puntoDelGiorno, VocePunto } from "@/lib/punto";
import { puoAprirePercorso, sessioneCorrente } from "@/lib/sessione";
import BottoneRicontatta from "@/components/BottoneRicontatta";
import InviaRecupero from "@/components/InviaRecupero";
import RosyChat from "../../../../../src/components/RosyChat";
import RosyLogo from "../../../../../src/components/RosyLogo";

// Da quanto tempo una cliente deve mancare per considerarla da recuperare.
const GIORNI_ASSENZA = 60;

const STILE_TONO = {
  urgente: { icona: AlertTriangle, colore: 'text-red-600', sfondo: 'bg-red-50 border-red-200' },
  idea: { icona: Lightbulb, colore: 'text-fuchsia-600', sfondo: 'bg-fuchsia-50 border-fuchsia-200' },
  info: { icona: Info, colore: 'text-sky-600', sfondo: 'bg-sky-50 border-sky-200' }
} as const;

/**
 * La pagina di Rosy: quello che serve sapere oggi, e Rosy a cui chiedere.
 *
 * - "Il punto di oggi" sono conti fatti sui dati veri del salone (agenda,
 *   richieste dal sito, compleanni, clienti da recuperare, magazzino): c'è
 *   sempre, anche senza IA, e ogni voce ha il pulsante per fare qualcosa.
 * - La chat è Rosy vera, dentro la pagina: legge agenda, clienti, incassi e
 *   magazzino, e prepara gli appuntamenti da confermare.
 */
export default function RosyHub() {
  const navigate = useNavigate();
  const [appuntamenti, setAppuntamenti] = useState<any[]>([]);
  const [tuttiAppuntamenti, setTuttiAppuntamenti] = useState<any[]>([]);
  const [clienti, setClienti] = useState<any[]>([]);
  const [dipendenti, setDipendenti] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [prodotti, setProdotti] = useState<any[] | null>(null);
  const [pronto, setPronto] = useState(false);
  const [elenco, setElenco] = useState<'recupero' | 'compleanni' | null>(null);
  const [inviaAperto, setInviaAperto] = useState(false);
  const [chiedi, setChiedi] = useState({ testo: '', n: 0 });

  useEffect(() => {
    const oggi = new Date();
    const giorno = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // Per sapere chi non torna da un po' bastano gli ultimi 18 mesi e quelli
    // in calendario. Chi manca da più di 18 mesi resta tra le "da recuperare"
    // lo stesso (conta la data della scheda), solo senza l'ultima visita.
    const da = new Date(); da.setMonth(da.getMonth() - 18);
    const a = new Date(); a.setFullYear(a.getFullYear() + 1);
    Promise.all([
      appuntamentiApi.getAgenda(giorno(oggi)).then(setAppuntamenti).catch(console.error),
      appuntamentiApi.getAgenda(undefined, giorno(da), giorno(a)).then(setTuttiAppuntamenti).catch(console.error),
      dipendentiApi.getAll().then(setDipendenti).catch(console.error),
      catalogoApi.getAll().then(setCatalogo).catch(() => {}),
      // Il magazzino solo se questa persona (e il piano) ce l'ha.
      puoAprirePercorso('/prodotti') ? prodottiApi.getAll().then(setProdotti).catch(() => {}) : Promise.resolve()
    ]).finally(() => setPronto(true));
    return clientiApi.ascolta(setClienti);
  }, []);

  const adesso = new Date();
  const dormienti = useMemo(() => clientiDaRecuperare(clienti, tuttiAppuntamenti, new Date(), GIORNI_ASSENZA), [clienti, tuttiAppuntamenti]);
  const compleanni = useMemo(() => compleanniInArrivo(clienti, new Date(), 7), [clienti]);
  const richieste = tuttiAppuntamenti.filter(a => a.stato === 'in_attesa').length;

  const nuoviSettimana = clienti.filter(c => {
    const g = giorniDa(c.createdAt);
    return g !== null && g <= 7;
  }).length;

  // Le mezz'ore in turno che nessuno sta ancora occupando, da adesso in poi.
  const slotLiberi = dipendenti.reduce((totale, dip) => {
    const turno = turnoDelGiorno(dip, adesso);
    if (!turno.lavora) return totale;
    const occupati = appuntamenti
      .filter(a => (a.id_dipendente || a.idDipendente || a.dipendenti?.id) === dip.id && a.stato !== 'annullato')
      .flatMap(a => intervalliOccupati(new Date(a.data_ora).getTime(), a.righe_appuntamento || []));
    let liberi = 0;
    for (let minuti = 0; minuti < 24 * 60; minuti += 30) {
      if (!dentroTurno(turno, minuti)) continue;
      const inizio = new Date(adesso);
      inizio.setHours(0, minuti, 0, 0);
      const fine = inizio.getTime() + 30 * 60000;
      if (inizio.getTime() < adesso.getTime()) continue;
      if (occupati.some(o => o.inizio < fine && inizio.getTime() < o.fine)) continue;
      liberi++;
    }
    return totale + liberi;
  }, 0);

  const punto = useMemo(() => puntoDelGiorno({
    appuntamentiOggi: appuntamenti, richieste, daRecuperare: dormienti.length, compleanni,
    prodotti, catalogo, spaziLiberi: slotLiberi
  }), [appuntamenti, richieste, dormienti.length, compleanni, prodotti, catalogo, slotLiberi]);

  const domanda = (testo: string) => {
    setChiedi(c => ({ testo, n: c.n + 1 }));
    document.getElementById('chat-rosy')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const fai = (voce: VocePunto) => {
    const azione = voce.azione;
    if (!azione) return;
    if (azione.tipo === 'agenda') navigate('/agenda');
    else if (azione.tipo === 'prodotti') navigate('/prodotti');
    else if (azione.tipo === 'recupera') setInviaAperto(true);
    else if (azione.tipo === 'compleanni') setElenco('compleanni');
    else if (azione.tipo === 'chiedi' && azione.domanda) domanda(azione.domanda);
  };

  const nome = (sessioneCorrente()?.nome || auth.currentUser?.displayName || '').split(' ')[0];
  const saluto = adesso.getHours() < 13 ? 'Buongiorno' : adesso.getHours() < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const oggiVeri = appuntamenti.filter(a => a.stato !== 'annullato' && a.id_cliente !== 'block-client');

  return (
    <div className="flex-1 overflow-y-auto w-full relative scrollbar-none p-4 md:p-8 min-h-screen">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-[#00D8FF]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#D400FF]/5 blur-[100px]" />
      </div>

      <div className="max-w-[1200px] mx-auto w-full flex flex-col gap-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-zinc-200 shadow-sm flex items-center justify-center shrink-0"><RosyLogo size="lg" /></div>
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-playfair font-black text-zinc-900 tracking-tight">{saluto}{nome ? `, ${nome}` : ''}</h1>
            <p className="text-zinc-500 font-sans mt-1 first-letter:uppercase">
              {adesso.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} · ecco il punto del salone.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Il punto di oggi */}
          <section className="lg:col-span-2 bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 mb-1">Il punto di oggi</h2>
            <p className="text-xs text-zinc-500 mb-4">Dai dati del tuo salone, aggiornato adesso.</p>
            {!pronto ? (
              <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-zinc-100 animate-pulse" />)}</div>
            ) : (
              <div className="flex flex-col gap-3">
                {punto.map(voce => {
                  const stile = STILE_TONO[voce.tono];
                  const Icona = stile.icona;
                  return (
                    <div key={voce.chiave} className={`rounded-2xl border p-3.5 ${stile.sfondo}`}>
                      <div className="flex items-start gap-2.5">
                        <Icona size={17} className={`${stile.colore} shrink-0 mt-0.5`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 leading-snug">{voce.testo}</p>
                          {voce.dettaglio && <p className="text-xs text-zinc-600 mt-0.5 leading-snug">{voce.dettaglio}</p>}
                          {voce.azione && (
                            <button onClick={() => fai(voce)} className="mt-2 text-xs font-semibold text-zinc-900 bg-white border border-zinc-300 hover:border-zinc-400 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1">
                              {voce.azione.etichetta} <ChevronRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {dormienti.length > 0 && (
                  <button onClick={() => setElenco('recupero')} className="text-xs text-zinc-500 hover:text-zinc-900 self-start underline underline-offset-2">
                    Vedi chi sono le {dormienti.length} da recuperare
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Rosy, la chat vera */}
          <section id="chat-rosy" className="lg:col-span-3 bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[560px] max-h-[75vh]">
            <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center gap-3 shrink-0">
              <RosyLogo size="sm" />
              <div className="min-w-0">
                <h2 className="text-base font-bold text-zinc-900 leading-tight">Chiedi a Rosy</h2>
                <p className="text-xs text-zinc-500 truncate">Agenda, clienti, incassi, magazzino. Ti prepara anche gli appuntamenti.</p>
              </div>
            </div>
            <div className="flex-1 min-h-0"><RosyChat inPagina chiedi={chiedi} /></div>
          </section>
        </div>

        {/* I numeri di oggi */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icona: CalendarIcon, colore: 'text-[#D400FF]', titolo: 'Appuntamenti', valore: oggiVeri.length, sotto: 'Oggi', link: '/agenda' },
            { icona: Scissors, colore: 'text-[#00D8FF]', titolo: 'Servizi', valore: oggiVeri.reduce((t, a) => t + (a.righe_appuntamento?.length || 0), 0), sotto: 'Da eseguire oggi', link: '/agenda' },
            { icona: Users, colore: 'text-emerald-500', titolo: 'Nuovi clienti', valore: nuoviSettimana, sotto: 'Questa settimana', link: '/clienti' },
            { icona: Clock, colore: 'text-amber-500', titolo: 'Spazi liberi', valore: slotLiberi, sotto: "Mezz'ore libere da adesso", link: '/agenda' }
          ].map(k => (
            <Link key={k.titolo} to={k.link} className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm hover:border-zinc-300 transition-colors">
              <div className="flex items-center gap-2.5 mb-3">
                <k.icona size={17} className={k.colore} />
                <h4 className="text-xs font-semibold text-zinc-600 tracking-wide uppercase">{k.titolo}</h4>
              </div>
              <div className="text-3xl font-playfair font-black text-zinc-900 tracking-tight">{pronto ? k.valore : '–'}</div>
              <div className="text-xs text-zinc-500 font-medium mt-0.5">{k.sotto}</div>
            </Link>
          ))}
        </div>

        <div className="h-6" />
      </div>

      {/* Gli elenchi si aprono in un pannello a parte */}
      {elenco && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-zinc-900/30" onClick={() => setElenco(null)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">{elenco === 'recupero' ? 'Clienti da recuperare' : 'Compleanni'}</h2>
                <p className="text-xs text-zinc-500">
                  {elenco === 'recupero' ? `Non passano da più di ${GIORNI_ASSENZA} giorni e non hanno appuntamenti.` : 'Oggi e nei prossimi 7 giorni.'}
                </p>
              </div>
              <button onClick={() => setElenco(null)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500" aria-label="Chiudi"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
              {elenco === 'recupero' && dormienti.map(({ cliente, ultimaVisita }) => (
                <div key={cliente.id} className="flex items-center gap-3 px-5 py-3">
                  <Link to={`/clienti/${cliente.id}`} className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-900 truncate">{cliente.nome} {cliente.cognome}</div>
                    <div className="text-xs text-zinc-500 truncate">{ultimaVisita ? `Ultima visita ${daQuanto(ultimaVisita)}` : 'Non è mai passata'}{cliente.telefono ? ` · ${cliente.telefono}` : ''}</div>
                  </Link>
                  <BottoneRicontatta telefono={cliente.telefono} aspetto="discreto" etichetta="Ricontatta"
                    messaggio={`Buongiorno ${cliente.nome || ''}, è passato un po' di tempo dall'ultima volta: le va di fissare un appuntamento?`.replace(/\s+/g, ' ')} />
                </div>
              ))}
              {elenco === 'compleanni' && compleanni.map(({ cliente, fra, anni }) => (
                <div key={cliente.id} className="flex items-center gap-3 px-5 py-3">
                  <Cake size={17} className={fra === 0 ? 'text-fuchsia-600 shrink-0' : 'text-zinc-400 shrink-0'} />
                  <Link to={`/clienti/${cliente.id}`} className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-900 truncate">{cliente.nome} {cliente.cognome}</div>
                    <div className="text-xs text-zinc-500 truncate">{fra === 0 ? 'Oggi' : fra === 1 ? 'Domani' : `Fra ${fra} giorni`}{anni ? ` · ${anni} anni` : ''}</div>
                  </Link>
                  <BottoneRicontatta telefono={cliente.telefono} aspetto="discreto" etichetta="Auguri"
                    messaggio={`Tanti auguri ${cliente.nome || ''}! 🎉 Un abbraccio da tutto il salone.`.replace(/\s+/g, ' ')} />
                </div>
              ))}
            </div>
            {elenco === 'recupero' && dormienti.length > 0 && (
              <div className="px-5 py-4 border-t border-zinc-200">
                <button onClick={() => { setElenco(null); setInviaAperto(true); }} className="w-full px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-semibold rounded-xl">Manda un messaggio a tutte</button>
              </div>
            )}
          </div>
        </div>
      )}

      {inviaAperto && (
        <InviaRecupero
          righe={dormienti.map(d => ({ cliente: d.cliente, ultimaVisita: d.ultimaVisita }))}
          onClose={() => setInviaAperto(false)}
        />
      )}
    </div>
  );
}
