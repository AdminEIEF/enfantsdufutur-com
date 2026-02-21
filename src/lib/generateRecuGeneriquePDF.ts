/**
 * Generate a universal printable receipt for ANY payment type
 * Format A4 with two identical A5 halves: PARTIE PARENT & PARTIE DIRECTION
 */
export function generateRecuGeneriquePDF(data: {
  type: string;
  typeLabel: string;
  eleve: string;
  matricule: string;
  classe: string;
  montant: number;
  mois: string | null;
  canal: string;
  reference: string | null;
  date: string;
  details?: string;
}) {
  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) return;

  const colorMap: Record<string, { accent: string; bg: string; border: string; text: string; emoji: string }> = {
    scolarite: { accent: '#1e3a5f', bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32', emoji: '🎓' },
    transport: { accent: '#f97316', bg: '#fff7ed', border: '#f97316', text: '#c2410c', emoji: '🚌' },
    cantine: { accent: '#8b5cf6', bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9', emoji: '🍽️' },
    uniforme: { accent: '#06b6d4', bg: '#ecfeff', border: '#06b6d4', text: '#0e7490', emoji: '👔' },
    fournitures: { accent: '#16a34a', bg: '#f0fdf4', border: '#22c55e', text: '#15803d', emoji: '📚' },
    article: { accent: '#ec4899', bg: '#fdf2f8', border: '#ec4899', text: '#be185d', emoji: '🛍️' },
    inscription: { accent: '#0284c7', bg: '#f0f9ff', border: '#0284c7', text: '#0369a1', emoji: '📝' },
    reinscription: { accent: '#0284c7', bg: '#f0f9ff', border: '#0284c7', text: '#0369a1', emoji: '🔄' },
    autre: { accent: '#6b7280', bg: '#f9fafb', border: '#6b7280', text: '#4b5563', emoji: '💰' },
  };

  const colors = colorMap[data.type] || colorMap.autre;
  const recuNum = Date.now().toString(36).toUpperCase();

  const buildHalf = (partieLabel: string) => `
    <div class="half">
      <div class="partie-label">${partieLabel}</div>
      <div class="header">
        <h1>${colors.emoji} EduGestion Pro</h1>
        <p class="sub">Reçu de paiement — ${data.typeLabel}</p>
        <div class="badge">REÇU N° ${recuNum}</div>
      </div>
      <table class="info">
        <tr><td class="lbl">Élève</td><td class="val">${data.eleve}</td><td class="lbl">Matricule</td><td class="val">${data.matricule || '—'}</td></tr>
        <tr><td class="lbl">Classe</td><td class="val">${data.classe}</td><td class="lbl">Date</td><td class="val">${data.date}</td></tr>
        ${data.mois ? `<tr><td class="lbl">Mois</td><td class="val">${data.mois}</td><td class="lbl">Canal</td><td class="val">${data.canal}${data.reference ? ` — Réf: ${data.reference}` : ''}</td></tr>` : `<tr><td class="lbl">Canal</td><td class="val" colspan="3">${data.canal}${data.reference ? ` — Réf: ${data.reference}` : ''}</td></tr>`}
        ${data.details ? `<tr><td class="lbl">Détails</td><td class="val" colspan="3">${data.details}</td></tr>` : ''}
      </table>
      <div class="montant-box">
        <span class="label">Montant payé</span>
        <span class="montant">${data.montant.toLocaleString()} GNF</span>
      </div>
      <div class="footer">
        <p>Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p>Ce reçu fait foi de paiement — EduGestion Pro</p>
        <p style="margin-top:3px;font-weight:600;color:#c62828;font-size:7.5px;">NB : Une fois versé tous frais sont non remboursable et non transférables.</p>
      </div>
      <div class="signatures">
        <div class="sig-block"><div class="sig-line"></div><p>Signature Parent</p></div>
        <div class="sig-block"><div class="sig-line"></div><p>Cachet & Signature Direction</p></div>
      </div>
    </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Reçu ${data.typeLabel} — ${data.eleve}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; width: 210mm; }
    .page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; }
    .half { height: 148.5mm; padding: 8mm 12mm 6mm; position: relative; overflow: hidden; border-bottom: 2px dashed #aaa; }
    .half:last-child { border-bottom: none; }
    .partie-label { position: absolute; top: 4mm; right: 10mm; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: white; background: ${colors.accent}; padding: 2px 10px; border-radius: 0 0 4px 4px; }
    .header { text-align: center; border-bottom: 2px solid ${colors.accent}; padding-bottom: 6px; margin-bottom: 8px; }
    .header h1 { font-size: 16px; color: ${colors.accent}; }
    .header .sub { color: #666; font-size: 10px; margin-top: 1px; }
    .badge { display: inline-block; background: ${colors.accent}; color: white; padding: 2px 10px; border-radius: 3px; font-size: 10px; font-weight: bold; margin-top: 4px; }
    table.info { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
    table.info td { padding: 3px 6px; }
    table.info .lbl { color: #888; font-size: 9px; text-transform: uppercase; width: 18%; font-weight: 500; }
    table.info .val { font-weight: 600; width: 32%; }
    .montant-box { text-align: center; background: ${colors.bg}; border: 1.5px solid ${colors.border}; border-radius: 6px; padding: 10px; margin: 10px 0; }
    .montant-box .label { font-size: 9px; color: #666; margin-right: 8px; }
    .montant-box .montant { font-size: 24px; font-weight: bold; color: ${colors.text}; }
    .footer { text-align: center; font-size: 8px; color: #999; margin-top: 8px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 12px; }
    .sig-block { text-align: center; width: 40%; }
    .sig-line { border-top: 1px solid #333; margin-top: 25px; margin-bottom: 2px; }
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
