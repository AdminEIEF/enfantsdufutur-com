/**
 * Generate a printable receipt for a tuition or transport payment
 * Format A4 with two identical A5 halves: PARTIE PARENT & PARTIE DIRECTION
 */
export function generateRecuPDF(paiement: {
  type?: 'scolarite' | 'transport';
  eleve: string;
  matricule: string;
  classe: string;
  montant: number;
  mois: string;
  canal: string;
  reference: string | null;
  date: string;
  totalAnnuel: number;
  totalPaye: number;
  resteAPayer: number;
  zone?: string;
  chauffeur?: string;
  telephoneChauffeur?: string;
}) {
  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) return;

  const isTransport = paiement.type === 'transport';
  const accentColor = isTransport ? '#f97316' : '#1e3a5f';
  const accentBg = isTransport ? '#fff7ed' : '#e8f5e9';
  const accentBorder = isTransport ? '#f97316' : '#4caf50';
  const accentText = isTransport ? '#c2410c' : '#2e7d32';
  const typeLabel = isTransport ? 'Transport scolaire' : 'Scolarité';
  const emoji = isTransport ? '🚌' : '🎓';
  const recuNum = Date.now().toString(36).toUpperCase();

  const transportInfo = isTransport ? `
    <tr><td class="lbl">Zone de transport</td><td class="val">${paiement.zone || '—'}</td></tr>
    <tr><td class="lbl">Chauffeur / Bus</td><td class="val">${paiement.chauffeur || '—'}${paiement.telephoneChauffeur ? ` — Tél: ${paiement.telephoneChauffeur}` : ''}</td></tr>
  ` : '';

  const buildHalf = (partieLabel: string) => `
    <div class="half">
      <div class="partie-label">${partieLabel}</div>
      <div class="header">
        <h1>${emoji} EduGestion Pro</h1>
        <p class="sub">Reçu de paiement — ${typeLabel}</p>
        <div class="badge">REÇU N° ${recuNum}</div>
      </div>
      <table class="info">
        <tr><td class="lbl">Élève</td><td class="val">${paiement.eleve}</td><td class="lbl">Matricule</td><td class="val">${paiement.matricule || '—'}</td></tr>
        <tr><td class="lbl">Classe</td><td class="val">${paiement.classe}</td><td class="lbl">Date</td><td class="val">${paiement.date}</td></tr>
        <tr><td class="lbl">Mois</td><td class="val">${paiement.mois}</td><td class="lbl">Canal</td><td class="val">${paiement.canal}${paiement.reference ? ` — Réf: ${paiement.reference}` : ''}</td></tr>
        ${transportInfo}
      </table>
      <div class="montant-box">
        <span class="label">Montant payé</span>
        <span class="montant">${paiement.montant.toLocaleString()} GNF</span>
      </div>
      <table class="summary">
        <tr><td>Total annuel</td><td class="right">${paiement.totalAnnuel.toLocaleString()} GNF</td></tr>
        <tr><td>Total déjà payé</td><td class="right" style="color:${accentText}">${paiement.totalPaye.toLocaleString()} GNF</td></tr>
        <tr class="total-row"><td>Reste à payer</td><td class="right" style="color:#c62828">${paiement.resteAPayer.toLocaleString()} GNF</td></tr>
      </table>
      <div class="footer">
        <p>Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p>Ce reçu fait foi de paiement — EduGestion Pro</p>
      </div>
      <div class="signatures">
        <div class="sig-block"><div class="sig-line"></div><p>Signature Parent</p></div>
        <div class="sig-block"><div class="sig-line"></div><p>Cachet & Signature Direction</p></div>
      </div>
    </div>
  `;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Reçu — ${paiement.eleve}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; width: 210mm; }
    .page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; }
    .half { height: 148.5mm; padding: 8mm 12mm 6mm; position: relative; overflow: hidden; border-bottom: 2px dashed #aaa; }
    .half:last-child { border-bottom: none; }
    .partie-label { position: absolute; top: 4mm; right: 10mm; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: white; background: ${accentColor}; padding: 2px 10px; border-radius: 0 0 4px 4px; }
    .header { text-align: center; border-bottom: 2px solid ${accentColor}; padding-bottom: 6px; margin-bottom: 8px; }
    .header h1 { font-size: 16px; color: ${accentColor}; }
    .header .sub { color: #666; font-size: 10px; margin-top: 1px; }
    .badge { display: inline-block; background: ${accentColor}; color: white; padding: 2px 10px; border-radius: 3px; font-size: 10px; font-weight: bold; margin-top: 4px; }
    table.info { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
    table.info td { padding: 3px 6px; }
    table.info .lbl { color: #888; font-size: 9px; text-transform: uppercase; width: 18%; font-weight: 500; }
    table.info .val { font-weight: 600; width: 32%; }
    .montant-box { text-align: center; background: ${accentBg}; border: 1.5px solid ${accentBorder}; border-radius: 6px; padding: 6px; margin: 6px 0; }
    .montant-box .label { font-size: 9px; color: #666; margin-right: 8px; }
    .montant-box .montant { font-size: 20px; font-weight: bold; color: ${accentText}; }
    table.summary { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 6px; }
    table.summary td { padding: 3px 6px; border-bottom: 1px solid #eee; }
    table.summary .right { text-align: right; }
    table.summary .total-row td { font-weight: bold; border-top: 2px solid ${accentColor}; border-bottom: none; }
    .footer { text-align: center; font-size: 8px; color: #999; margin-top: 4px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 8px; }
    .sig-block { text-align: center; width: 40%; }
    .sig-line { border-top: 1px solid #333; margin-top: 20px; margin-bottom: 2px; }
    .sig-block p { font-size: 8px; color: #666; }
    @media print { body { width: 210mm; } .page { page-break-after: auto; } }
  </style>
</head>
<body>
  <div class="page">
    ${buildHalf('📋 PARTIE PARENT')}
    ${buildHalf('📋 PARTIE DIRECTION')}
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
}
