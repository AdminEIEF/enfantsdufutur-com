/**
 * Generate a printable receipt for advance payment (avance sur salaire)
 */
export function generateRecuAvancePDF(data: {
  employe: { nom: string; prenom: string; matricule: string; poste: string };
  montant: number;
  motif?: string | null;
  date: string;
  signatureEmploye?: string;
  schoolName?: string;
  schoolCity?: string;
  logoUrl?: string | null;
}) {
  const w = window.open('', '_blank', 'width=800,height=600');
  if (!w) return;

  const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  const halfHTML = (title: string) => `
    <div style="border:2px solid #1e3a5f;border-radius:12px;padding:24px;margin-bottom:20px;page-break-inside:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;">
        <div>
          ${data.logoUrl ? `<img src="${data.logoUrl}" style="height:50px;margin-bottom:4px;" />` : ''}
          <div style="font-weight:700;font-size:16px;color:#1e3a5f;">${data.schoolName || 'Ecole'}</div>
          ${data.schoolCity ? `<div style="font-size:11px;color:#666;">${data.schoolCity}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:800;color:#f59e0b;">💰 REÇU D'AVANCE</div>
          <div style="font-size:10px;color:#888;">${title}</div>
          <div style="font-size:11px;color:#666;">Date: ${data.date}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:6px 8px;font-weight:600;color:#555;width:35%;">Employé</td><td style="padding:6px 8px;font-weight:700;">${data.employe.prenom} ${data.employe.nom}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;font-weight:600;color:#555;">Matricule</td><td style="padding:6px 8px;font-family:monospace;">${data.employe.matricule}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:600;color:#555;">Poste</td><td style="padding:6px 8px;">${data.employe.poste}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;font-weight:600;color:#555;">Motif</td><td style="padding:6px 8px;">${data.motif || '—'}</td></tr>
      </table>
      <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px;">
        <div style="font-size:12px;color:#92400e;font-weight:600;">MONTANT DE L'AVANCE</div>
        <div style="font-size:28px;font-weight:900;color:#d97706;">${fmtNum(data.montant)} GNF</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:16px;">
        <div style="text-align:center;flex:1;">
          <div style="font-size:10px;color:#888;margin-bottom:4px;">Signature de l'employé</div>
          ${data.signatureEmploye ? `<img src="${data.signatureEmploye}" style="max-height:60px;max-width:180px;" />` : '<div style="border-bottom:1px dashed #ccc;width:180px;margin:20px auto 0;"></div>'}
        </div>
        <div style="text-align:center;flex:1;">
          <div style="font-size:10px;color:#888;margin-bottom:4px;">Cachet / Signature Trésorier</div>
          <div style="border-bottom:1px dashed #ccc;width:180px;margin:20px auto 0;"></div>
        </div>
      </div>
      <div style="text-align:center;margin-top:12px;font-size:9px;color:#999;">
        Ce montant sera déduit du prochain bulletin de paie.
      </div>
    </div>
  `;

  w.document.write(`<!DOCTYPE html><html><head><title>Reçu Avance - ${data.employe.prenom} ${data.employe.nom}</title>
    <style>@media print{body{margin:0;}}</style></head><body style="font-family:'Segoe UI',sans-serif;padding:20px;color:#333;">
    ${halfHTML('PARTIE EMPLOYÉ')}
    ${halfHTML('PARTIE TRÉSORERIE')}
    <script>setTimeout(()=>window.print(),300);<\/script></body></html>`);
  w.document.close();
}
