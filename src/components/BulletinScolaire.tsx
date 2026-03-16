import { CheckSquare, Square, MapPin, University } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface BulletinNote {
  matiere: string;
  pole: string | null;
  coefficient: number;
  note: number | null;
  rang: string | null;
  appreciation: string | null;
}

interface PreviousPeriodSummary {
  periodeName: string;
  moyenne: number | null;
  rang: number | null;
  effectif: number;
  mention: string | null;
}

interface PeriodNoteByMatiere {
  periodeName: string;
  notesByMatiere: Record<string, number | null>;
}

interface BulletinScolaireProps {
  eleve: {
    nom: string;
    prenom: string;
    matricule: string | null;
    sexe: string | null;
    date_naissance: string | null;
  };
  classe: string;
  effectif: number;
  periodeName: string;
  bulletinData: BulletinNote[];
  moyennePeriode: number | null;
  rang: number | null;
  plusForte: number | null;
  plusFaible: number | null;
  moyenneAnnuelle: number | null;
  moyenneClasse: number | null;
  bareme: number;
  seuil: number;
  previousPeriods: PreviousPeriodSummary[];
  cycleName?: string;
  anneeScolaire?: string;
  schoolName?: string;
  schoolSubtitle?: string;
  schoolCity?: string;
  schoolLogoUrl?: string | null;
  isFinalPeriod?: boolean;
  previousPeriodsNotes?: PeriodNoteByMatiere[];
  rangAnnuel?: number | null;
}

const getMention = (moyenne: number | null, bareme: number): string | null => {
  if (moyenne === null) return null;
  const ratio = moyenne / bareme;
  if (ratio >= 0.85) return 'Excellent';
  if (ratio >= 0.70) return 'Très Bien';
  if (ratio >= 0.60) return 'Bien';
  if (ratio >= 0.50) return 'Assez Bien';
  if (ratio >= 0.40) return 'Passable';
  return 'Insuffisant';
};

const cellCenter: React.CSSProperties = {
  padding: '3px 4px',
  textAlign: 'center',
  verticalAlign: 'middle',
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: '9.5px',
};

