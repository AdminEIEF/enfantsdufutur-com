import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Lightbulb, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  notes: any[];
  periodes: any[];
  bareme: number;
  eleve: any;
  schoolConfig?: any;
  famille?: any;
}

function computeRadar(notes: any[], bareme: number) {
  const poleMap: Record<string, { total: number; coefTotal: number }> = {};
  for (const n of notes) {
    if (n.note == null || !n.matieres?.pole) continue;
    const pole = n.matieres.pole;
    const coef = Number(n.matieres.coefficient) || 1;
    if (!poleMap[pole]) poleMap[pole] = { total: 0, coefTotal: 0 };
    poleMap[pole].total += Number(n.note) * coef;
    poleMap[pole].coefTotal += coef;
  }
  return Object.keys(poleMap).sort().map(pole => ({
    pole,
    moyenne: poleMap[pole].coefTotal > 0 ? poleMap[pole].total / poleMap[pole].coefTotal : 0,
    fullMark: bareme,
  }));
}

function computeMatiereByPeriode(notes: any[], periodes: any[]) {
  const map: Record<string, Record<string, { total: number; count: number }>> = {};
  const matiereInfo: Record<string, { nom: string; pole: string; coef: number }> = {};
  for (const n of notes) {
    if (n.note == null) continue;
    const mid = n.matiere_id;
    const pid = n.periode_id;
    if (!matiereInfo[mid]) matiereInfo[mid] = { nom: n.matieres?.nom || '?', pole: n.matieres?.pole || '—', coef: Number(n.matieres?.coefficient) || 1 };
    if (!map[mid]) map[mid] = {};
    if (!map[mid][pid]) map[mid][pid] = { total: 0, count: 0 };
    map[mid][pid].total += Number(n.note);
    map[mid][pid].count += 1;
  }
  return Object.entries(map).map(([mid, pidMap]) => ({
    id: mid,
    ...matiereInfo[mid],
    periodes: Object.entries(pidMap).reduce((acc, [pid, v]) => {
      acc[pid] = v.count > 0 ? v.total / v.count : null;
      return acc;
    }, {} as Record<string, number | null>),
  })).sort((a, b) => a.nom.localeCompare(b.nom));
}

function computeAvgByPeriode(notes: any[], periodes: any[]) {
  const map: Record<string, { total: number; coef: number }> = {};
  for (const n of notes) {
    if (n.note == null) continue;
    const pid = n.periode_id;
    const coef = Number(n.matieres?.coefficient) || 1;
    if (!map[pid]) map[pid] = { total: 0, coef: 0 };
    map[pid].total += Number(n.note) * coef;
    map[pid].coef += coef;
  }
  return periodes.map((p: any) => ({
    periode: p.nom,
    id: p.id,
    ordre: p.ordre,
    est_rattrapage: p.est_rattrapage,
    moyenne: map[p.id] ? map[p.id].total / map[p.id].coef : null,
  }));
}

