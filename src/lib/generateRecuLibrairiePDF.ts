/**
 * Generate a detailed bookstore receipt listing each purchased article
 */
export function generateRecuLibrairiePDF(data: {
  eleve: string;
  matricule: string;
  classe: string;
  articles: { nom: string; categorie: string; quantite: number; prixUnitaire: number }[];
  totalMontant: number;
  canal: string;
  reference: string | null;
  date: string;
}) {
  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) return;

  const accentColor = '#16a34a';
  const accentBg = '#f0fdf4';
  const accentBorder = '#22c55e';
  const accentText = '#15803d';
  const recuNum = Date.now().toString(36).toUpperCase();

  const articlesRows = data.articles.map(a =>
    `<tr>
      <td>${a.nom}</td>
      <td class="center">${a.categorie}</td>
      <td class="center">${a.quantite}</td>
      <td class="right">${a.prixUnitaire.toLocaleString()} GNF</td>
      <td class="right bold">${(a.prixUnitaire * a.quantite).toLocaleString()} GNF</td>
    </tr>`
  ).join('');

  const buildHalf = (partieLabel: string) => `
    <div class="half">
      <div class="partie-label">${partieLabel}</div>
      <div class="header">
        <h1>📚 EduGestion Pro — Librairie</h1>
        <p class="sub">Reçu d'achat — Articles scolaires</p>
        <div class="badge">REÇU N° ${recuNum}</div>
      </div>
      <table class="info">
        <tr><td class="lbl">Élève</td><td class="val">${data.eleve}</td><td class="lbl">Matricule</td><td class="val">${data.matricule || '—'}</td></tr>
        <tr><td class="lbl">Classe</td><td class="val">${data.classe}</td><td class="lbl">Date</td><td class="val">${data.date}</td></tr>
        <tr><td class="lbl">Canal</td><td class="val" colspan="3">${data.canal}${data.reference ? ` — Réf: ${data.reference}` : ''}</td></tr>
      </table>
      <table class="articles">
        <thead><tr><th>Article</th><th class="center">Catégorie</th><th class="center">Qté</th><th class="right">P.U.</th><th class="right">Total</th></tr></thead>
        <tbody>${articlesRows}</tbody>
      </table>
      <div class="montant-box">
        <span class="label">Montant total</span>
        <span class="montant">${data.totalMontant.toLocaleString()} GNF</span>
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
<html lang="fr"><head><meta charset="UTF-8" /><title>Reçu Librairie — ${data.eleve}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; width: 210mm; }
  .page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; }
  .half { height: 148.5mm; padding: 8mm 12mm 6mm; position: relative; overflow: hidden; border-bottom: 2px dashed #aaa; }
  .half:last-child { border-bottom: none; }
  .partie-label { position: absolute; top: 4mm; right: 10mm; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: white; background: ${accentColor}; padding: 2px 10px; border-radius: 0 0 4px 4px; }
  .header { text-align: center; border-bottom: 2px solid ${accentColor}; padding-bottom: 6px; margin-bottom: 8px; }
  .header h1 { font-size: 15px; color: ${accentColor}; }
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
  table.articles .bold { font-weight: 700; }
  .montant-box { text-align: center; background: ${accentBg}; border: 1.5px solid ${accentBorder}; border-radius: 6px; padding: 6px; margin: 6px 0; }
  .montant-box .label { font-size: 9px; color: #666; margin-right: 8px; }
  .montant-box .montant { font-size: 20px; font-weight: bold; color: ${accentText}; }
  .footer { text-align: center; font-size: 8px; color: #999; margin-top: 4px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 8px; }
  .sig-block { text-align: center; width: 40%; }
  .sig-line { border-top: 1px solid #333; margin-top: 20px; margin-bottom: 2px; }
  .sig-block p { font-size: 8px; color: #666; }
  @media print { body { width: 210mm; } }
</style></head><body>
<div class="page">${buildHalf('📋 PARTIE PARENT')}${buildHalf('📋 PARTIE DIRECTION')}</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
}

/**
 * Generate a warehouse exit slip for articles to be handed to the student
 */
export function generateBonSortiePDF(data: {
  eleve: string;
  matricule: string;
  classe: string;
  articles: { nom: string; categorie: string; quantite: number }[];
  date: string;
}) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return;

  const recuNum = Date.now().toString(36).toUpperCase();
  const articlesRows = data.articles.map(a =>
    `<tr><td>${a.nom}</td><td class="center">${a.categorie}</td><td class="center">${a.quantite}</td><td class="center">☐</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8" /><title>Bon de Sortie — ${data.eleve}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A5 landscape; margin: 10mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; width: 210mm; padding: 10mm; }
  .header { text-align: center; border-bottom: 2px solid #f97316; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 16px; color: #f97316; }
  .header .sub { color: #666; font-size: 11px; }
  .badge { display: inline-block; background: #f97316; color: white; padding: 3px 12px; border-radius: 3px; font-size: 11px; font-weight: bold; margin-top: 4px; }
  table.info { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
  table.info td { padding: 4px 8px; }
  table.info .lbl { color: #888; font-size: 10px; text-transform: uppercase; width: 20%; }
  table.info .val { font-weight: 600; }
  table.articles { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
  table.articles th { background: #fff7ed; padding: 6px 8px; border-bottom: 2px solid #f97316; text-align: left; font-size: 10px; text-transform: uppercase; color: #c2410c; }
  table.articles td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  table.articles .center { text-align: center; }
  .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
  .sig-block { text-align: center; width: 30%; }
  .sig-line { border-top: 1px solid #333; margin-top: 30px; margin-bottom: 4px; }
  .sig-block p { font-size: 9px; color: #666; }
  .note { font-size: 9px; color: #999; text-align: center; margin-top: 10px; }
  @media print { body { width: auto; } }
</style></head><body>
  <div class="header">
    <h1>📦 Bon de Sortie Magasin</h1>
    <p class="sub">EduGestion Pro — Articles à remettre</p>
    <div class="badge">BON N° ${recuNum}</div>
  </div>
  <table class="info">
    <tr><td class="lbl">Élève</td><td class="val">${data.eleve}</td><td class="lbl">Matricule</td><td class="val">${data.matricule || '—'}</td></tr>
    <tr><td class="lbl">Classe</td><td class="val">${data.classe}</td><td class="lbl">Date</td><td class="val">${data.date}</td></tr>
  </table>
  <table class="articles">
    <thead><tr><th>Article</th><th class="center">Catégorie</th><th class="center">Quantité</th><th class="center">Remis ✓</th></tr></thead>
    <tbody>${articlesRows}</tbody>
  </table>
  <div class="signatures">
    <div class="sig-block"><div class="sig-line"></div><p>Signature Comptable</p></div>
    <div class="sig-block"><div class="sig-line"></div><p>Signature Magasinier</p></div>
    <div class="sig-block"><div class="sig-line"></div><p>Signature Parent/Élève</p></div>
  </div>
  <p class="note">Ce bon atteste la remise des articles ci-dessus — EduGestion Pro</p>
<script>window.onload = function() { window.print(); }</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
}
