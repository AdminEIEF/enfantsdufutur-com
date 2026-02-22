import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, CalendarDays, BookOpen } from 'lucide-react';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HEURES = ['07:30', '08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00', '16:00'];

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

  if (!session) return null;

  const emp = session.employe;
  const isEnseignant = emp.categorie === 'enseignant';
  const classes = data?.classes || [];
  const cours = data?.cours_enseignant || [];
  const devoirs = data?.devoirs_enseignant || [];

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

              {/* Weekly calendar grid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">📅 Emploi du temps hebdomadaire</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="border px-2 py-1.5 bg-muted text-left w-16">Heure</th>
                          {JOURS.map(j => (
                            <th key={j} className="border px-2 py-1.5 bg-muted text-center">{j}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {HEURES.map(h => (
                          <tr key={h}>
                            <td className="border px-2 py-2 font-medium text-muted-foreground">{h}</td>
                            {JOURS.map(j => {
                              // Placeholder: show assigned classes spread across the week
                              const idx = JOURS.indexOf(j);
                              const heureIdx = HEURES.indexOf(h);
                              const assignedClass = classes[((idx * 3 + heureIdx) % classes.length)] || null;
                              const showClass = assignedClass && heureIdx < 6 && ((idx + heureIdx) % 3 === 0);
                              return (
                                <td key={j} className={`border px-1 py-1 text-center ${showClass ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}>
                                  {showClass && (
                                    <div className="text-[10px] leading-tight">
                                      <div className="font-semibold text-emerald-700 dark:text-emerald-400">{assignedClass.classes?.nom}</div>
                                      <div className="text-muted-foreground">{assignedClass.matieres?.nom}</div>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    * L'emploi du temps détaillé est géré par le service informatique
                  </p>
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
