/**
 * Génère un rapport PDF imprimable pour un élève sur une composition donnée.
 * Affiche : entête école, infos élève, infos composition, score, classement,
 * et liste des questions avec ses réponses (si disponibles).
 */
export function generateRapportEleveCompositionPDF(data: {
  eleve: { nom: string; prenom: string; matricule?: string | null; classe?: string | null };
  composition: { titre: string; matiere?: string | null; bareme: number; date?: string | null; type?: string | null };
  score: number | null;
  rang?: number | null;
  totalEleves?: number | null;
  moyenneClasse?: number | null;
  soumisAt?: string | null;
  questions?: Array<{ enonce: string; reponseCorrecte?: string; reponseEleve?: string; points?: number; obtenu?: number; correct?: boolean }>;
  reponseTexte?: string | null;
  schoolConfig?: { nom: string; soustitre?: string; logo_url?: string | null };
}) {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) return;

  const schoolName = data.schoolConfig?.nom || 'Ecole';
  const schoolLogo = data.schoolConfig?.logo_url || null;
  const schoolSoustitre = data.schoolConfig?.soustitre || '';

  const score = data.score;
  const bareme = data.composition.bareme || 20;
  const pct = score != null ? Math.round((score / bareme) * 100) : 0;
  const mention = score == null ? '—' :
    pct >= 80 ? 'Très Bien' :
    pct >= 70 ? 'Bien' :
    pct >= 60 ? 'Assez Bien' :
    pct >= 50 ? 'Passable' : 'Insuffisant';
  const mentionColor = pct >= 70 ? '#16a34a' : pct >= 50 ? '#f97316' : '#dc2626';

  const questionsHtml = (data.questions || []).map((q, i) => {
    const isCorrect = q.correct;
    const bg = isCorrect === true ? '#f0fdf4' : isCorrect === false ? '#fef2f2' : '#f9fafb';
    const border = isCorrect === true ? '#16a34a' : isCorrect === false ? '#dc2626' : '#d1d5db';
    const icon = isCorrect === true ? '✓' : isCorrect === false ? '✗' : '•';
    return `
      <div class="question" style="background:${bg};border-left:4px solid ${border};">
        <div class="q-head">
          <span class="q-num">${icon} Question ${i + 1}</span>
          ${q.points != null ? `<span class="q-pts">${q.obtenu ?? 0}/${q.points} pt${q.points > 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="q-enonce">${q.enonce}</div>
        ${q.reponseEleve != null ? `<div class="q-row"><strong>Réponse de l'élève:</strong> ${q.reponseEleve || '<em>(vide)</em>'}</div>` : ''}
        ${q.reponseCorrecte != null ? `<div class="q-row"><strong>Réponse correcte:</strong> <span style="color:#16a34a;">${q.reponseCorrecte}</span></div>` : ''}
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Rapport - ${data.eleve.prenom} ${data.eleve.nom}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, sans-serif; }
  body { margin: 0; padding: 0; color: #1f2937; }
  .header { display:flex; align-items:center; gap:14px; border-bottom:3px solid #1e3a5f; padding-bottom:10px; margin-bottom:14px; }
  .header img { width:60px; height:60px; object-fit:contain; }
  .header h1 { margin:0; font-size:18px; color:#1e3a5f; }
  .header p { margin:2px 0; font-size:11px; color:#6b7280; }
  .title-bar { background:#1e3a5f; color:white; padding:10px 14px; border-radius:6px; margin-bottom:14px; }
  .title-bar h2 { margin:0; font-size:15px; }
  .title-bar p { margin:3px 0 0; font-size:11px; opacity:0.9; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
  .info-card { border:1px solid #e5e7eb; border-radius:6px; padding:10px; background:#f9fafb; }
  .info-card h3 { margin:0 0 6px; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px; }
  .info-card .row { display:flex; justify-content:space-between; padding:3px 0; font-size:12px; border-bottom:1px dotted #e5e7eb; }
  .info-card .row:last-child { border-bottom:none; }
  .info-card .row strong { color:#1f2937; }
  .score-banner { background:linear-gradient(135deg,${mentionColor}22,${mentionColor}11); border:2px solid ${mentionColor}; border-radius:8px; padding:14px; text-align:center; margin-bottom:14px; }
  .score-banner .big { font-size:36px; font-weight:bold; color:${mentionColor}; line-height:1; }
  .score-banner .lbl { font-size:11px; color:#6b7280; margin-top:4px; }
  .score-banner .mention { display:inline-block; margin-top:8px; background:${mentionColor}; color:white; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }
  .stats-row { display:flex; justify-content:space-around; margin-top:10px; padding-top:10px; border-top:1px dashed ${mentionColor}55; }
  .stats-row div { text-align:center; }
  .stats-row .v { font-size:14px; font-weight:bold; color:#1f2937; }
  .stats-row .l { font-size:10px; color:#6b7280; }
  .section-title { font-size:13px; font-weight:bold; color:#1e3a5f; margin:14px 0 8px; padding-bottom:4px; border-bottom:2px solid #e5e7eb; }
  .question { padding:10px; margin-bottom:8px; border-radius:6px; font-size:12px; }
  .q-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; }
  .q-num { font-weight:bold; }
  .q-pts { background:white; padding:2px 8px; border-radius:10px; font-size:11px; border:1px solid #d1d5db; }
  .q-enonce { margin:6px 0; color:#374151; }
  .q-row { font-size:11px; margin:3px 0; color:#4b5563; }
  .reponse-texte { background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:12px; font-size:12px; white-space:pre-wrap; }
  .footer { margin-top:20px; padding-top:10px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:10px; color:#9ca3af; }
  .signature { margin-top:30px; display:flex; justify-content:space-around; }
  .signature div { text-align:center; width:30%; border-top:1px solid #6b7280; padding-top:6px; font-size:11px; }
  @media print { .no-print { display:none; } }
</style></head>
<body>
  <div class="header">
    ${schoolLogo ? `<img src="${schoolLogo}" alt="Logo" />` : ''}
    <div>
      <h1>${schoolName}</h1>
      ${schoolSoustitre ? `<p>${schoolSoustitre}</p>` : ''}
      <p>📋 Rapport individuel de composition</p>
    </div>
  </div>

  <div class="title-bar">
    <h2>${data.composition.titre}</h2>
    <p>📚 ${data.composition.matiere || '—'} ${data.composition.type ? '· ' + data.composition.type : ''} ${data.composition.date ? '· 📅 ' + data.composition.date : ''}</p>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <h3>👤 Élève</h3>
      <div class="row"><span>Nom et prénom</span><strong>${data.eleve.prenom} ${data.eleve.nom}</strong></div>
      <div class="row"><span>Matricule</span><strong>${data.eleve.matricule || '—'}</strong></div>
      <div class="row"><span>Classe</span><strong>${data.eleve.classe || '—'}</strong></div>
    </div>
    <div class="info-card">
      <h3>📝 Composition</h3>
      <div class="row"><span>Barème</span><strong>/${bareme}</strong></div>
      <div class="row"><span>Soumis le</span><strong>${data.soumisAt || 'En cours'}</strong></div>
      ${data.rang != null ? `<div class="row"><span>Rang</span><strong>${data.rang}${data.totalEleves ? ' / ' + data.totalEleves : ''}</strong></div>` : ''}
    </div>
  </div>

  <div class="score-banner">
    <div class="big">${score != null ? score + '/' + bareme : 'Non noté'}</div>
    <div class="lbl">Note obtenue (${pct}%)</div>
    ${score != null ? `<div class="mention">${mention}</div>` : ''}
    <div class="stats-row">
      <div><div class="v">${pct}%</div><div class="l">Pourcentage</div></div>
      ${data.moyenneClasse != null ? `<div><div class="v">${data.moyenneClasse.toFixed(1)}</div><div class="l">Moy. classe</div></div>` : ''}
      ${data.rang != null ? `<div><div class="v">#${data.rang}</div><div class="l">Classement</div></div>` : ''}
    </div>
  </div>

  ${questionsHtml ? `<div class="section-title">📋 Détail des réponses</div>${questionsHtml}` : ''}
  ${data.reponseTexte ? `<div class="section-title">✍️ Réponse rédigée</div><div class="reponse-texte">${data.reponseTexte}</div>` : ''}

  <div class="signature">
    <div>Signature Élève</div>
    <div>Signature Parent</div>
    <div>Cachet & Signature Direction</div>
  </div>

  <div class="footer">
    <span>Document généré le ${new Date().toLocaleString('fr-FR')}</span>
    <span>${schoolName}</span>
  </div>

  <div class="no-print" style="position:fixed;top:10px;right:10px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#1e3a5f;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">🖨️ Imprimer / PDF</button>
  </div>

  <script>setTimeout(() => window.print(), 500);</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}
