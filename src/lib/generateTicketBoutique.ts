/**
 * Generate a printable Boutique receipt (Ticket Boutique)
 */
export function generateTicketBoutique(data: {
  eleve: string;
  matricule: string;
  classe: string;
  items: { nom: string; taille: string; quantite: number; prixUnitaire: number }[];
  montantTotal: number;
  remisePct: number;
  montantFinal: number;
  date: string;
}) {
  const w = window.open('', '_blank', 'width=400,height=700');
  if (!w) return;

  const recuNum = Date.now().toString(36).toUpperCase();

  const itemsRows = data.items.map(item => `
    <tr>
      <td>${item.nom}</td>
      <td style="text-align:center">${item.taille}</td>
      <td style="text-align:center">${item.quantite}</td>
      <td style="text-align:right">${item.prixUnitaire.toLocaleString()}</td>
      <td style="text-align:right">${(item.prixUnitaire * item.quantite).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Ticket Boutique — ${data.eleve}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; width: 80mm; margin: auto; padding: 4mm; color: #111; font-size: 11px; }
    .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 6px; margin-bottom: 8px; }
    .header h1 { font-size: 16px; margin-bottom: 2px; }
    .header .sub { font-size: 10px; color: #666; }
    .badge { display: inline-block; background: #7c3aed; color: white; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; margin-top: 4px; }
    .info { width: 100%; margin-bottom: 8px; }
    .info td { padding: 1px 4px; }
    .info .lbl { color: #888; font-size: 9px; text-transform: uppercase; }
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    table.items th { background: #f3f4f6; padding: 3px 4px; font-size: 9px; text-transform: uppercase; border-bottom: 1px solid #ccc; }
    table.items td { padding: 3px 4px; border-bottom: 1px dotted #ddd; }
    .totals { border-top: 2px dashed #333; padding-top: 6px; margin-top: 4px; }
    .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals .final { font-size: 16px; font-weight: bold; border-top: 1px solid #333; padding-top: 4px; margin-top: 4px; }
    .footer { text-align: center; margin-top: 10px; font-size: 9px; color: #999; border-top: 1px dashed #ccc; padding-top: 6px; }
    @media print { body { width: 80mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛍️ BOUTIQUE</h1>
    <p class="sub">EduGestion Pro — Ticket de vente</p>
    <div class="badge">N° ${recuNum}</div>
  </div>
  <table class="info">
    <tr><td class="lbl">Élève</td><td><strong>${data.eleve}</strong></td></tr>
    <tr><td class="lbl">Matricule</td><td>${data.matricule || '—'}</td></tr>
    <tr><td class="lbl">Classe</td><td>${data.classe}</td></tr>
    <tr><td class="lbl">Date</td><td>${data.date}</td></tr>
  </table>
  <table class="items">
    <thead><tr><th>Article</th><th>Taille</th><th>Qté</th><th style="text-align:right">P.U.</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Sous-total</span><span>${data.montantTotal.toLocaleString()} GNF</span></div>
    ${data.remisePct > 0 ? `<div class="row" style="color:#dc2626"><span>Remise (${data.remisePct}%)</span><span>-${Math.round(data.montantTotal * data.remisePct / 100).toLocaleString()} GNF</span></div>` : ''}
    <div class="row final"><span>TOTAL</span><span>${data.montantFinal.toLocaleString()} GNF</span></div>
  </div>
  <div class="footer">
    <p>Merci pour votre achat !</p>
    <p>EduGestion Pro — ${new Date().toLocaleDateString('fr-FR')}</p>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
}
