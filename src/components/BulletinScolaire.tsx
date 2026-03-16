import { CheckSquare, Square, MapPin, University } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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
}: BulletinScolaireProps) {
  const isAdmis = moyennePeriode !== null && moyennePeriode >= seuil;
  const isRedouble = moyennePeriode !== null && !isAdmis;
  const totalCoef = bulletinData.reduce((s, b) => s + b.coefficient, 0);
  const mention = getMention(moyennePeriode, bareme);

  return (
    <div data-bulletin-a4 className="bg-white text-gray-900 font-sans" style={{ width: '210mm', maxHeight: '297mm', margin: '0 auto', padding: '8mm 10mm', boxSizing: 'border-box', overflow: 'hidden' }}>
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { background-color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* En-tête */}
      <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-3 mb-3">
        <div className="flex items-center gap-3">
          {schoolLogoUrl ? (
            <img src={schoolLogoUrl} alt="Logo" className="w-14 h-14 rounded-full object-cover" crossOrigin="anonymous" />
          ) : (
            <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center">
              <University className="h-7 w-7 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-emerald-800">{schoolName}</h1>
            <p className="text-xs text-gray-500">{schoolSubtitle}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {schoolCity}
            </p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-emerald-700 tracking-wide">BULLETIN DE NOTES</h2>
          <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-1 mt-1">
            <p className="text-xs text-emerald-700 font-medium">Année : {anneeScolaire}</p>
            <p className="text-xs text-emerald-600 font-bold">{periodeName}</p>
          </div>
        </div>
      </div>

      {/* Infos Élève */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
          <p><span className="text-gray-500 font-medium">Nom & Prénom</span> <span className="font-bold ml-2">{eleve.prenom} {eleve.nom}</span></p>
          <p><span className="text-gray-500 font-medium">Matricule</span> <span className="font-bold ml-2">{eleve.matricule || '—'}</span></p>
          <p><span className="text-gray-500 font-medium">Classe</span> <span className="font-bold ml-2">{classe}</span></p>
          <p><span className="text-gray-500 font-medium">Effectif</span> <span className="font-bold ml-2">{effectif}</span></p>
        </div>
      </div>

      {/* Tableau des notes — période sélectionnée uniquement */}
      <div className="mb-3">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-emerald-700 text-white">
              <th className="border border-emerald-600 px-2 py-1.5 text-left font-semibold">Matière</th>
              <th className="border border-emerald-600 px-1 py-1.5 text-center font-semibold w-10">Coef</th>
              <th className="border border-emerald-600 px-1 py-1.5 text-center font-semibold w-16">Note/{bareme}</th>
              <th className="border border-emerald-600 px-1 py-1.5 text-center font-semibold w-16">Total</th>
              <th className="border border-emerald-600 px-1 py-1.5 text-center font-semibold w-10">Rang</th>
              <th className="border border-emerald-600 px-2 py-1.5 text-left font-semibold">Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {bulletinData.map((b, i) => {
              const isBelowAvg = b.note !== null && b.note < seuil;
              const total = b.note !== null ? b.note * b.coefficient : null;
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-200 px-2 py-1 font-medium">{b.matiere}</td>
                  <td className="border border-gray-200 px-1 py-1 text-center text-gray-600">{b.coefficient}</td>
                  <td className={`border border-gray-200 px-1 py-1 text-center font-mono font-bold ${isBelowAvg ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
                    {b.note !== null ? b.note.toFixed(2) : '—'}
                  </td>
                  <td className="border border-gray-200 px-1 py-1 text-center font-mono">
                    {total !== null ? total.toFixed(2) : '—'}
                  </td>
                  <td className="border border-gray-200 px-1 py-1 text-center font-mono">{b.rang || '—'}</td>
                  <td className="border border-gray-200 px-2 py-1 text-gray-600 italic">{b.appreciation || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-50 font-bold">
              <td className="border border-gray-300 px-2 py-1.5">MOYENNE GÉNÉRALE</td>
              <td className="border border-gray-300 px-1 py-1.5 text-center">{totalCoef}</td>
              <td className={`border border-gray-300 px-1 py-1.5 text-center font-mono ${moyennePeriode !== null && moyennePeriode < seuil ? 'text-red-600' : 'text-emerald-700'}`}>
                {moyennePeriode !== null ? moyennePeriode.toFixed(2) : '—'}
              </td>
              <td className="border border-gray-300 px-1 py-1.5 text-center font-mono">
                {moyennePeriode !== null ? (moyennePeriode * totalCoef).toFixed(2) : '—'}
              </td>
              <td colSpan={2} className="border border-gray-300 px-1 py-1.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Résumé de la période actuelle */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="border border-gray-200 rounded-lg p-3 flex flex-col justify-center">
          <div className={`text-center mb-2 p-2 rounded-lg ${isAdmis ? 'bg-emerald-50 border border-emerald-300' : 'bg-red-50 border border-red-300'}`}>
            <span className="text-[10px] text-gray-500">Moyenne {periodeName} :</span>
            <p className={`text-2xl font-black ${isAdmis ? 'text-emerald-700' : 'text-red-600'}`}>
              {moyennePeriode !== null ? `${moyennePeriode.toFixed(2)} / ${bareme}` : '—'}
            </p>
          </div>
          <div className="text-xs space-y-1 text-gray-700">
            <p><span className="font-medium">Rang :</span> <strong>{rang !== null ? `${rang}e / ${effectif}` : '—'}</strong></p>
            <p><span className="font-medium">Mention :</span> <strong>{mention || '—'}</strong></p>
            <p><span className="font-medium">Plus forte moyenne :</span> {plusForte !== null ? plusForte.toFixed(2) : '—'}</p>
            <p><span className="font-medium">Plus faible moyenne :</span> {plusFaible !== null ? plusFaible.toFixed(2) : '—'}</p>
          </div>
        </div>

        {/* Tableau récap des périodes précédentes */}
        <div className="border border-gray-200 rounded-lg p-3">
          <h3 className="text-xs font-bold text-emerald-700 mb-2">Récapitulatif des évaluations précédentes</h3>
          {previousPeriods.length > 0 ? (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1 text-left font-semibold">Évaluation</th>
                  <th className="border border-gray-200 px-1 py-1 text-center font-semibold">Moyenne</th>
                  <th className="border border-gray-200 px-1 py-1 text-center font-semibold">Rang</th>
                  <th className="border border-gray-200 px-1 py-1 text-center font-semibold">Mention</th>
                </tr>
              </thead>
              <tbody>
                {previousPeriods.map((pp, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-2 py-1 font-medium">{pp.periodeName}</td>
                    <td className={`border border-gray-200 px-1 py-1 text-center font-mono font-bold ${pp.moyenne !== null && pp.moyenne < seuil ? 'text-red-600' : 'text-emerald-700'}`}>
                      {pp.moyenne !== null ? `${pp.moyenne.toFixed(2)}/${bareme}` : '—'}
                    </td>
                    <td className="border border-gray-200 px-1 py-1 text-center font-mono">
                      {pp.rang !== null ? `${pp.rang}e/${pp.effectif}` : '—'}
                    </td>
                    <td className="border border-gray-200 px-1 py-1 text-center italic">
                      {pp.mention || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] text-gray-400 italic">Première évaluation — aucun historique</p>
          )}
        </div>
      </div>

      {/* Pied de page : Décision & Signatures */}
      <div className="border-t-2 border-emerald-600 pt-2">
        <div className="flex items-center gap-4 mb-3">
          <span className="text-xs font-bold text-gray-700">DÉCISION :</span>
          <span className="flex items-center gap-1 text-xs">
            {isAdmis ? <CheckSquare className="h-3.5 w-3.5 text-emerald-600" /> : <Square className="h-3.5 w-3.5 text-gray-400" />} Admis
          </span>
          <span className="flex items-center gap-1 text-xs">
            {isRedouble ? <CheckSquare className="h-3.5 w-3.5 text-red-600" /> : <Square className="h-3.5 w-3.5 text-gray-400" />} Redouble
          </span>
          <span className="flex items-center gap-1 text-xs">
            <Square className="h-3.5 w-3.5 text-gray-400" /> Exclu
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-2 items-end">
          {/* QR Code */}
          <div className="flex flex-col items-center">
            {eleve.matricule && (
              <>
                <QRCodeSVG
                  value={`${window.location.origin}/eleve?matricule=${encodeURIComponent(eleve.matricule)}`}
                  size={56}
                  level="M"
                  includeMargin={false}
                />
                <p className="text-[8px] text-gray-400 mt-1 text-center">Espace Élève</p>
              </>
            )}
          </div>

          {/* Signature Parents */}
          <div className="text-center">
            <p className="text-xs font-bold text-gray-700 mb-1">Signature des Parents</p>
            <div className="border-b border-dashed border-gray-400 h-8"></div>
            <p className="text-[10px] text-gray-400 mt-1">Lu et approuvé</p>
          </div>

          {/* Signature Direction */}
          <div className="text-center">
            <p className="text-xs font-bold text-gray-700 mb-1">La Direction</p>
            <div className="border-b border-dashed border-gray-400 h-8"></div>
            <p className="text-[10px] text-gray-400 mt-1">Cachet obligatoire</p>
          </div>
        </div>

        <p className="text-[9px] text-gray-300 text-center mt-3">
          EduGestion Pro — Bulletin généré le {new Date().toLocaleDateString('fr-FR')}
        </p>
      </div>
    </div>
  );
}

export { getMention };
export type { PreviousPeriodSummary };
