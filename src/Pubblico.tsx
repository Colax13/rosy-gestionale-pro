// Le pagine che vede la cliente: la prenotazione e l'informativa privacy.
//
// Stanno in un pezzo a sé, separato dal gestionale: chi apre il link di
// prenotazione scarica solo questo, non agenda, report e tutto il resto.

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import PrenotazionePubblica from '@/app/(public)/[salonId]/prenota/page';
import InformativaPrivacy from '@/app/(public)/[salonId]/privacy/page';
import { saloneDelDominio } from '@/lib/domini';
import { indirizzoApi } from '@/lib/api-client';

/**
 * La prenotazione dall'indirizzo corto del salone: rosy.it/rdsalon. Si guarda
 * di quale salone è quell'indirizzo e si apre la sua pagina; se non è di
 * nessuno lo si dice, invece di lasciare una pagina vuota.
 */
function DaIndirizzo() {
  const { indirizzo = '' } = useParams();
  const [salonId, setSalonId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    indirizzoApi.saloneDi(indirizzo)
      .then(id => { if (vivo) setSalonId(id); })
      .catch(() => { if (vivo) setSalonId(null); });
    return () => { vivo = false; };
  }, [indirizzo]);

  if (salonId === undefined) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-50">
        <div className="w-8 h-8 rounded-full border-2 border-fuchsia-200 border-t-fuchsia-600 animate-spin" aria-label="Caricamento" />
      </div>
    );
  }
  if (!salonId) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-50 p-6 text-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Salone non trovato</h1>
          <p className="text-sm text-zinc-500 mt-2">Nessun salone ha l'indirizzo «{indirizzo}». Controlla il link, o chiedilo al tuo salone.</p>
        </div>
      </div>
    );
  }
  return <PrenotazionePubblica salonIdFisso={salonId} privacy={`/${salonId}/privacy`} />;
}

export default function Pubblico() {
  // Un indirizzo tutto del salone (un dominio suo): si apre subito la sua
  // prenotazione, e su "/privacy" la sua informativa. Il gestionale da lì
  // non si raggiunge.
  const saloneDominio = saloneDelDominio(window.location.hostname);
  if (saloneDominio) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PrenotazionePubblica salonIdFisso={saloneDominio} />} />
          <Route path="/privacy" element={<InformativaPrivacy salonIdFisso={saloneDominio} />} />
          <Route path="/:salonId/prenota" element={<PrenotazionePubblica />} />
          <Route path="/:salonId/privacy" element={<InformativaPrivacy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:salonId/prenota" element={<PrenotazionePubblica />} />
        <Route path="/:salonId/privacy" element={<InformativaPrivacy />} />
        <Route path="/:indirizzo" element={<DaIndirizzo />} />
      </Routes>
    </BrowserRouter>
  );
}