export default function BulletinScolaire({
  eleve,
  classe,
  effectif,
  periodeName,
  bulletinData,
  moyennePeriode,
  rang,
  plusForte = null,
  plusFaible = null,
  moyenneAnnuelle = null,
  moyenneClasse = null,
  bareme,
  seuil,
  previousPeriods,
  cycleName,
  anneeScolaire = '2025 - 2026',
  schoolName = 'Ecole Internationale Les Enfants du Futur',
  schoolSubtitle = 'Enseignement Général et Technique',
  schoolCity = 'Conakry, Guinée',
  schoolLogoUrl,
  isFinalPeriod = false,
  previousPeriodsNotes = [],
  rangAnnuel = null,
}: BulletinScolaireProps) {
  const isAdmis = moyennePeriode !== null && moyennePeriode >= seuil;
  const isRedouble = moyennePeriode !== null && !isAdmis;
  const totalCoef = bulletinData.reduce((s, b) => s + b.coefficient, 0);
  const mention = getMention(moyennePeriode, bareme);

  const chartData = (previousPeriods.length > 0
    ? previousPeriods.map(pp => ({ periode: pp.periodeName, moyenne: pp.moyenne }))
    : [{ periode: periodeName, moyenne: moyennePeriode }]
  ).filter(d => d.moyenne !== null);

  return (
    <div
      data-bulletin-a4
      style={{
        width: '210mm',
        maxHeight: '297mm',
        margin: '0 auto',
        padding: '5mm 7mm',
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontSize: '9.5px',
        lineHeight: '1.3',
        color: '#1a1a1a',
        backgroundColor: '#ffffff',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact' as any,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          [data-bulletin-a4] { width: 210mm !important; max-height: 297mm !important; padding: 5mm 7mm !important; }
          [data-bulletin-a4] * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        [data-bulletin-a4] table { border-collapse: collapse; width: 100%; table-layout: auto; }
        [data-bulletin-a4] th, [data-bulletin-a4] td { border: 1px solid #c9cdd3; vertical-align: middle; }
      `}</style>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2.5px solid #047857', paddingBottom: '5px', marginBottom: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {schoolLogoUrl ? (
            <img src={schoolLogoUrl} alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: '48px', height: '48px', backgroundColor: '#047857', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <University style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
          )}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#064e3b', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{schoolName}</div>
            <div style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '1px' }}>{schoolSubtitle}</div>
            <div style={{ fontSize: '7.5px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
              <MapPin style={{ width: '8px', height: '8px' }} /> {schoolCity}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#047857', letterSpacing: '0.05em' }}>{isFinalPeriod ? "BULLETIN DE NOTES DE FIN D'ANNÉE" : 'BULLETIN DE NOTES'}</div>
          <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', padding: '2px 12px', marginTop: '3px' }}>
            <div style={{ fontSize: '8.5px', color: '#047857', fontWeight: 600 }}>Année : {anneeScolaire} — {periodeName}</div>
          </div>
        </div>
      </div>

      {/* ── Infos Élève ── */}
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '5px', padding: '4px 10px', marginBottom: '4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 20px', fontSize: '9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#6b7280', fontWeight: 500, minWidth: '75px' }}>Nom & Prénom :</span>
            <strong>{eleve.prenom} {eleve.nom}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#6b7280', fontWeight: 500, minWidth: '60px' }}>Matricule :</span>
            <strong>{eleve.matricule || '—'}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#6b7280', fontWeight: 500, minWidth: '75px' }}>Classe :</span>
            <strong>{classe}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#6b7280', fontWeight: 500, minWidth: '60px' }}>Effectif :</span>
            <strong>{effectif}</strong>
          </div>
        </div>
      </div>

      {/* ── Tableau des notes ── */}
      <div style={{ marginBottom: '3px' }}>
        <table style={{ fontSize: '9px' }}>
          <thead>
            <tr style={{ backgroundColor: '#047857', color: 'white' }}>
              <th style={{ padding: '4px 4px', textAlign: 'left', fontWeight: 700, verticalAlign: 'middle', width: '90px', maxWidth: '90px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>Matière</th>
              <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, width: '28px', verticalAlign: 'middle' }}>Coef</th>
              {isFinalPeriod && previousPeriodsNotes.map((pp) => (
                <th key={pp.periodeName} style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, width: '38px', fontSize: '8px', verticalAlign: 'middle' }}>{pp.periodeName}</th>
              ))}
              <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, width: '50px', verticalAlign: 'middle' }}>Moyenne</th>
              <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, width: '54px', verticalAlign: 'middle' }}>Moy×Coef</th>
              {isFinalPeriod && (
                <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 700, width: '30px', verticalAlign: 'middle' }}>Rang</th>
              )}
              <th style={{ padding: '4px 4px', textAlign: 'center', fontWeight: 700, verticalAlign: 'middle' }}>Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {bulletinData.map((b, i) => {
              const isBelowAvg = b.note !== null && b.note < seuil;
              const total = b.note !== null ? b.note * b.coefficient : null;
              return (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', height: '20px' }}>
                  <td style={{ padding: '2px 4px', fontWeight: 500, verticalAlign: 'middle', fontSize: '8.5px', maxWidth: '90px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{b.matiere}</td>
                  <td style={{ ...cellCenter, color: '#6b7280', fontWeight: 600 }}>{b.coefficient}</td>
                  {isFinalPeriod && previousPeriodsNotes.map((pp) => {
                    const prevNote = pp.notesByMatiere[b.matiere] ?? null;
                    const prevBelowAvg = prevNote !== null && prevNote < seuil;
                    return (
                      <td key={pp.periodeName} style={{ ...cellCenter, fontSize: '8px', color: prevBelowAvg ? '#dc2626' : '#374151' }}>
                        {prevNote !== null ? prevNote.toFixed(2) : '—'}
                      </td>
                    );
                  })}
                  <td style={{ ...cellCenter, fontWeight: 700, color: isBelowAvg ? '#dc2626' : '#047857', backgroundColor: isBelowAvg ? '#fef2f2' : '#ecfdf5' }}>
                    {b.note !== null ? b.note.toFixed(2) : '—'}
                  </td>
                  <td style={{ ...cellCenter, fontWeight: 600 }}>
                    {total !== null ? total.toFixed(2) : '—'}
                  </td>
                  {isFinalPeriod && (
                    <td style={{ ...cellCenter }}>{b.rang || '—'}</td>
                  )}
                  <td style={{ padding: '2px 4px', textAlign: 'center', verticalAlign: 'middle', color: '#6b7280', fontStyle: 'italic', fontSize: '8.5px' }}>{b.appreciation || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#ecfdf5', fontWeight: 700, height: '22px' }}>
              <td style={{ padding: '3px 5px', verticalAlign: 'middle', fontSize: '9px' }}>TOTAL DES POINTS</td>
              <td style={{ ...cellCenter, fontWeight: 700 }}>{totalCoef}</td>
              {isFinalPeriod && previousPeriodsNotes.map((pp) => (
                <td key={pp.periodeName} style={{ ...cellCenter }}></td>
              ))}
              <td style={{ ...cellCenter, fontWeight: 800, fontSize: '9.5px', color: moyennePeriode !== null && moyennePeriode < seuil ? '#dc2626' : '#047857' }}>
                {(() => {
                  const sommeMoyennes = bulletinData.reduce((s, b) => s + (b.note !== null ? b.note : 0), 0);
                  const hasNotes = bulletinData.some(b => b.note !== null);
                  return hasNotes ? sommeMoyennes.toFixed(2) : '—';
                })()}
              </td>
              <td style={{ ...cellCenter, fontWeight: 700 }}>
                {moyennePeriode !== null ? (moyennePeriode * totalCoef).toFixed(2) : '—'}
              </td>
              {isFinalPeriod && <td style={{ ...cellCenter }}></td>}
              <td style={{ padding: '3px 5px', verticalAlign: 'middle' }}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Résumé + Récapitulatif ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '3px' }}>
        {/* Résumé période */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '5px', padding: '6px' }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '5px',
            padding: '5px',
            borderRadius: '5px',
            backgroundColor: isAdmis ? '#ecfdf5' : '#fef2f2',
            border: `1.5px solid ${isAdmis ? '#a7f3d0' : '#fecaca'}`,
          }}>
            <div style={{ fontSize: '7.5px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Moyenne {periodeName}</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: isAdmis ? '#047857' : '#dc2626', lineHeight: '1.2' }}>
              {moyennePeriode !== null ? `${moyennePeriode.toFixed(2)} / ${bareme}` : '—'}
            </div>
          </div>
          <div style={{ fontSize: '8.5px', color: '#374151' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span><strong>Rang :</strong> {rang !== null ? `${rang}ᵉ / ${effectif}` : '—'}</span>
              <span><strong>Mention :</strong> {mention || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span><strong>+ forte :</strong> {plusForte !== null ? plusForte.toFixed(2) : '—'}</span>
              <span><strong>+ faible :</strong> {plusFaible !== null ? plusFaible.toFixed(2) : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span><strong>Moy. classe :</strong> <span style={{ color: '#047857', fontWeight: 700 }}>{moyenneClasse !== null ? `${moyenneClasse.toFixed(2)}/${bareme}` : '—'}</span></span>
            </div>
            {moyenneAnnuelle !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span><strong>Moy. annuelle :</strong> <span style={{ color: moyenneAnnuelle >= seuil ? '#047857' : '#dc2626', fontWeight: 700 }}>{moyenneAnnuelle.toFixed(2)}/{bareme}</span></span>
                {rangAnnuel !== null && <span><strong>Rang annuel :</strong> <span style={{ fontWeight: 700 }}>{rangAnnuel}ᵉ / {effectif}</span></span>}
              </div>
            )}
          </div>
        </div>

        {/* Récapitulatif périodes précédentes */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '5px', padding: '6px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#047857', marginBottom: '3px', textAlign: 'center' }}>Récapitulatif des évaluations</div>
          {previousPeriods.length > 0 ? (
            <table style={{ fontSize: '8.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th style={{ padding: '2px 4px', textAlign: 'center', fontWeight: 600, verticalAlign: 'middle' }}>Évaluation</th>
                  <th style={{ padding: '2px 3px', textAlign: 'center', fontWeight: 600, verticalAlign: 'middle' }}>Moyenne</th>
                  <th style={{ padding: '2px 3px', textAlign: 'center', fontWeight: 600, verticalAlign: 'middle' }}>Mention</th>
                  <th style={{ padding: '2px 3px', textAlign: 'center', fontWeight: 600, verticalAlign: 'middle' }}>Rang</th>
                </tr>
              </thead>
              <tbody>
                {previousPeriods.map((pp, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '2px 4px', textAlign: 'center', fontWeight: 500, verticalAlign: 'middle' }}>{pp.periodeName}</td>
                    <td style={{ padding: '2px 3px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, verticalAlign: 'middle', color: pp.moyenne !== null && pp.moyenne < seuil ? '#dc2626' : '#047857' }}>
                      {pp.moyenne !== null ? `${pp.moyenne.toFixed(2)}/${bareme}` : '—'}
                    </td>
                    <td style={{ padding: '2px 3px', textAlign: 'center', fontStyle: 'italic', verticalAlign: 'middle', fontSize: '8px' }}>{pp.mention || '—'}</td>
                    <td style={{ padding: '2px 3px', textAlign: 'center', fontFamily: 'monospace', verticalAlign: 'middle' }}>
                      {pp.rang !== null ? `${pp.rang}ᵉ/${pp.effectif}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: '8px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>Première évaluation — aucun historique</div>
          )}
        </div>
      </div>

      {/* ── Graphique d'évolution ── */}
      {chartData.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '5px', padding: '4px 6px', marginBottom: '3px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#047857', marginBottom: '2px', textAlign: 'center' }}>Évolution des moyennes</div>
          <div style={{ width: '100%', height: '80px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: -5, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="periode" tick={{ fontSize: 7, fill: '#6b7280' }} />
                <YAxis domain={[0, bareme]} tick={{ fontSize: 7, fill: '#6b7280' }} width={22} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)}/${bareme}`, 'Moyenne']}
                  contentStyle={{ fontSize: 9, borderRadius: 4, padding: '3px 6px' }}
                />
                <ReferenceLine y={seuil} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `Seuil (${seuil})`, fontSize: 7, fill: '#ef4444' }} />
                <Line
                  type="monotone"
                  dataKey="moyenne"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#059669', stroke: '#fff', strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Pied de page : Décision & Signatures ── */}
      <div style={{ borderTop: '2px solid #047857', paddingTop: '5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '6px' }}>
          <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#374151' }}>DÉCISION :</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px' }}>
            {isAdmis ? <CheckSquare style={{ width: '11px', height: '11px', color: '#047857' }} /> : <Square style={{ width: '11px', height: '11px', color: '#9ca3af' }} />} Admis
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px' }}>
            {isRedouble ? <CheckSquare style={{ width: '11px', height: '11px', color: '#dc2626' }} /> : <Square style={{ width: '11px', height: '11px', color: '#9ca3af' }} />} Redouble
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px' }}>
            <Square style={{ width: '11px', height: '11px', color: '#9ca3af' }} /> Exclu
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
          {/* QR Code */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {eleve.matricule && (
              <>
                <QRCodeSVG
                  value="https://enfantsdufutur.com/"
                  size={44}
                  level="M"
                  includeMargin={false}
                />
                <div style={{ fontSize: '6.5px', color: '#9ca3af', marginTop: '1px', textAlign: 'center' }}>Espace Élève</div>
              </>
            )}
          </div>

          {/* Signature Parents */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>Signature des Parents</div>
            <div style={{ borderBottom: '1px dashed #9ca3af', height: '24px' }}></div>
            <div style={{ fontSize: '7px', color: '#9ca3af', marginTop: '2px' }}>Lu et approuvé</div>
          </div>

          {/* Signature Direction */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>La Direction</div>
            <div style={{ borderBottom: '1px dashed #9ca3af', height: '24px' }}></div>
            <div style={{ fontSize: '7px', color: '#9ca3af', marginTop: '2px' }}>Cachet obligatoire</div>
          </div>
        </div>

        <div style={{ fontSize: '7px', color: '#d1d5db', textAlign: 'center', marginTop: '5px' }}>
          EduGestion Pro — Bulletin généré le {new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>
    </div>
  );
}

export { getMention };
export type { PreviousPeriodSummary };
