import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { BookOpen, ClipboardList, Award, Clock, UtensilsCrossed, Loader2, ChevronRight, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function StudentDashboard() {
  const { session } = useStudentAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetchDashboard();
  }, [session]);

  const fetchDashboard = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ token: session!.token, action: 'dashboard' }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401 || resp.status === 403) {
          toast.error(result.error);
          return;
        }
        throw new Error(result.error);
      }
      setData(result);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const eleve = session?.eleve;

  return (
    <StudentLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Welcome */}
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Bonjour {eleve?.prenom} 👋</h2>
            <p className="text-sm text-muted-foreground">
              {eleve?.classes?.niveaux?.nom} — {eleve?.classes?.nom}
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/eleve/cours')}>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data?.derniers_cours?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Cours récents</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/eleve/devoirs')}>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data?.prochains_devoirs?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Devoirs à rendre</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/eleve/resultats')}>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Award className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data?.nb_bulletins || 0}</p>
                  <p className="text-xs text-muted-foreground">Bulletins disponibles</p>
                </div>
              </CardContent>
            </Card>

            {eleve?.option_cantine && (
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <UtensilsCrossed className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{(data?.solde_cantine || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Solde cantine (GNF)</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Today's Timetable */}
          {data?.emploi_du_temps_aujourdhui?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> Mon emploi du temps aujourd'hui
              </h3>
              <div className="grid gap-2">
                {data.emploi_du_temps_aujourdhui.map((s: any) => (
                  <Card key={s.id}>
                    <CardContent className="py-2.5 px-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-mono text-muted-foreground w-20">
                          {s.heure_debut?.slice(0, 5)} — {s.heure_fin?.slice(0, 5)}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{s.matieres?.nom}</p>
                          {s.employes && (
                            <p className="text-xs text-muted-foreground">
                              👤 {s.employes.prenom} {s.employes.nom}
                            </p>
                          )}
                        </div>
                      </div>
                      {s.salle && <Badge variant="outline" className="text-xs">🏫 {s.salle}</Badge>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Assignments */}
          {data?.prochains_devoirs?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" /> Prochains devoirs
              </h3>
              {data.prochains_devoirs.map((d: any) => (
                <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/eleve/devoirs')}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{d.titre}</p>
                      <p className="text-xs text-muted-foreground">{d.matieres?.nom}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {formatDistanceToNow(new Date(d.date_limite), { addSuffix: true, locale: fr })}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Recent Courses */}
          {data?.derniers_cours?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" /> Derniers cours ajoutés
              </h3>
              {data.derniers_cours.map((c: any) => (
                <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/eleve/cours')}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.titre}</p>
                      <p className="text-xs text-muted-foreground">{c.matieres?.nom}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {c.type_contenu === 'pdf' ? '📄 PDF' : c.type_contenu === 'video_youtube' ? '🎬 Vidéo' : '🔗 Lien'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      <StudentAIChat />
    </StudentLayout>
  );
}
