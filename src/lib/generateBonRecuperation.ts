/**
 * Generate a printable "Bon de Récupération" when articles are delivered to parent/student
 */
export function generateBonRecuperation(data: {
  eleve: string;
  matricule: string;
  classe: string;
  articles: { nom: string; taille?: string | null; quantite: number; prixUnitaire: number }[];
  totalMontant: number;
  date: string;
  heure: string;
  livrePar?: string;
}) {
  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) return;

  const accentColor = '#7c3aed';
  const accentBg = '#f5f3ff';
  const accentBorder = '#8b5cf6';
  const accentText = '#6d28d9';
  const recuNum = Date.now().toString(36).toUpperCase();

  const articlesRows = data.articles.map(a =>
    `<tr>
      <td>${a.nom}</td>
      <td class="center">${a.taille || '—'}</td>
      <td class="center">${a.quantite}</td>
      <td class="right">${a.prixUnitaire.toLocaleString()} GNF</td>
      <td class="center">✓</td>
    </tr>`
  ).join('');

  const buildHalf = (partieLabel: string) => `
    <div class="half">
      <div class="partie-label">${partieLabel}</div>
      <div class="header">
        <h1>📦 EduGestion Pro — Bon de Récupération</h1>
        <p class="sub">Preuve de remise d'articles scolaires</p>
        <div class="badge">BON N° ${recuNum}</div>
      </div>
      <table class="info">
        <tr><td class="lbl">Élève</td><td class="val">${data.eleve}</td><td class="lbl">Matricule</td><td class="val">${data.matricule || '—'}</td></tr>
        <tr><td class="lbl">Classe</td><td class="val">${data.classe}</td><td class="lbl">Date</td><td class="val">${data.date}</td></tr>
        <tr><td class="lbl">Heure</td><td class="val">${data.heure}</td><td class="lbl">Remis par</td><td class="val">${data.livrePar || '—'}</td></tr>
      </table>
      <table class="articles">
        <thead><tr><th>Article</th><th class="center">Taille</th><th class="center">Qté</th><th class="right">Valeur</th><th class="center">Remis</th></tr></thead>
        <tbody>${articlesRows}</tbody>
      </table>
      <div class="montant-box">
        <span class="label">Valeur totale des articles livrés</span>
        <span class="montant">${data.totalMontant.toLocaleString()} GNF</span>
      </div>
      <div class="confirm-box">
        <p>Je soussigné(e), confirme avoir reçu l'intégralité des articles ci-dessus en bon état.</p>
      </div>
      <div class="signatures">
        <div class="sig-block"><div class="sig-line"></div><p>Signature Parent / Élève</p></div>
        <div class="sig-block"><div class="sig-line"></div><p>Cachet & Signature Boutique</p></div>
      </div>
      <div class="footer">
        <p>Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p>Ce bon fait foi de remise d'articles — EduGestion Pro</p>
      </div>
    </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8" /><title>Bon de Récupération — ${data.eleve}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; width: 210mm; }
  .page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; }
  .half { height: 148.5mm; padding: 8mm 12mm 6mm; position: relative; overflow: hidden; border-bottom: 2px dashed #aaa; }
  .half:last-child { border-bottom: none; }
  .partie-label { position: absolute; top: 4mm; right: 10mm; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: white; background: ${accentColor}; padding: 2px 10px; border-radius: 0 0 4px 4px; }
  .header { text-align: center; border-bottom: 2px solid ${accentColor}; padding-bottom: 6px; margin-bottom: 8px; }
  .header h1 { font-size: 14px; color: ${accentColor}; }
  .header .sub { color: #666; font-size: 10px; margin-top: 1px; }
  .badge { display: inline-block; background: ${accentColor}; color: white; padding: 2px 10px; border-radius: 3px; font-size: 10px; font-weight: bold; margin-top: 4px; }
  table.info { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10px; }
  table.info td { padding: 3px 6px; }
  table.info .lbl { color: #888; font-size: 9px; text-transform: uppercase; width: 18%; font-weight: 500; }
  table.info .val { font-weight: 600; width: 32%; }
  table.articles { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 6px; }
  table.articles th { background: ${accentBg}; padding: 4px 6px; border-bottom: 1.5px solid ${accentBorder}; text-align: left; font-size: 8px; text-transform: uppercase; color: ${accentText}; }
  table.articles td { padding: 3px 6px; border-bottom: 1px solid #eee; }
  table.articles .center { text-align: center; }
  table.articles .right { text-align: right; }
  .montant-box { text-align: center; background: ${accentBg}; border: 1.5px solid ${accentBorder}; border-radius: 6px; padding: 4px; margin: 4px 0; }
  .montant-box .label { font-size: 9px; color: #666; margin-right: 8px; }
  .montant-box .montant { font-size: 18px; font-weight: bold; color: ${accentText}; }
  .confirm-box { border: 1px solid #ddd; border-radius: 4px; padding: 6px 10px; margin: 4px 0; background: #fafafa; font-size: 9px; font-style: italic; color: #555; }
  .signatures { display: flex; justify-content: space-between; margin-top: 6px; }
  .sig-block { text-align: center; width: 40%; }
  .sig-line { border-top: 1px solid #333; margin-top: 18px; margin-bottom: 2px; }
  .sig-block p { font-size: 8px; color: #666; }
  .footer { text-align: center; font-size: 7px; color: #999; margin-top: 4px; }
  @media print { body { width: 210mm; } }
</style></head><body>
<div class="page">${buildHalf('📋 PARTIE PARENT')}${buildHalf('📋 PARTIE BOUTIQUE')}</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
}
