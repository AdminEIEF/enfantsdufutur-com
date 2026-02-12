/**
 * Generate a printable "Badge de Retrait" for Crèche/Maternelle students
 * Shows child photo + 3 authorized persons with photos + QR code
 */
export function generateBadgeRetrait(params: {
  eleve: {
    nom: string;
    prenom: string;
    matricule: string;
    classe: string;
    cycle: string;
    photo_url?: string | null;
  };
  mandataires: Array<{
    nom: string;
    prenom: string;
    lien_parente: string;
    photo_url?: string | null;
  }>;
  qrValue: string;
}) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;

  const { eleve, mandataires, qrValue } = params;

  const mandataireCards = mandataires.map(m => `
    <div class="person">
      <div class="person-photo">
        ${m.photo_url ? `<img src="${m.photo_url}" alt="${m.prenom} ${m.nom}" />` : '<div class="no-photo">👤</div>'}
      </div>
      <p class="person-name">${m.prenom} ${m.nom}</p>
      <p class="person-role">${m.lien_parente}</p>
    </div>
  `).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8" />
    <title>Badge de Retrait — ${eleve.prenom} ${eleve.nom}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
      .badge-container { display: flex; gap: 4px; }
      
      /* RECTO */
      .badge-front, .badge-back {
        width: 340px; border: 2px solid #1e3a5f; border-radius: 14px; background: white;
        overflow: hidden; page-break-inside: avoid;
      }
      .badge-header {
        background: linear-gradient(135deg, #1e3a5f, #2d5f8a);
        color: white; padding: 12px 16px; text-align: center;
      }
      .badge-header h2 { font-size: 14px; letter-spacing: 1px; text-transform: uppercase; }
      .badge-header .sub { font-size: 11px; opacity: 0.8; margin-top: 2px; }
      
      .child-section { text-align: center; padding: 20px 16px 12px; }
      .child-photo { width: 90px; height: 90px; border-radius: 50%; border: 3px solid #1e3a5f; margin: 0 auto 10px; overflow: hidden; background: #eee; display: flex; align-items: center; justify-content: center; }
      .child-photo img { width: 100%; height: 100%; object-fit: cover; }
      .child-photo .no-photo { font-size: 36px; }
      .child-name { font-size: 18px; font-weight: bold; color: #1e3a5f; }
      .child-info { font-size: 12px; color: #666; margin-top: 4px; }
      .child-matricule { font-family: monospace; font-size: 13px; color: #333; margin-top: 6px; background: #f0f0f0; display: inline-block; padding: 2px 10px; border-radius: 4px; }
      
      .qr-section { text-align: center; padding: 12px; border-top: 1px dashed #ddd; }
      .qr-section canvas { margin: 0 auto; }
      .qr-label { font-size: 9px; color: #999; margin-top: 4px; }
      
      /* VERSO */
      .back-header {
        background: #e65100; color: white; padding: 10px 16px; text-align: center;
      }
      .back-header h3 { font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; }
      .back-header p { font-size: 10px; opacity: 0.85; }
      
      .persons { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .person { display: flex; align-items: center; gap: 12px; border: 1px solid #eee; border-radius: 10px; padding: 10px; background: #fafafa; }
      .person-photo { width: 52px; height: 52px; border-radius: 50%; border: 2px solid #e65100; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
      .person-photo img { width: 100%; height: 100%; object-fit: cover; }
      .person-photo .no-photo { font-size: 22px; }
      .person-name { font-size: 14px; font-weight: 600; color: #333; }
      .person-role { font-size: 11px; color: #e65100; font-weight: 500; }
      
      .back-footer { text-align: center; padding: 8px; border-top: 1px dashed #ddd; }
      .back-footer p { font-size: 9px; color: #999; }
      
      @media print {
        body { background: white; }
        .badge-container { gap: 20px; }
      }
    </style>
  </head><body>
    <div class="badge-container">
      <!-- RECTO -->
      <div class="badge-front">
        <div class="badge-header">
          <h2>🎓 EduGestion Pro</h2>
          <p class="sub">${eleve.cycle} — ${eleve.classe}</p>
        </div>
        <div class="child-section">
          <div class="child-photo">
            ${eleve.photo_url ? `<img src="${eleve.photo_url}" alt="${eleve.prenom}" />` : '<div class="no-photo">👶</div>'}
          </div>
          <p class="child-name">${eleve.prenom} ${eleve.nom}</p>
          <p class="child-info">${eleve.cycle} — ${eleve.classe}</p>
          <p class="child-matricule">${eleve.matricule || '—'}</p>
        </div>
        <div class="qr-section">
          <canvas id="qr"></canvas>
          <p class="qr-label">Scanner pour vérification</p>
        </div>
      </div>
      
      <!-- VERSO -->
      <div class="badge-back">
        <div class="back-header">
          <h3>⚠️ Personnes autorisées</h3>
          <p>Seules ces personnes peuvent récupérer l'enfant</p>
        </div>
        <div class="persons">
          ${mandataireCards}
        </div>
        <div class="back-footer">
          <p>En cas de doute, contactez immédiatement l'administration</p>
          <p>Badge généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    <script>
      QRCode.toCanvas(document.getElementById('qr'), ${JSON.stringify(qrValue)}, { width: 120 }, function() {
        setTimeout(() => window.print(), 500);
      });
    <\/script>
  </body></html>`;

  w.document.write(html);
  w.document.close();
}
