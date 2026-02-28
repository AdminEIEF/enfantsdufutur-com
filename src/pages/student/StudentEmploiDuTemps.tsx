import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudentLayout } from '@/components/StudentLayout';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Loader2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HEURES_DEFAULT = ['07:30', '08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00', '16:00'];

const COULEURS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
];

export default function StudentEmploiDuTemps() {
  const { session } = useStudentAuth();
  const [edt, setEdt] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ token: session.token, action: 'emploi_du_temps' }),
    })
      .then(r => r.json())
      .then(data => setEdt(data.emploi_du_temps || []))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [session]);

  const matiereColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const unique = [...new Set(edt.map(s => s.matiere_id))];
    unique.forEach((id, i) => { map[id] = COULEURS[i % COULEURS.length]; });
    return map;
  }, [edt]);

  // Build dynamic hours from data + defaults
  const HEURES = useMemo(() => {
    const allTimes = new Set(HEURES_DEFAULT);
    edt.forEach((s: any) => {
      if (s.heure_debut) allTimes.add(s.heure_debut.slice(0, 5));
    });
    return [...allTimes].sort();
  }, [edt]);

  const getSlot = (jourIdx: number, heure: string) =>
    edt.find(s => s.jour_semaine === jourIdx + 1 && s.heure_debut === heure + ':00');

  const todayIdx = new Date().getDay();
  const todayJourIdx = todayIdx === 0 ? 6 : todayIdx - 1;

  return (
    <StudentLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Mon emploi du temps
          </h2>

          {edt.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Aucun emploi du temps configuré pour votre classe.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-xs border-collapse min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="border px-2 py-1.5 bg-muted text-left w-14">Heure</th>
                        {JOURS.map((j, idx) => (
                          <th key={j} className={`border px-1 py-1.5 text-center ${idx === todayJourIdx ? 'bg-primary/10 font-bold' : 'bg-muted'}`}>
                            {j}
                            {idx === todayJourIdx && <span className="ml-0.5 text-[8px] text-primary">●</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {HEURES.map(h => (
                        <tr key={h}>
                          <td className="border px-2 py-2 font-medium text-muted-foreground text-[10px]">{h}</td>
                          {JOURS.map((j, jIdx) => {
                            const slot = getSlot(jIdx, h);
                            if (!slot) {
                              return <td key={j} className={`border ${jIdx === todayJourIdx ? 'bg-primary/5' : ''}`} />;
                            }
                            const colorClass = matiereColorMap[slot.matiere_id] || COULEURS[0];
                            return (
                              <td key={j} className="border px-0.5 py-0.5">
                                <div className={`rounded px-1 py-1 ${colorClass}`}>
                                  <div className="font-semibold text-[10px] leading-tight">{slot.matieres?.nom}</div>
                                  {slot.employes && (
                                    <div className="text-[9px] opacity-80 mt-0.5">👤 {slot.employes.prenom} {slot.employes.nom}</div>
                                  )}
                                  {slot.salle && <div className="text-[9px] opacity-70">🏫 {slot.salle}</div>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </StudentLayout>
  );
}
