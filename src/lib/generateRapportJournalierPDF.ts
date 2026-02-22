/**
 * Generate a daily service report PDF (Boutique, Cantine, Librairie)
 * Includes: sales summary, stock inventory, revenue breakdown
 */

interface RapportItem {
  nom: string;
  quantiteVendue: number;
  montant: number;
  stockActuel: number;
  seuilAlerte: number;
}

interface RapportConfig {
  service: 'Boutique' | 'Cantine' | 'Librairie';
  date: string;
  items: RapportItem[];
  totalVentes: number;
  totalTransactions: number;
  school: { nom: string; soustitre?: string; logo_url?: string | null; ville?: string };
}

export function generateRapportJournalierPDF(config: RapportConfig) {
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) return;

  const { service, date, items, totalVentes, totalTransactions, school } = config;

  const serviceColors: Record<string, { accent: string; bg: string; emoji: string }> = {
    'Boutique': { accent: '#8b5cf6', bg: '#f5f3ff', emoji: '🛍️' },
    'Cantine': { accent: '#22c55e', bg: '#f0fdf4', emoji: '🍽️' },
    'Librairie': { accent: '#3b82f6', bg: '#eff6ff', emoji: '📚' },
  };

  const sc = serviceColors[service] || serviceColors['Boutique'];
  const rapportNum = `RPT-${service.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const dateFormatted = new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const lowStockItems = items.filter(i => i.stockActuel <= i.seuilAlerte && i.stockActuel >= 0);
  const topSellers = [...items].filter(i => i.quantiteVendue > 0).sort((a, b) => b.montant - a.montant).slice(0, 5);

  const tableRows = items.filter(i => i.quantiteVendue > 0 || i.stockActuel >= 0).map(item => {
    const isLow = item.stockActuel <= item.seuilAlerte;
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${item.nom}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantiteVendue}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.montant.toLocaleString()} GNF</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;${isLow ? 'color:#ef4444;font-weight:bold;' : ''}">${item.stockActuel}${isLow ? ' ⚠️' : ''}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.seuilAlerte}</td>
      </tr>
    `;
  }).join('');

  const lowStockSection = lowStockItems.length > 0 ? `
    <div style="margin-top:20px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
      <h3 style="margin:0 0 8px;color:#dc2626;font-size:14px;">⚠️ Alertes Stock (${lowStockItems.length} article${lowStockItems.length > 1 ? 's' : ''})</h3>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#7f1d1d;">
        ${lowStockItems.map(i => `<li><strong>${i.nom}</strong> — ${i.stockActuel} restant(s) (seuil: ${i.seuilAlerte})</li>`).join('')}
      </ul>
    </div>
  ` : '';

  const topSellersSection = topSellers.length > 0 ? `
    <div style="margin-top:20px;padding:12px 16px;background:${sc.bg};border:1px solid ${sc.accent}33;border-radius:8px;">
      <h3 style="margin:0 0 8px;color:${sc.accent};font-size:14px;">🏆 Top Ventes du Jour</h3>
      <ol style="margin:0;padding-left:20px;font-size:13px;">
        ${topSellers.map(i => `<li><strong>${i.nom}</strong> — ${i.quantiteVendue} vendu(s), ${i.montant.toLocaleString()} GNF</li>`).join('')}
      </ol>
    </div>
  ` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport ${service} - ${date}</title>
<style>
  @media print { body { margin: 0; } @page { size: A4; margin: 15mm; } }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1e293b; margin: 20px; }
  .header { text-align: center; border-bottom: 3px solid ${sc.accent}; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 20px; color: #1e293b; }
  .header .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
  .rapport-title { background: ${sc.accent}; color: white; padding: 10px 20px; border-radius: 8px; text-align: center; margin: 15px 0; font-size: 16px; font-weight: bold; }
  .kpi-row { display: flex; gap: 12px; margin: 15px 0; }
  .kpi { flex: 1; padding: 12px; background: ${sc.bg}; border: 1px solid ${sc.accent}33; border-radius: 8px; text-align: center; }
  .kpi .val { font-size: 22px; font-weight: bold; color: ${sc.accent}; }
  .kpi .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
  thead th { background: ${sc.accent}; color: white; padding: 10px; text-align: left; font-size: 12px; }
  thead th:nth-child(n+2) { text-align: center; }
  thead th:nth-child(3) { text-align: right; }
  .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { width: 45%; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 12px; color: #475569; }
  .no-print { display: block; text-align: center; margin-bottom: 20px; }
  @media print { .no-print { display: none !important; } }
</style></head><body>
<div class="no-print">
  <button onclick="window.print()" style="padding:10px 30px;background:${sc.accent};color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px;">🖨️ Imprimer</button>
  <button onclick="window.close()" style="padding:10px 20px;background:#e2e8f0;color:#475569;border:none;border-radius:6px;font-size:14px;cursor:pointer;">Fermer</button>
</div>

<div class="header">
  ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo" style="height:50px;margin-bottom:8px;" />` : ''}
  <h1>${school.nom}</h1>
  ${school.soustitre ? `<div class="sub">${school.soustitre}</div>` : ''}
  ${school.ville ? `<div class="sub">${school.ville}</div>` : ''}
</div>

<div class="rapport-title">${sc.emoji} RAPPORT JOURNALIER — ${service.toUpperCase()}</div>

<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:15px;">
  <span>📅 <strong>${dateFormatted}</strong></span>
  <span>N° ${rapportNum}</span>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="val">${totalTransactions}</div><div class="lbl">Transaction(s)</div></div>
  <div class="kpi"><div class="val">${totalVentes.toLocaleString()}</div><div class="lbl">CA du Jour (GNF)</div></div>
  <div class="kpi"><div class="val">${items.filter(i => i.quantiteVendue > 0).length}</div><div class="lbl">Articles vendus</div></div>
  <div class="kpi"><div class="val">${lowStockItems.length}</div><div class="lbl">Alertes stock</div></div>
</div>

<h3 style="font-size:14px;margin:20px 0 5px;color:${sc.accent};">📊 Détail des opérations & inventaire</h3>
<table>
  <thead>
    <tr><th>Article</th><th>Qté vendue</th><th style="text-align:right">Montant</th><th>Stock restant</th><th>Seuil alerte</th></tr>
  </thead>
  <tbody>
    ${tableRows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">Aucune opération ce jour</td></tr>'}
  </tbody>
  <tfoot>
    <tr style="font-weight:bold;background:${sc.bg};">
      <td style="padding:10px;">TOTAL</td>
      <td style="text-align:center;padding:10px;">${items.reduce((s, i) => s + i.quantiteVendue, 0)}</td>
      <td style="text-align:right;padding:10px;">${totalVentes.toLocaleString()} GNF</td>
      <td colspan="2"></td>
    </tr>
  </tfoot>
</table>

${topSellersSection}
${lowStockSection}

<div class="signatures">
  <div class="sig-box">Responsable ${service}<br/><br/><br/>Signature & Cachet</div>
  <div class="sig-box">Direction / Comptabilité<br/><br/><br/>Signature & Cachet</div>
</div>

<div class="footer">
  Rapport généré le ${new Date().toLocaleString('fr-FR')} — ${school.nom}<br/>
  Document strictement interne — Ne pas diffuser
</div>

</body></html>`;

  w.document.write(html);
  w.document.close();
}
