/**
 * Generate a pointage report PDF (daily or weekly)
 */

interface PointageEntry {
  eleve_nom: string;
  eleve_prenom: string;
  matricule: string;
  classe: string;
  heure_arrivee: string | null;
  heure_depart: string | null;
  en_retard: boolean;
}

interface RapportPointageConfig {
  type: 'jour' | 'semaine';
  date: string; // for daily
  dateDebut?: string; // for weekly
  dateFin?: string;
  pointages: PointageEntry[];
  stats: { total: number; presents: number; retards: number; departs: number };
  school: { nom: string; soustitre?: string; logo_url?: string | null; ville?: string };
}

export function generateRapportPointagePDF(config: RapportPointageConfig) {
  const w = window.open('', '_blank', 'width=900,height=1200');
  if (!w) return;

  const { type, date, dateDebut, dateFin, pointages, stats, school } = config;
  const accent = '#3b82f6';
  const bg = '#eff6ff';

  const titre = type === 'jour'
    ? `RAPPORT DE POINTAGE — ${new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    : `RAPPORT DE POINTAGE — Semaine du ${new Date(dateDebut!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${new Date(dateFin!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  const rapportNum = `PTG-${Date.now().toString(36).toUpperCase()}`;

  // Group by date for weekly
  const byDate: Record<string, PointageEntry[]> = {};
  pointages.forEach(p => {
    const key = type === 'jour' ? date : (p as any).date_pointage || date;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(p);
  });

  const generateTable = (entries: PointageEntry[], showDate = false) => {
    if (entries.length === 0) return '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">Aucun pointage</td></tr>';
    return entries.map(p => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${p.eleve_prenom} ${p.eleve_nom}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-family:monospace;">${p.matricule}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${p.classe}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;${p.en_retard ? 'color:#ef4444;font-weight:bold;' : 'color:#22c55e;'}">${p.heure_arrivee ? new Date(p.heure_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${p.heure_depart ? new Date(p.heure_depart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${p.en_retard ? '<span style="background:#fef2f2;color:#dc2626;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">Retard</span>' : '<span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">OK</span>'}</td>
      </tr>
    `).join('');
  };

  const tableContent = type === 'jour'
    ? `<table><thead><tr><th>Élève</th><th>Matricule</th><th>Classe</th><th>Arrivée</th><th>Départ</th><th>Statut</th></tr></thead><tbody>${generateTable(pointages)}</tbody></table>`
    : Object.keys(byDate).sort().map(d => `
        <h3 style="font-size:13px;margin:20px 0 5px;color:${accent};text-transform:capitalize;">
          📅 ${new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          <span style="font-weight:normal;color:#64748b;font-size:11px;margin-left:8px;">(${byDate[d].length} pointages, ${byDate[d].filter(p => p.en_retard).length} retards)</span>
        </h3>
        <table><thead><tr><th>Élève</th><th>Matricule</th><th>Classe</th><th>Arrivée</th><th>Départ</th><th>Statut</th></tr></thead><tbody>${generateTable(byDate[d])}</tbody></table>
      `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport Pointage</title>
<style>
  @media print { body { margin: 0; } @page { size: A4; margin: 15mm; } }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1e293b; margin: 20px; }
  .header { text-align: center; border-bottom: 3px solid ${accent}; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 20px; color: #1e293b; }
  .header .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
  .rapport-title { background: ${accent}; color: white; padding: 10px 20px; border-radius: 8px; text-align: center; margin: 15px 0; font-size: 15px; font-weight: bold; }
  .kpi-row { display: flex; gap: 12px; margin: 15px 0; }
  .kpi { flex: 1; padding: 12px; background: ${bg}; border: 1px solid ${accent}33; border-radius: 8px; text-align: center; }
  .kpi .val { font-size: 22px; font-weight: bold; color: ${accent}; }
  .kpi .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  thead th { background: ${accent}; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  thead th:nth-child(n+2) { text-align: center; }
  .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { width: 45%; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 12px; color: #475569; }
  .no-print { display: block; text-align: center; margin-bottom: 20px; }
  @media print { .no-print { display: none !important; } }
</style></head><body>
<div class="no-print">
  <button onclick="window.print()" style="padding:10px 30px;background:${accent};color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;margin-right:10px;">🖨️ Imprimer</button>
  <button onclick="window.close()" style="padding:10px 20px;background:#e2e8f0;color:#475569;border:none;border-radius:6px;font-size:14px;cursor:pointer;">Fermer</button>
</div>

<div class="header">
  ${school.logo_url ? `<img src="${school.logo_url}" alt="Logo" style="height:50px;margin-bottom:8px;" />` : ''}
  <h1>${school.nom}</h1>
  ${school.soustitre ? `<div class="sub">${school.soustitre}</div>` : ''}
  ${school.ville ? `<div class="sub">${school.ville}</div>` : ''}
</div>

<div class="rapport-title">📋 ${titre}</div>

<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:15px;">
  <span>N° ${rapportNum}</span>
  <span>Imprimé le ${new Date().toLocaleString('fr-FR')}</span>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="val">${stats.total}</div><div class="lbl">Total pointages</div></div>
  <div class="kpi"><div class="val">${stats.presents}</div><div class="lbl">Présents</div></div>
  <div class="kpi"><div class="val" style="color:#f59e0b;">${stats.departs}</div><div class="lbl">Départs</div></div>
  <div class="kpi"><div class="val" style="color:#ef4444;">${stats.retards}</div><div class="lbl">Retards</div></div>
</div>

${tableContent}

<div class="signatures">
  <div class="sig-box">Responsable Pointage<br/><br/><br/>Signature</div>
  <div class="sig-box">Direction<br/><br/><br/>Signature & Cachet</div>
</div>

<div class="footer">
  Rapport généré le ${new Date().toLocaleString('fr-FR')} — ${school.nom}<br/>
  Document strictement interne — Ne pas diffuser
</div>

</body></html>`;

  w.document.write(html);
  w.document.close();
}