function getOrientationRemarks(radarData: { pole: string; moyenne: number; fullMark: number }[], bareme: number) {
  if (radarData.length === 0) return null;

  const seuil = bareme / 2;
  const sorted = [...radarData].sort((a, b) => b.moyenne - a.moyenne);
  const best = sorted[0];
  const bestPct = (best.moyenne / bareme) * 100;
  const weakest = sorted[sorted.length - 1];

  // Classify poles into categories
  const scientificPoles = ['Sciences', 'Mathématiques', 'Math', 'Physique', 'Chimie', 'SVT', 'Informatique', 'Technologie'];
  const literaryPoles = ['Français', 'Littérature', 'Langues', 'Histoire', 'Géographie', 'Philosophie', 'Hist-Géo', 'Anglais', 'Arabe'];
  const experimentalPoles = ['Arts', 'Éducation Physique', 'Sport', 'Musique', 'Dessin', 'Robotique', 'Expérimental'];

  const strongPoles = sorted.filter(r => r.moyenne >= seuil);
  
  const isScientific = strongPoles.some(p => scientificPoles.some(sp => p.pole.toLowerCase().includes(sp.toLowerCase())));
  const isLiterary = strongPoles.some(p => literaryPoles.some(lp => p.pole.toLowerCase().includes(lp.toLowerCase())));
  const isExperimental = strongPoles.some(p => experimentalPoles.some(ep => p.pole.toLowerCase().includes(ep.toLowerCase())));

  const remarks: { type: 'success' | 'info' | 'warning'; text: string }[] = [];

  // Main orientation
  if (bestPct >= 70) {
    if (isScientific && isLiterary) {
      remarks.push({ type: 'success', text: `🌟 Profil polyvalent : ${best.pole} est le point fort. L'élève excelle autant dans les matières scientifiques que littéraires. Filière d'excellence recommandée.` });
    } else if (isScientific) {
      remarks.push({ type: 'success', text: `🔬 Profil Scientifique : L'élève montre de solides aptitudes dans le pôle "${best.pole}" (${best.moyenne.toFixed(1)}/${bareme}). Orientation vers une filière scientifique ou expérimentale recommandée.` });
    } else if (isLiterary) {
      remarks.push({ type: 'success', text: `📚 Profil Littéraire : L'élève se distingue dans le pôle "${best.pole}" (${best.moyenne.toFixed(1)}/${bareme}). Orientation vers une filière littéraire recommandée.` });
    } else if (isExperimental) {
      remarks.push({ type: 'success', text: `🧪 Profil Expérimental : L'élève excelle dans le pôle "${best.pole}" (${best.moyenne.toFixed(1)}/${bareme}). Orientation vers une filière expérimentale ou technique recommandée.` });
    } else {
      remarks.push({ type: 'success', text: `⭐ Point fort : "${best.pole}" avec ${best.moyenne.toFixed(1)}/${bareme}. L'élève a un bon potentiel dans ce domaine.` });
    }
  } else if (bestPct >= 50) {
    remarks.push({ type: 'info', text: `📊 L'élève a un niveau correct, avec un meilleur potentiel dans le pôle "${best.pole}" (${best.moyenne.toFixed(1)}/${bareme}). Un renforcement dans ce domaine est conseillé.` });
  } else {
    remarks.push({ type: 'warning', text: `⚠️ L'ensemble des pôles nécessite un renforcement. Le meilleur résultat est dans "${best.pole}" avec ${best.moyenne.toFixed(1)}/${bareme}.` });
  }

  // Weakness note
  if (weakest.moyenne < seuil && radarData.length > 1) {
    remarks.push({ type: 'warning', text: `📉 Point à améliorer : "${weakest.pole}" (${weakest.moyenne.toFixed(1)}/${bareme}). Un soutien scolaire dans ce domaine serait bénéfique.` });
  }

  // Balance note
  if (radarData.length >= 3) {
    const moyennes = radarData.map(r => r.moyenne);
    const max = Math.max(...moyennes);
    const min = Math.min(...moyennes);
    const ecart = max - min;
    if (ecart <= bareme * 0.1) {
      remarks.push({ type: 'info', text: `⚖️ Profil équilibré : Les résultats sont homogènes entre les pôles. L'élève peut s'orienter selon ses préférences personnelles.` });
    }
  }

  return remarks;
}

