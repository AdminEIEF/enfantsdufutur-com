/**
 * Generate a printable A4 receipt for advance payment (avance sur salaire)
 * Two identical A5 halves on one A4 page: PARTIE EMPLOYÉ & PARTIE TRÉSORERIE
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
  const w = window.open('', '_blank', 'width=800,height=1100');
  if (!w) return;

  const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  const halfHTML = (title: string) => `
    <div style="height:48%;box-sizing:border-box;border:2px solid #1e3a5f;border-radius:10px;padding:18px 22px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a5f;padding-bottom:10px;margin-bottom:12px;">
          <div>
            ${data.logoUrl ? `<img src="${data.logoUrl}" style="height:40px;margin-bottom:2px;" />` : ''}
            <div style="font-weight:700;font-size:14px;color:#1e3a5f;">${data.schoolName || 'Ecole'}</div>
            ${data.schoolCity ? `<div style="font-size:10px;color:#666;">${data.schoolCity}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:16px;font-weight:800;color:#f59e0b;">💰 REÇU D'AVANCE</div>
            <div style="font-size:9px;color:#888;font-weight:600;">${title}</div>
            <div style="font-size:10px;color:#666;">Date: ${data.date}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px;">
          <tr><td style="padding:4px 6px;font-weight:600;color:#555;width:30%;">Employé</td><td style="padding:4px 6px;font-weight:700;">${data.employe.prenom} ${data.employe.nom}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:4px 6px;font-weight:600;color:#555;">Matricule</td><td style="padding:4px 6px;font-family:monospace;">${data.employe.matricule}</td></tr>
          <tr><td style="padding:4px 6px;font-weight:600;color:#555;">Poste</td><td style="padding:4px 6px;">${data.employe.poste}</td></tr>
        </table>
        <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#92400e;font-weight:600;">MONTANT DE L'AVANCE</div>
          <div style="font-size:24px;font-weight:900;color:#d97706;">${fmtNum(data.montant)} GNF</div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-top:10px;">
          <div style="text-align:center;flex:1;">
            <div style="font-size:9px;color:#888;margin-bottom:2px;">Signature de l'employé</div>
            ${data.signatureEmploye ? `<img src="${data.signatureEmploye}" style="max-height:50px;max-width:160px;" />` : '<div style="border-bottom:1px dashed #ccc;width:160px;margin:16px auto 0;"></div>'}
          </div>
          <div style="text-align:center;flex:1;">
            <div style="font-size:9px;color:#888;margin-bottom:2px;">Cachet / Signature Trésorier</div>
            <div style="border-bottom:1px dashed #ccc;width:160px;margin:16px auto 0;"></div>
          </div>
        </div>
        <div style="text-align:center;margin-top:8px;font-size:8px;color:#999;">
          Ce montant sera déduit du prochain bulletin de paie.
        </div>
      </div>
    </div>
  `;

  w.document.write(`<!DOCTYPE html><html><head><title>Reçu Avance - ${data.employe.prenom} ${data.employe.nom}</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      @media print { body { margin: 0; } }
      html, body { height: 100%; margin: 0; }
    </style></head>
    <body style="font-family:'Segoe UI',sans-serif;padding:10mm;color:#333;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
      ${halfHTML('PARTIE EMPLOYÉ')}
      <div style="border-top:1px dashed #ccc;margin:0;"></div>
      ${halfHTML('PARTIE TRÉSORERIE')}
      <script>setTimeout(()=>window.print(),300);<\/script>
    </body></html>`);
  w.document.close();
}
