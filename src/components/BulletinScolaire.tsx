import { CheckSquare, Square, MapPin, University } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface BulletinNote {
  matiere: string;
  pole: string | null;
  coefficient: number;
  notes: (number | null)[]; // per period
  noteFinale: number | null;
  rang: string | null;
  appreciation: string | null;
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
  periodes: { nom: string; id: string }[];
  bulletinData: BulletinNote[];
  moyenneFinale: number | null;
  rang: number | null;
  plusForte: number | null;
  plusFaible: number | null;
  bareme: number;
  seuil: number;
  chartData: { name: string; note: number }[];
  cycleName?: string;
  anneeScolaire?: string;
  schoolName?: string;
  schoolSubtitle?: string;
  schoolCity?: string;
  schoolLogoUrl?: string | null;
}

export default function BulletinScolaire({
  eleve,
  classe,
  effectif,
  periodes,
  bulletinData,
  moyenneFinale,
  rang,
  plusForte,
  plusFaible,
  bareme,
  seuil,
  chartData,
  cycleName,
  anneeScolaire = '2025 - 2026',
  schoolName = 'Ecole Internationale Les Enfants du Futur',
  schoolSubtitle = 'Enseignement Général et Technique',
  schoolCity = 'Conakry, Guinée',
  schoolLogoUrl,
}: BulletinScolaireProps) {
  const isAdmis = moyenneFinale !== null && moyenneFinale >= seuil;
  const isRedouble = moyenneFinale !== null && !isAdmis;

  // Compute total coefficients and total sum
  const totalCoef = bulletinData.reduce((s, b) => s + b.coefficient, 0);

  return (
    <div data-bulletin-a4 className="bg-white text-gray-900 font-sans" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '10mm', boxSizing: 'border-box' }}>
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { background-color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* En-tête */}
      <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-3 mb-4">
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
          <h2 className="text-lg font-bold text-emerald-700 tracking-wide">BULLETIN SCOLAIRE</h2>
          <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-1 mt-1">
            <p className="text-xs text-emerald-700 font-medium">Année : {anneeScolaire}</p>
          </div>
        </div>
      </div>

      {/* Infos Élève */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="text-gray-500 font-medium">Nom & Prénom</span> <span className="font-bold ml-2">{eleve.prenom} {eleve.nom}</span></p>
          <p><span className="text-gray-500 font-medium">Matricule</span> <span className="font-bold ml-2">{eleve.matricule || '—'}</span></p>
          <p><span className="text-gray-500 font-medium">Classe</span> <span className="font-bold ml-2">{classe}</span></p>
          <p><span className="text-gray-500 font-medium">Effectif</span> <span className="font-bold ml-2">{effectif}</span></p>
        </div>
      </div>

      {/* Tableau des notes */}
      <div className="mb-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-emerald-700 text-white">
              <th className="border border-emerald-600 px-2 py-1.5 text-left font-semibold">Matière</th>
              <th className="border border-emerald-600 px-1 py-1.5 text-center font-semibold w-10">Coef</th>
              {periodes.map((p) => (
                <th key={p.id} className="border border-emerald-600 px-1 py-1.5 text-center font-semibold w-10">{p.nom}</th>
              ))}
              <th className="border border-emerald-600 px-1 py-1.5 text-center font-semibold w-14 bg-emerald-800">Note Fin.</th>
              <th className="border border-emerald-600 px-1 py-1.5 text-center font-semibold w-10 bg-emerald-800">Rang</th>
              <th className="border border-emerald-600 px-2 py-1.5 text-left font-semibold bg-emerald-800">Appréciation</th>
            </tr>
          </thead>
          <tbody>
            {bulletinData.map((b, i) => {
              const noteFinaleVal = b.noteFinale;
              const isBelowAvg = noteFinaleVal !== null && noteFinaleVal < seuil;
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-200 px-2 py-1 font-medium">{b.matiere}</td>
                  <td className="border border-gray-200 px-1 py-1 text-center text-gray-600">{b.coefficient}</td>
                  {b.notes.map((n, j) => (
                    <td key={j} className={`border border-gray-200 px-1 py-1 text-center font-mono ${n !== null && n < seuil ? 'text-red-600' : ''}`}>
                      {n !== null ? n.toFixed(0) : '—'}
                    </td>
                  ))}
                  <td className={`border border-gray-200 px-1 py-1 text-center font-mono font-bold ${isBelowAvg ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>
                    {noteFinaleVal !== null ? noteFinaleVal.toFixed(0) : '—'}
                  </td>
                  <td className="border border-gray-200 px-1 py-1 text-center font-mono">{b.rang || '—'}</td>
                  <td className="border border-gray-200 px-2 py-1 text-gray-600 italic">{b.appreciation || '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-50 font-bold">
              <td className="border border-gray-300 px-2 py-1.5">TOTAL GÉNÉRAL</td>
              <td className="border border-gray-300 px-1 py-1.5 text-center">{totalCoef}</td>
              <td colSpan={periodes.length} className="border border-gray-300 px-1 py-1.5 text-center text-gray-500">SOMME DES PÉRIODES</td>
              <td className="border border-gray-300 px-1 py-1.5 text-center text-emerald-700">
                {moyenneFinale !== null ? (moyenneFinale * totalCoef).toFixed(0) : '—'}
              </td>
              <td colSpan={2} className="border border-gray-300 px-1 py-1.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Section Graphique & Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Graphique d'évolution */}
        <div className="border border-gray-200 rounded-lg p-3">
          <h3 className="text-xs font-bold text-emerald-700 mb-2">Évolution des résultats (Moyenne Périodique)</h3>
          <div style={{ width: '100%', height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, bareme]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="note" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Résumé */}
        <div className="border border-gray-200 rounded-lg p-3 flex flex-col justify-center">
          <div className={`text-center mb-3 p-2 rounded-lg ${isAdmis ? 'bg-emerald-50 border border-emerald-300' : 'bg-red-50 border border-red-300'}`}>
            <span className="text-xs text-gray-500">Moyenne Finale :</span>
            <p className={`text-2xl font-black ${isAdmis ? 'text-emerald-700' : 'text-red-600'}`}>
              {moyenneFinale !== null ? `${moyenneFinale.toFixed(2)} / ${bareme}` : '—'}
            </p>
          </div>
          <div className="text-xs space-y-1 text-gray-700">
            <p><span className="font-medium">Rang :</span> <strong>{rang !== null ? `${rang}e / ${effectif}` : '—'}</strong></p>
            <p><span className="font-medium">Plus forte moyenne :</span> {plusForte !== null ? plusForte.toFixed(2) : '—'}</p>
            <p><span className="font-medium">Plus faible moyenne :</span> {plusFaible !== null ? plusFaible.toFixed(2) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Pied de page : Décision & Signatures */}
      <div className="border-t-2 border-emerald-600 pt-3">
        <div className="flex items-center gap-4 mb-4">
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

        <div className="grid grid-cols-2 gap-8 mt-4">
          <div className="text-center">
            <p className="text-xs font-bold text-gray-700 mb-1">Signature des Parents</p>
            <div className="border-b border-dashed border-gray-400 h-10"></div>
            <p className="text-[10px] text-gray-400 mt-1">Lu et approuvé</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-gray-700 mb-1">La Direction</p>
            <div className="border-b border-dashed border-gray-400 h-10"></div>
            <p className="text-[10px] text-gray-400 mt-1">Cachet obligatoire</p>
          </div>
        </div>

        <p className="text-[9px] text-gray-300 text-center mt-4">
          EduGestion Pro — Bulletin généré le {new Date().toLocaleDateString('fr-FR')}
        </p>
      </div>
    </div>
  );
}
