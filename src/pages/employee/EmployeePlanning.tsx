import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, CalendarDays, BookOpen } from 'lucide-react';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HEURES = ['07:30', '08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00', '16:00'];

const COULEURS = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
];

export default function EmployeePlanning() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ token: session.token, action: 'dashboard' }),
    })
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session]);

  const emp = session?.employe;
  const isEnseignant = emp?.categorie === 'enseignant';
  const classes = data?.classes || [];
  const edt = data?.emploi_du_temps || [];
  const cours = data?.cours_enseignant || [];
  const devoirs = data?.devoirs_enseignant || [];

  // Color map by matiere
  const matiereColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const unique = [...new Set(edt.map((s: any) => s.matiere_id))];
    unique.forEach((id, i) => { map[id as string] = COULEURS[i % COULEURS.length]; });
    return map;
  }, [edt]);

  if (!session) return null;

  const getSlot = (jourIdx: number, heure: string) =>
    edt.find((s: any) => s.jour_semaine === jourIdx + 1 && s.heure_debut === heure + ':00');

  // Today highlight
  const todayIdx = new Date().getDay(); // 0=Sun
  const todayJourIdx = todayIdx === 0 ? 6 : todayIdx - 1; // 0=Mon...5=Sat

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Mon planning
          </h2>

          {isEnseignant ? (
            <>
              {/* Classes assigned */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4" /> Mes classes & matières
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {classes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune classe assignée</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {classes.map((ec: any) => (
                        <Badge key={ec.id} variant="secondary" className="text-xs px-3 py-1.5">
                          📚 {ec.classes?.nom} — {ec.matieres?.nom || 'Toutes matières'}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weekly calendar grid with REAL data */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">📅 Emploi du temps hebdomadaire</CardTitle>
                </CardHeader>
                <CardContent>
                  {edt.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Aucun créneau configuré. L'emploi du temps sera renseigné par le service informatique.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr>
                            <th className="border px-2 py-1.5 bg-muted text-left w-16">Heure</th>
                            {JOURS.map((j, idx) => (
                              <th key={j} className={`border px-2 py-1.5 text-center ${idx === todayJourIdx ? 'bg-primary/10 font-bold' : 'bg-muted'}`}>
                                {j}
                                {idx === todayJourIdx && <span className="ml-1 text-[9px] text-primary">●</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {HEURES.map(h => (
                            <tr key={h}>
                              <td className="border px-2 py-2 font-medium text-muted-foreground">{h}</td>
                              {JOURS.map((j, jIdx) => {
                                const slot = getSlot(jIdx, h);
                                if (!slot) {
                                  return <td key={j} className={`border px-1 py-1 ${jIdx === todayJourIdx ? 'bg-primary/5' : ''}`} />;
                                }
                                const colorClass = matiereColorMap[slot.matiere_id] || COULEURS[0];
                                return (
                                  <td key={j} className="border px-0.5 py-0.5">
                                    <div className={`rounded px-1.5 py-1 ${colorClass}`}>
                                      <div className="font-semibold text-[10px] leading-tight">{slot.matieres?.nom}</div>
                                      <div className="text-[9px] opacity-80">{slot.classes?.nom}</div>
                                      {slot.salle && <div className="text-[9px] opacity-70">🏫 {slot.salle}</div>}
                                      <div className="text-[8px] opacity-60">{slot.heure_debut?.slice(0, 5)}—{slot.heure_fin?.slice(0, 5)}</div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming courses */}
              {cours.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">📚 Contenus publiés</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {cours.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                          <div>
                            <span className="font-medium">{c.titre}</span>
                            <span className="text-muted-foreground ml-2">{c.classes?.nom} — {c.matieres?.nom}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{c.type_contenu}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active homeworks */}
              {devoirs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">📝 Devoirs en cours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {devoirs.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                          <div>
                            <span className="font-medium">{d.titre}</span>
                            <span className="text-muted-foreground ml-2">{d.classes?.nom} — {d.matieres?.nom}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            {new Date(d.date_limite).toLocaleDateString('fr-FR')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Le planning est disponible pour les enseignants. Consultez la direction pour votre emploi du temps.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
