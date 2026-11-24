/**
 * Il cartello da stampare e mettere in salone (bancone, specchio, vetrina):
 * il nome del salone, "Prenota online", il QR da inquadrare e il link scritto
 * per chi preferisce digitarlo. Un foglio A4, nei colori di Rosy.
 *
 * È una pagina a sé (HTML completo): si apre in una finestra nuova e si
 * stampa, o si salva in PDF dalla finestra di stampa. Il QR arriva già
 * disegnato (SVG) da chi chiama, così qui non serve nessuna libreria.
 */

const pulisci = (t: string) => String(t || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface DatiCartello {
  nomeSalone: string;
  /** Il link come si legge: rosy.it/rdsalon */
  linkDaLeggere: string;
  /** Il QR come SVG (testo). */
  qrSvg: string;
}

export function paginaCartello(d: DatiCartello): string {
  const nome = pulisci(d.nomeSalone.trim() || 'Il nostro salone');
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Cartello prenotazioni · ${nome}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f4f4f5; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #18181b; }
  .foglio { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; display: flex; flex-direction: column; align-items: center; text-align: center; overflow: hidden; }
  .testa { width: 100%; padding: 22mm 16mm 30mm; color: #fff; background: linear-gradient(135deg, #D400FF 0%, #6B5CFF 60%, #00D8FF 130%); border-radius: 0 0 50% 50% / 0 0 18mm 18mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .salone { font-size: 15pt; letter-spacing: .28em; text-transform: uppercase; opacity: .92; margin: 0 0 7mm; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 46pt; line-height: 1.05; margin: 0; font-weight: 700; }
  .sotto { font-size: 15pt; margin: 6mm 0 0; opacity: .95; }
  .qr { margin-top: -18mm; width: 96mm; height: 96mm; padding: 7mm; background: #fff; border-radius: 9mm; box-shadow: 0 6mm 16mm rgba(24,24,27,.16); border: .4mm solid #e4e4e7; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .passi { display: flex; gap: 8mm; margin: 14mm 14mm 0; }
  .passo { flex: 1; font-size: 12pt; color: #3f3f46; }
  .numero { width: 11mm; height: 11mm; line-height: 11mm; border-radius: 50%; margin: 0 auto 3mm; color: #fff; font-weight: 700; background: #c026d3; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .oppure { margin-top: 13mm; font-size: 11pt; color: #71717a; text-transform: uppercase; letter-spacing: .2em; }
  .link { margin-top: 3mm; font-size: 22pt; font-weight: 700; color: #a21caf; word-break: break-all; padding: 0 12mm; }
  .piede { margin-top: auto; padding: 10mm 0 9mm; font-size: 9pt; color: #a1a1aa; letter-spacing: .12em; }
  .barra { padding: 12px; text-align: center; background: #18181b; }
  .barra button { font: inherit; font-size: 14px; font-weight: 600; padding: 10px 18px; border-radius: 10px; border: 0; background: #c026d3; color: #fff; cursor: pointer; }
  @media print { html, body { background: #fff; } .barra { display: none; } .foglio { box-shadow: none; } }
  @media screen and (max-width: 820px) { .foglio { transform-origin: top center; zoom: .45; } }
</style>
</head>
<body>
<div class="barra"><button onclick="window.print()">Stampa il cartello (o salvalo in PDF)</button></div>
<div class="foglio">
  <div class="testa">
    <p class="salone">${nome}</p>
    <h1>Prenota online</h1>
    <p class="sotto">Quando vuoi, anche a salone chiuso</p>
  </div>
  <div class="qr">${d.qrSvg}</div>
  <div class="passi">
    <div class="passo"><div class="numero">1</div>Inquadra il codice con la fotocamera</div>
    <div class="passo"><div class="numero">2</div>Scegli il servizio e l'orario</div>
    <div class="passo"><div class="numero">3</div>Ricevi la conferma</div>
  </div>
  <p class="oppure">oppure vai su</p>
  <p class="link">${pulisci(d.linkDaLeggere)}</p>
  <p class="piede">PRENOTAZIONI CON ROSY</p>
</div>
</body>
</html>`;
}
