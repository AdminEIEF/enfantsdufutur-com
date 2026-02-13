/**
 * Generate a printable receipt for a tuition or transport payment
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
  // Transport-specific
  zone?: string;
  chauffeur?: string;
  telephoneChauffeur?: string;
}) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return;

  const isTransport = paiement.type === 'transport';
  const accentColor = isTransport ? '#f97316' : '#1e3a5f';
  const accentBg = isTransport ? '#fff7ed' : '#e8f5e9';
  const accentBorder = isTransport ? '#f97316' : '#4caf50';
  const accentText = isTransport ? '#c2410c' : '#2e7d32';
  const typeLabel = isTransport ? 'Transport scolaire' : 'Scolarité';
  const emoji = isTransport ? '🚌' : '🎓';

  const transportInfo = isTransport ? `
    <div class="info-item">
      <label>Zone de transport</label>
      <p>${paiement.zone || '—'}</p>
    </div>
    <div class="info-item">
      <label>Chauffeur / Bus</label>
      <p>${paiement.chauffeur || '—'}${paiement.telephoneChauffeur ? ` — Tél: ${paiement.telephoneChauffeur}` : ''}</p>
    </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Reçu de paiement — ${paiement.eleve}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
    .header { text-align: center; border-bottom: 3px solid ${accentColor}; padding-bottom: 20px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; color: ${accentColor}; }
    .header p { color: #666; font-size: 13px; margin-top: 4px; }
    .badge { display: inline-block; background: ${accentColor}; color: white; padding: 4px 16px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-top: 8px; }
    .type-badge { display: inline-block; background: ${accentBg}; color: ${accentText}; padding: 2px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-top: 6px; border: 1px solid ${accentBorder}; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .info-item { background: #f8f9fa; padding: 10px 14px; border-radius: 6px; }
    .info-item label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-item p { font-size: 15px; font-weight: 600; margin-top: 2px; }
    .montant-box { text-align: center; background: ${accentBg}; border: 2px solid ${accentBorder}; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .montant-box .montant { font-size: 28px; font-weight: bold; color: ${accentText}; }
    .montant-box .label { font-size: 12px; color: #666; }
    .summary { margin: 20px 0; }
    .summary table { width: 100%; border-collapse: collapse; }
    .summary th, .summary td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
    .summary th { color: #888; font-weight: 500; font-size: 12px; text-transform: uppercase; }
    .summary .total td { font-weight: bold; border-top: 2px solid ${accentColor}; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 11px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${emoji} EduGestion Pro</h1>
    <p>Reçu de paiement — ${typeLabel}</p>
    <div class="badge">REÇU N° ${Date.now().toString(36).toUpperCase()}</div>
    <div class="type-badge">${typeLabel}</div>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <label>Élève</label>
      <p>${paiement.eleve}</p>
    </div>
    <div class="info-item">
      <label>Matricule</label>
      <p>${paiement.matricule || '—'}</p>
    </div>
    <div class="info-item">
      <label>Classe</label>
      <p>${paiement.classe}</p>
    </div>
    <div class="info-item">
      <label>Date</label>
      <p>${paiement.date}</p>
    </div>
    <div class="info-item">
      <label>Mois concerné(s)</label>
      <p>${paiement.mois}</p>
    </div>
    <div class="info-item">
      <label>Canal</label>
      <p>${paiement.canal}${paiement.reference ? ` — Réf: ${paiement.reference}` : ''}</p>
    </div>
    ${transportInfo}
  </div>

  <div class="montant-box">
    <div class="label">Montant payé</div>
    <div class="montant">${paiement.montant.toLocaleString()} GNF</div>
  </div>

  <div class="summary">
    <table>
      <thead>
        <tr><th>Détail</th><th style="text-align:right">Montant</th></tr>
      </thead>
      <tbody>
        <tr><td>Total annuel (9 mois)</td><td style="text-align:right">${paiement.totalAnnuel.toLocaleString()} GNF</td></tr>
        <tr><td>Total déjà payé</td><td style="text-align:right;color:${accentText}">${paiement.totalPaye.toLocaleString()} GNF</td></tr>
        <tr class="total"><td>Reste à payer</td><td style="text-align:right;color:#c62828">${paiement.resteAPayer.toLocaleString()} GNF</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Document généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    <p style="margin-top:4px">Ce reçu fait foi de paiement — EduGestion Pro</p>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
}
