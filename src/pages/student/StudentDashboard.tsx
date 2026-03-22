import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, ClipboardList, Award, Clock, UtensilsCrossed, Loader2, ChevronRight, CalendarDays, Trophy, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function StudentDashboard() {
  const { session } = useStudentAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

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

  // Group timetable by day
  const edtParJour: Record<number, any[]> = {};
  (data?.emploi_du_temps_semaine || []).forEach((s: any) => {
    if (!edtParJour[s.jour_semaine]) edtParJour[s.jour_semaine] = [];
    edtParJour[s.jour_semaine].push(s);
  });

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
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">Cours</p>
                  <p className="text-xs text-muted-foreground">Mes cours</p>
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

          {/* Class Rank per Period */}
          {data?.rang_par_periode?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" /> Mon classement
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.rang_par_periode.map((r: any) => (
                  <Card key={r.periode_id} className="border-amber-200/50">
                    <CardContent className="py-3 px-3 text-center space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{r.periode_nom}</p>
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-2xl font-extrabold ${r.rang <= 3 ? 'text-amber-500' : 'text-foreground'}`}>
                          {r.rang}<sup className="text-xs font-normal">e</sup>
                        </span>
                        <span className="text-xs text-muted-foreground">/ {r.total_eleves}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Moy: {r.moyenne}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Weekly Timetable */}
          {Object.keys(edtParJour).length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> Mon emploi du temps
              </h3>
              {Object.entries(edtParJour)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([jour, cours]) => (
                  <Card key={jour}>
                    <CardContent className="py-2.5 px-3 space-y-1.5">
                      <p className="text-xs font-bold text-primary">{JOURS[Number(jour)] || `Jour ${jour}`}</p>
                      {cours.map((s: any) => (
                        <div key={s.id} className="flex items-center gap-3 py-1 px-2 rounded-lg bg-muted/50">
                          <div className="text-[11px] font-mono text-muted-foreground w-[70px] shrink-0">
                            {s.heure_debut?.slice(0, 5)} — {s.heure_fin?.slice(0, 5)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.matieres?.nom}</p>
                            {s.employes && (
                              <p className="text-[11px] text-muted-foreground">
                                {s.employes.prenom} {s.employes.nom}
                              </p>
                            )}
                          </div>
                          {s.salle && <Badge variant="outline" className="text-[10px] shrink-0">{s.salle}</Badge>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
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

          {/* Calendar Events */}
          {data?.evenements_calendrier?.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Calendrier scolaire
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {data.evenements_calendrier.map((ev: any) => (
                  <Card 
                    key={ev.id} 
                    className="border-l-4 cursor-pointer hover:shadow-md transition-shadow" 
                    style={{ borderLeftColor: ev.couleur || 'hsl(var(--primary))' }}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <CardContent className="py-3 px-3">
                      <p className="font-medium text-sm truncate">{ev.titre}</p>
                      <Badge variant="outline" className="text-[10px] mt-1.5">
                        {new Date(ev.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {ev.date_fin && ev.date_fin !== ev.date_debut && (' — ' + new Date(ev.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}
                      </Badge>
                      {ev.matieres?.nom && <p className="text-[11px] text-muted-foreground mt-1">📖 {ev.matieres.nom}</p>}
                      {ev.evenement_classes?.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          📚 {ev.evenement_classes.length} épreuve{ev.evenement_classes.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Event Detail Dialog */}
          <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {selectedEvent?.titre}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  📅 {selectedEvent && new Date(selectedEvent.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {selectedEvent?.date_fin && selectedEvent.date_fin !== selectedEvent.date_debut && (
                    <> — {new Date(selectedEvent.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</>
                  )}
                </div>

                {selectedEvent?.description && (
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                )}

                {selectedEvent?.matieres?.nom && !selectedEvent?.evenement_classes?.length && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">📖 {selectedEvent.matieres.nom}</p>
                    {selectedEvent.heure_debut && (
                      <p className="text-xs text-muted-foreground mt-1">
                        🕐 {selectedEvent.heure_debut?.slice(0, 5)}{selectedEvent.heure_fin ? ` — ${selectedEvent.heure_fin.slice(0, 5)}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {selectedEvent?.evenement_classes?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">📋 Programme des épreuves</p>
                    {selectedEvent.evenement_classes
                      .sort((a: any, b: any) => (a.heure_debut || '').localeCompare(b.heure_debut || ''))
                      .map((ec: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                          {ec.heure_debut && (
                            <div className="text-xs font-mono text-muted-foreground w-[90px] shrink-0">
                              🕐 {ec.heure_debut?.slice(0, 5)} — {ec.heure_fin?.slice(0, 5)}
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{ec.matieres?.nom || 'Matière'}</p>
                            {ec.classes?.nom && (
                              <p className="text-[11px] text-muted-foreground">{ec.classes.nom}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      <StudentAIChat />
    </StudentLayout>
  );
}
