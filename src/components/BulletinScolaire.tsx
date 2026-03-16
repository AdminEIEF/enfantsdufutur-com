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

export default function BulletinScolaire({
  eleve,
  classe,
  effectif,
  periodeName,
  bulletinData,
  moyennePeriode,
  rang,
  plusForte,
  plusFaible,
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
}: BulletinScolaireProps) {
  const isAdmis = moyennePeriode !== null && moyennePeriode >= seuil;
  const isRedouble = moyennePeriode !== null && !isAdmis;
  const totalCoef = bulletinData.reduce((s, b) => s + b.coefficient, 0);
  const mention = getMention(moyennePeriode, bareme);

  const chartData = [
    ...previousPeriods.map(pp => ({ periode: pp.periodeName, moyenne: pp.moyenne })),
    { periode: periodeName, moyenne: moyennePeriode },
  ].filter(d => d.moyenne !== null);

  return (
    <div
      data-bulletin-a4
      style={{
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '6mm 8mm',
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontSize: '10px',
        lineHeight: '1.35',
        color: '#1a1a1a',
        backgroundColor: '#ffffff',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact' as any,
      }}
    >
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          [data-bulletin-a4] { width: 210mm !important; min-height: 297mm !important; padding: 6mm 8mm !important; }
          [data-bulletin-a4] * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        [data-bulletin-a4] table { border-collapse: collapse; }
        [data-bulletin-a4] th, [data-bulletin-a4] td { border: 1px solid #d1d5db; }
      `}</style>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2.5px solid #047857', paddingBottom: '6px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {schoolLogoUrl ? (
            <img src={schoolLogoUrl} alt="Logo" style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: '52px', height: '52px', backgroundColor: '#047857', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <University style={{ width: '26px', height: '26px', color: 'white' }} />
            </div>
          )}
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#064e3b', letterSpacing: '0.02em' }}>{schoolName}</div>
            <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '1px' }}>{schoolSubtitle}</div>
            <div style={{ fontSize: '8px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
              <MapPin style={{ width: '9px', height: '9px' }} /> {schoolCity}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#047857', letterSpacing: '0.05em' }}>BULLETIN DE NOTES</div>
          <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', padding: '3px 10px', marginTop: '4px' }}>
            <div style={{ fontSize: '9px', color: '#047857', fontWeight: 600 }}>Année : {anneeScolaire} — {periodeName}</div>
          </div>
        </div>
      </div>

      {/* ── Infos Élève ── */}
      <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '5px 10px', marginBottom: '5px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px', fontSize: '9.5px' }}>
          <div><span style={{ color: '#6b7280', fontWeight: 500 }}>Nom & Prénom</span> <strong style={{ marginLeft: '6px' }}>{eleve.prenom} {eleve.nom}</strong></div>
          <div><span style={{ color: '#6b7280', fontWeight: 500 }}>Matricule</span> <strong style={{ marginLeft: '6px' }}>{eleve.matricule || '—'}</strong></div>
          <div><span style={{ color: '#6b7280', fontWeight: 500 }}>Classe</span> <strong style={{ marginLeft: '6px' }}>{classe}</strong></div>
          <div><span style={{ color: '#6b7280', fontWeight: 500 }}>Effectif</span> <strong style={{ marginLeft: '6px' }}>{effectif}</strong></div>
        </div>
      </div>

      {/* ── Tableau des notes ── */}
      <div style={{ marginBottom: '4px' }}>
        <table style={{ width: '100%', fontSize: '9px' }}>
          <thead>
            <tr style={{ backgroundColor: '#047857', color: 'white' }}>
              <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 600 }}>Matière</th>
              <th style={{ padding: '4px 3px', textAlign: 'center', fontWeight: 600, width: '32px' }}>Coef</th>
              {isFinalPeriod && previousPeriodsNotes.map((pp) => (
                <th key={pp.periodeName} style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600, width: '38px', fontSize: '8px' }}>{pp.periodeName}</th>
              ))}
              <th style={{ padding: '4px 3px', textAlign: 'center', fontWeight: 600, width: '48px' }}>Moyenne</th>
              <th style={{ padding: '4px 3px', textAlign: 'center', fontWeight: 600, width: '52px' }}>Moy. Coeff</th>
              {isFinalPeriod && (
                <th style={{ padding: '4px 2px', textAlign: 'center', fontWeight: 600, width: '32px' }}>Rang</th>
              )}
              <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 600 }}>Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {bulletinData.map((b, i) => {
              const isBelowAvg = b.note !== null && b.note < seuil;
              const total = b.note !== null ? b.note * b.coefficient : null;
              return (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '3px 6px', fontWeight: 500 }}>{b.matiere}</td>
                  <td style={{ padding: '3px 3px', textAlign: 'center', color: '#6b7280' }}>{b.coefficient}</td>
                  {isFinalPeriod && previousPeriodsNotes.map((pp) => {
                    const prevNote = pp.notesByMatiere[b.matiere] ?? null;
                    const prevBelowAvg = prevNote !== null && prevNote < seuil;
                    return (
                      <td key={pp.periodeName} style={{ padding: '3px 2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '8.5px', color: prevBelowAvg ? '#dc2626' : '#374151' }}>
                        {prevNote !== null ? prevNote.toFixed(2) : '—'}
                      </td>
                    );
                  })}
                  <td style={{ padding: '3px 3px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: isBelowAvg ? '#dc2626' : '#047857', backgroundColor: isBelowAvg ? '#fef2f2' : '#ecfdf5' }}>
                    {b.note !== null ? b.note.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '3px 3px', textAlign: 'center', fontFamily: 'monospace' }}>
                    {total !== null ? total.toFixed(2) : '—'}
                  </td>
                  {isFinalPeriod && (
                    <td style={{ padding: '3px 2px', textAlign: 'center', fontFamily: 'monospace' }}>{b.rang || '—'}</td>
                  )}
                  <td style={{ padding: '3px 6px', color: '#6b7280', fontStyle: 'italic', fontSize: '8.5px' }}>{b.appreciation || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#ecfdf5', fontWeight: 700 }}>
              <td style={{ padding: '4px 6px' }}>TOTAL DES POINTS</td>
              <td style={{ padding: '4px 3px', textAlign: 'center' }}>{totalCoef}</td>
              {isFinalPeriod && previousPeriodsNotes.map((pp) => (
                <td key={pp.periodeName} style={{ padding: '4px 2px' }}></td>
              ))}
              <td style={{ padding: '4px 3px', textAlign: 'center', fontFamily: 'monospace', color: moyennePeriode !== null && moyennePeriode < seuil ? '#dc2626' : '#047857' }}>
                {moyennePeriode !== null ? moyennePeriode.toFixed(2) : '—'}
              </td>
              <td style={{ padding: '4px 3px', textAlign: 'center', fontFamily: 'monospace' }}>
                {moyennePeriode !== null ? (moyennePeriode * totalCoef).toFixed(2) : '—'}
              </td>
              {isFinalPeriod && <td style={{ padding: '4px 2px' }}></td>}
              <td style={{ padding: '4px 6px' }}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Résumé + Récapitulatif ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' }}>
        {/* Résumé période */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '6px',
            padding: '6px',
            borderRadius: '6px',
            backgroundColor: isAdmis ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${isAdmis ? '#a7f3d0' : '#fecaca'}`,
          }}>
            <div style={{ fontSize: '8px', color: '#6b7280' }}>Moyenne {periodeName} :</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: isAdmis ? '#047857' : '#dc2626' }}>
              {moyennePeriode !== null ? `${moyennePeriode.toFixed(2)} / ${bareme}` : '—'}
            </div>
          </div>
          <div style={{ fontSize: '9px', color: '#374151' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span><strong>Rang :</strong> {rang !== null ? `${rang}e / ${effectif}` : '—'}</span>
              <span><strong>Mention :</strong> {mention || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><strong>+ forte :</strong> {plusForte !== null ? plusForte.toFixed(2) : '—'}</span>
              <span><strong>+ faible :</strong> {plusFaible !== null ? plusFaible.toFixed(2) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Récapitulatif périodes précédentes */}
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px' }}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#047857', marginBottom: '4px' }}>Récapitulatif des évaluations précédentes</div>
          {previousPeriods.length > 0 ? (
            <table style={{ width: '100%', fontSize: '9px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 600 }}>Évaluation</th>
                  <th style={{ padding: '3px 3px', textAlign: 'center', fontWeight: 600 }}>Moyenne</th>
                  <th style={{ padding: '3px 3px', textAlign: 'center', fontWeight: 600 }}>Mention</th>
                  <th style={{ padding: '3px 3px', textAlign: 'center', fontWeight: 600 }}>Rang</th>
                </tr>
              </thead>
              <tbody>
                {previousPeriods.map((pp, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '2px 6px', fontWeight: 500 }}>{pp.periodeName}</td>
                    <td style={{ padding: '2px 3px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: pp.moyenne !== null && pp.moyenne < seuil ? '#dc2626' : '#047857' }}>
                      {pp.moyenne !== null ? `${pp.moyenne.toFixed(2)}/${bareme}` : '—'}
                    </td>
                    <td style={{ padding: '2px 3px', textAlign: 'center', fontStyle: 'italic' }}>{pp.mention || '—'}</td>
                    <td style={{ padding: '2px 3px', textAlign: 'center', fontFamily: 'monospace' }}>
                      {pp.rang !== null ? `${pp.rang}e/${pp.effectif}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: '8.5px', color: '#9ca3af', fontStyle: 'italic' }}>Première évaluation — aucun historique</div>
          )}
        </div>
      </div>

      {/* ── Graphique d'évolution ── */}
      {chartData.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 8px', marginBottom: '4px' }}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#047857', marginBottom: '2px' }}>Évolution des moyennes</div>
          <div style={{ width: '100%', height: '100px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="periode" tick={{ fontSize: 8, fill: '#6b7280' }} />
                <YAxis domain={[0, bareme]} tick={{ fontSize: 8, fill: '#6b7280' }} width={25} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)}/${bareme}`, 'Moyenne']}
                  contentStyle={{ fontSize: 10, borderRadius: 4 }}
                />
                <ReferenceLine y={seuil} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `Seuil (${seuil})`, fontSize: 8, fill: '#ef4444' }} />
                <Line
                  type="monotone"
                  dataKey="moyenne"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 3.5, fill: '#059669', stroke: '#fff', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Pied de page : Décision & Signatures ── */}
      <div style={{ borderTop: '2.5px solid #047857', paddingTop: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#374151' }}>DÉCISION :</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9.5px' }}>
            {isAdmis ? <CheckSquare style={{ width: '12px', height: '12px', color: '#047857' }} /> : <Square style={{ width: '12px', height: '12px', color: '#9ca3af' }} />} Admis
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9.5px' }}>
            {isRedouble ? <CheckSquare style={{ width: '12px', height: '12px', color: '#dc2626' }} /> : <Square style={{ width: '12px', height: '12px', color: '#9ca3af' }} />} Redouble
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9.5px' }}>
            <Square style={{ width: '12px', height: '12px', color: '#9ca3af' }} /> Exclu
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'end' }}>
          {/* QR Code */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {eleve.matricule && (
              <>
                <QRCodeSVG
                  value={`${window.location.origin}/eleve?matricule=${encodeURIComponent(eleve.matricule)}`}
                  size={50}
                  level="M"
                  includeMargin={false}
                />
                <div style={{ fontSize: '7px', color: '#9ca3af', marginTop: '2px', textAlign: 'center' }}>Espace Élève</div>
              </>
            )}
          </div>

          {/* Signature Parents */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>Signature des Parents</div>
            <div style={{ borderBottom: '1px dashed #9ca3af', height: '28px' }}></div>
            <div style={{ fontSize: '8px', color: '#9ca3af', marginTop: '3px' }}>Lu et approuvé</div>
          </div>

          {/* Signature Direction */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>La Direction</div>
            <div style={{ borderBottom: '1px dashed #9ca3af', height: '28px' }}></div>
            <div style={{ fontSize: '8px', color: '#9ca3af', marginTop: '3px' }}>Cachet obligatoire</div>
          </div>
        </div>

        <div style={{ fontSize: '7.5px', color: '#d1d5db', textAlign: 'center', marginTop: '8px' }}>
          EduGestion Pro — Bulletin généré le {new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>
    </div>
  );
}

export { getMention };
export type { PreviousPeriodSummary };