export default function ParentEnfantProfilRadar({ notes, periodes, bareme, eleve, schoolConfig, famille }: Props) {
  const seuil = bareme / 2;
  const radarData = useMemo(() => computeRadar(notes, bareme), [notes, bareme]);
  const remarks = useMemo(() => getOrientationRemarks(radarData, bareme), [radarData, bareme]);
  const matiereByPeriode = useMemo(() => computeMatiereByPeriode(notes, periodes), [notes, periodes]);
  const periodeAverages = useMemo(() => computeAvgByPeriode(notes, periodes), [notes, periodes]);
  const regularPeriodes = periodes.filter((p: any) => !p.est_rattrapage);

  const moyenneGenerale = useMemo(() => {
    const regular = periodeAverages.filter(p => !p.est_rattrapage && p.moyenne !== null);
    if (regular.length === 0) return null;
    return regular.reduce((s, p) => s + (p.moyenne || 0), 0) / regular.length;
  }, [periodeAverages]);

  const handleDownloadLivret = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const classInfo = eleve.classes ? `${eleve.classes.niveaux?.cycles?.nom || ''} — ${eleve.classes.niveaux?.nom || ''} — ${eleve.classes.nom || ''}` : '—';

    const radarBarsHtml = radarData.map(r => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="width:90px;font-weight:600;font-size:10px;text-align:right;">${r.pole}</span>
        <div style="flex:1;height:16px;background:#e5e7eb;border-radius:8px;overflow:hidden;">
          <div style="height:100%;width:${(r.moyenne / bareme) * 100}%;border-radius:8px;background:${r.moyenne >= seuil ? '#22c55e' : '#ef4444'};"></div>
        </div>
        <span style="width:55px;font-weight:700;font-size:10px;color:${r.moyenne >= seuil ? '#16a34a' : '#dc2626'}">${r.moyenne.toFixed(2)}/${bareme}</span>
      </div>
    `).join('');

    const remarksHtml = (remarks || []).map(r => `
      <div style="padding:8px 12px;border-radius:6px;margin-bottom:6px;font-size:11px;background:${r.type === 'success' ? '#dcfce7' : r.type === 'warning' ? '#fef3c7' : '#dbeafe'};border-left:4px solid ${r.type === 'success' ? '#16a34a' : r.type === 'warning' ? '#f59e0b' : '#3b82f6'};">
        ${r.text}
      </div>
    `).join('');

    const notesRowsHtml = matiereByPeriode.map(m => {
      const vals = regularPeriodes.map((p: any) => m.periodes[p.id]).filter((v): v is number => v !== null && v !== undefined);
      const moyAnnee = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return `<tr>
        <td style="border:1px solid #bbb;padding:5px 8px;text-align:left;font-weight:600;">${m.nom}</td>
        <td style="border:1px solid #bbb;padding:5px 8px;text-align:center;font-size:10px;">${m.pole}</td>
        <td style="border:1px solid #bbb;padding:5px 8px;text-align:center;">${m.coef}</td>
        ${regularPeriodes.map((p: any) => {
          const v = m.periodes[p.id];
          return `<td style="border:1px solid #bbb;padding:5px 8px;text-align:center;font-weight:700;color:${v != null ? (v >= seuil ? '#16a34a' : '#dc2626') : '#888'}">${v != null ? v.toFixed(2) : '—'}</td>`;
        }).join('')}
        <td style="border:1px solid #bbb;padding:5px 8px;text-align:center;font-weight:700;background:#f0f7ff;color:${moyAnnee != null ? (moyAnnee >= seuil ? '#16a34a' : '#dc2626') : '#888'}">${moyAnnee != null ? moyAnnee.toFixed(2) : '—'}</td>
      </tr>`;
    }).join('');

    printWindow.document.write(`
      <html><head><title>Livret Scolaire - ${eleve.prenom} ${eleve.nom}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; padding:20px; color:#1a1a1a; font-size:11px; }
        @media print { @page { size:A4; margin:15mm; } }
        table { width:100%; border-collapse:collapse; margin-bottom:16px; }
        th { border:1px solid #bbb; padding:5px 8px; background:#2563eb; color:white; font-size:10px; text-transform:uppercase; }
      </style></head><body>
      <div style="text-align:center;border-bottom:3px double #1a1a1a;padding-bottom:12px;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">RÉPUBLIQUE DE GUINÉE</div>
        <div style="font-size:10px;font-style:italic;color:#555;margin-top:2px;">Travail - Justice - Solidarité</div>
        <div style="margin:8px auto;border-top:1px solid #ccc;width:40%;"></div>
        <h1 style="font-size:16px;margin:4px 0;">${schoolConfig?.nom || 'Établissement Scolaire'}</h1>
        <div style="font-size:11px;color:#555;">${schoolConfig?.soustitre || ''} — ${schoolConfig?.ville || ''}</div>
        <h3 style="font-size:18px;margin-top:10px;text-transform:uppercase;letter-spacing:1px;">LIVRET SCOLAIRE</h3>
        <div style="font-size:9px;color:#888;margin-top:4px;">Document de suivi du parcours scolaire — De la 1ère Année au Baccalauréat</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:16px;padding:10px;border:1px solid #ddd;border-radius:6px;background:#fafafa;">
        <div><b style="color:#555;">Nom : </b>${eleve.nom}</div>
        <div><b style="color:#555;">Prénom : </b>${eleve.prenom}</div>
        <div><b style="color:#555;">Matricule : </b>${eleve.matricule || '—'}</div>
        <div><b style="color:#555;">Classe : </b>${classInfo}</div>
        <div><b style="color:#555;">Date de naissance : </b>${eleve.date_naissance ? new Date(eleve.date_naissance).toLocaleDateString('fr-FR') : '—'}</div>
        <div><b style="color:#555;">Sexe : </b>${eleve.sexe || '—'}</div>
      </div>

      <div style="font-size:13px;font-weight:700;margin:14px 0 6px;padding:4px 8px;background:#fef3c7;border-left:4px solid #f59e0b;">
        Renseignements du Parent / Tuteur
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:10px;padding:10px;border:1px solid #ddd;border-radius:6px;background:#fafafa;">
        <div><b style="color:#555;">Nom & Prénom du Père : </b>${eleve.nom_prenom_pere || famille?.nom_famille || '—'}</div>
        <div><b style="color:#555;">Nom & Prénom de la Mère : </b>${eleve.nom_prenom_mere || '—'}</div>
        <div><b style="color:#555;">Profession : </b>..........................................</div>
        <div><b style="color:#555;">Lien avec le tuteur : </b>..........................................</div>
        <div><b style="color:#555;">Téléphone Père : </b>${famille?.telephone_pere || '—'}</div>
        <div><b style="color:#555;">Téléphone Mère : </b>${famille?.telephone_mere || '—'}</div>
        <div><b style="color:#555;">Adresse / Domicile : </b>${famille?.adresse || '—'}</div>
        <div><b style="color:#555;">Lieu de travail : </b>..........................................</div>
        <div><b style="color:#555;">Email : </b>${famille?.email_parent || '—'}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10px;">
        <thead>
          <tr><th colspan="3" style="border:1px solid #bbb;padding:4px 8px;background:#e5edff;font-weight:700;font-size:11px;">Changement d'adresse</th></tr>
          <tr>
            <th style="border:1px solid #bbb;padding:4px 8px;background:#f0f0f0;font-weight:600;width:33%;">Date</th>
            <th style="border:1px solid #bbb;padding:4px 8px;background:#f0f0f0;font-weight:600;width:33%;">Domicile / Ville</th>
            <th style="border:1px solid #bbb;padding:4px 8px;background:#f0f0f0;font-weight:600;width:34%;">École</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td></tr>
          <tr><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td></tr>
          <tr><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td><td style="border:1px solid #bbb;padding:6px 8px;height:24px;">&nbsp;</td></tr>
        </tbody>
      </table>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:16px;padding:10px;border:1px solid #ddd;border-radius:6px;background:#fafafa;font-size:11px;">
        <div style="font-weight:600;color:#555;">Situation familiale :</div><div>&nbsp;</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:14px;height:14px;border:1.5px solid #555;border-radius:2px;"></span> Parents séparés</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:14px;height:14px;border:1.5px solid #555;border-radius:2px;"></span> Orphelin de père</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:14px;height:14px;border:1.5px solid #555;border-radius:2px;"></span> Orphelin de mère</div>
        <div>&nbsp;</div>
        <div><b style="color:#555;">Date de 1ère rentrée scolaire : </b>..........................................</div>
        <div><b style="color:#555;">Venant de l'école : </b>..........................................</div>
      </div>
      <div style="font-size:13px;font-weight:700;margin:14px 0 6px;padding:4px 8px;background:#e5edff;border-left:4px solid #2563eb;">Notes par matière et par période (/${bareme})</div>
      <table>
        <thead><tr>
          <th style="text-align:left;">Matière</th><th>Pôle</th><th>Coef</th>
          ${regularPeriodes.map((p: any) => `<th>${p.nom}</th>`).join('')}
          <th style="background:#1d4ed8;">Moy. Année</th>
        </tr></thead>
        <tbody>
          ${notesRowsHtml}
          <tr style="background:#f0f7ff;font-weight:700;">
            <td colspan="3" style="border:1px solid #bbb;padding:5px 8px;text-align:right;">MOYENNE GÉNÉRALE</td>
            ${regularPeriodes.map((p: any) => {
              const avg = periodeAverages.find(pa => pa.id === p.id);
              return `<td style="border:1px solid #bbb;padding:5px 8px;text-align:center;font-weight:700;color:${avg?.moyenne != null ? (avg.moyenne >= seuil ? '#16a34a' : '#dc2626') : '#888'}">${avg?.moyenne != null ? avg.moyenne.toFixed(2) : '—'}</td>`;
            }).join('')}
            <td style="border:1px solid #bbb;padding:5px 8px;text-align:center;font-weight:700;font-size:13px;color:${moyenneGenerale != null ? (moyenneGenerale >= seuil ? '#16a34a' : '#dc2626') : '#888'}">${moyenneGenerale != null ? `${moyenneGenerale.toFixed(2)}/${bareme}` : '—'}</td>
          </tr>
        </tbody>
      </table>
      <div style="font-size:13px;font-weight:700;margin:14px 0 6px;padding:4px 8px;background:#e5edff;border-left:4px solid #2563eb;">Profil d'orientation par pôle</div>
      ${radarBarsHtml}
      <div style="font-size:13px;font-weight:700;margin:14px 0 6px;padding:4px 8px;background:#fef3c7;border-left:4px solid #f59e0b;">Remarques d'orientation</div>
      ${remarksHtml}
      <div style="text-align:center;margin-top:12px;">
        <div style="font-size:12px;font-weight:600;margin-bottom:4px;">Décision finale :</div>
        ${moyenneGenerale != null ? `<span style="display:inline-block;padding:4px 14px;border-radius:4px;font-weight:700;font-size:13px;background:${moyenneGenerale >= seuil ? '#dcfce7' : '#fef2f2'};color:${moyenneGenerale >= seuil ? '#16a34a' : '#dc2626'};border:1px solid ${moyenneGenerale >= seuil ? '#16a34a' : '#dc2626'}">${moyenneGenerale >= (bareme * 0.75) ? '🏆 Admis(e) avec Honneur' : moyenneGenerale >= seuil ? '✅ Admis(e)' : '⚠️ Doit redoubler'}</span>` : '<span style="color:#888;">—</span>'}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:30px;font-size:11px;">
        <div style="text-align:center;"><div style="font-weight:600;margin-bottom:30px;">L'Enseignant(e)</div><div style="border-top:1px solid #aaa;padding-top:4px;">Signature</div></div>
        <div style="text-align:center;"><div style="font-weight:600;margin-bottom:30px;">Le Parent / Tuteur</div><div style="border-top:1px solid #aaa;padding-top:4px;">Signature</div></div>
        <div style="text-align:center;"><div style="font-weight:600;margin-bottom:30px;">Le Directeur</div><div style="border-top:1px solid #aaa;padding-top:4px;">Signature & Cachet</div></div>
      </div>
      <div style="margin-top:20px;text-align:center;font-size:9px;color:#888;border-top:1px solid #ddd;padding-top:8px;">
        ${schoolConfig?.nom || ''} — ${schoolConfig?.ville || ''} — Année scolaire ${new Date().getFullYear() - 1}/${new Date().getFullYear()}
      </div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Aucune note disponible pour le moment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Download button */}
      <div className="flex justify-end">
        <Button onClick={handleDownloadLivret} size="sm" className="gap-2">
          <Download className="h-4 w-4" /> Télécharger le Livret Scolaire
        </Button>
      </div>

      {/* Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Profil par pôle (barème /{bareme})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="pole" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, bareme]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                <Radar name="Moyenne" dataKey="moyenne" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                  formatter={(value: number) => [`${value.toFixed(2)}/${bareme}`, 'Moyenne']}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">Aucune donnée de pôle disponible</p>
          )}
        </CardContent>
      </Card>

      {/* Progress bars */}
      {radarData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Détail par pôle</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {radarData.map((r, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{r.pole}</span>
                  <span className={`font-bold ${r.moyenne >= seuil ? 'text-green-600' : 'text-destructive'}`}>
                    {r.moyenne.toFixed(2)}/{bareme}
                  </span>
                </div>
                <Progress value={(r.moyenne / bareme) * 100} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Orientation Remarks */}
      {remarks && remarks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Remarques d'orientation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {remarks.map((r, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg text-sm border-l-4 ${
                  r.type === 'success'
                    ? 'bg-green-50 border-green-500 text-green-800'
                    : r.type === 'warning'
                    ? 'bg-amber-50 border-amber-500 text-amber-800'
                    : 'bg-blue-50 border-blue-500 text-blue-800'
                }`}
              >
                {r.text}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { getOrientationRemarks, computeRadar };
