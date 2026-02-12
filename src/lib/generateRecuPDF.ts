/**
 * Generate a printable receipt for a tuition payment
 */
export function generateRecuPDF(paiement: {
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
}) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Reçu de paiement — ${paiement.eleve}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
    .header { text-align: center; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; color: #1e3a5f; }
    .header p { color: #666; font-size: 13px; margin-top: 4px; }
    .badge { display: inline-block; background: #1e3a5f; color: white; padding: 4px 16px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-top: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .info-item { background: #f8f9fa; padding: 10px 14px; border-radius: 6px; }
    .info-item label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-item p { font-size: 15px; font-weight: 600; margin-top: 2px; }
    .montant-box { text-align: center; background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .montant-box .montant { font-size: 28px; font-weight: bold; color: #2e7d32; }
    .montant-box .label { font-size: 12px; color: #666; }
    .summary { margin: 20px 0; }
    .summary table { width: 100%; border-collapse: collapse; }
    .summary th, .summary td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
    .summary th { color: #888; font-weight: 500; font-size: 12px; text-transform: uppercase; }
    .summary .total td { font-weight: bold; border-top: 2px solid #1e3a5f; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 11px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎓 EduGestion Pro</h1>
    <p>Reçu de paiement de scolarité</p>
    <div class="badge">REÇU N° ${Date.now().toString(36).toUpperCase()}</div>
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
      <label>Mois concerné</label>
      <p>${paiement.mois}</p>
    </div>
    <div class="info-item">
      <label>Canal</label>
      <p>${paiement.canal}${paiement.reference ? ` — Réf: ${paiement.reference}` : ''}</p>
    </div>
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
        <tr><td>Total déjà payé</td><td style="text-align:right;color:#2e7d32">${paiement.totalPaye.toLocaleString()} GNF</td></tr>
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
