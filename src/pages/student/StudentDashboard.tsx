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
import { motion } from 'framer-motion';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function StudentDashboard() {
  const { session } = useStudentAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedEdtJour, setSelectedEdtJour] = useState<{ jour: string; cours: any[] } | null>(null);

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

  const edtParJour: Record<number, any[]> = {};
  (data?.emploi_du_temps_semaine || []).forEach((s: any) => {
    if (!edtParJour[s.jour_semaine]) edtParJour[s.jour_semaine] = [];
    edtParJour[s.jour_semaine].push(s);
  });

  const statCards = [
    { label: 'Cours', value: data?.nb_cours || 0, icon: BookOpen, gradient: 'from-blue-500 to-blue-600', path: '/eleve/cours' },
    { label: 'Devoirs', value: data?.prochains_devoirs?.length || 0, icon: ClipboardList, gradient: 'from-orange-500 to-amber-500', path: '/eleve/devoirs' },
    { label: 'Bulletins', value: data?.nb_bulletins || 0, icon: Award, gradient: 'from-emerald-500 to-green-600', path: '/eleve/resultats' },
  ];

  return (
    <StudentLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Welcome — Material 3 greeting */}
          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-0.5">
            <h2 className="text-xl font-bold text-foreground">Bonjour {eleve?.prenom} 👋</h2>
            <p className="text-sm text-muted-foreground font-medium">
              {eleve?.classes?.niveaux?.nom} — {eleve?.classes?.nom}
            </p>
          </motion.div>

          {/* Quick Stats — Gradient cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {statCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card
                  className="cursor-pointer overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow active:scale-[0.97]"
                  onClick={() => navigate(stat.path)}
                >
                  <CardContent className="p-0">
                    <div className={`bg-gradient-to-br ${stat.gradient} p-3 text-white`}>
                      <stat.icon className="h-5 w-5 mb-1.5 opacity-80" />
                      <p className="text-2xl font-extrabold leading-none">{stat.value}</p>
                      <p className="text-[10px] font-medium opacity-80 mt-0.5">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Cantine balance */}
          {eleve?.option_cantine && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-0 shadow-md overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-r from-amber-400 to-orange-400 p-3.5 flex items-center gap-3 text-white">
                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                      <UtensilsCrossed className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-medium opacity-80 uppercase tracking-wider">Solde cantine</p>
                      <p className="text-xl font-extrabold">{(data?.solde_cantine || 0).toLocaleString()} GNF</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Class Rank */}
          {data?.rang_par_periode?.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="space-y-2.5">
              <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                <Trophy className="h-4 w-4 text-amber-500" /> Mon classement
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                {data.rang_par_periode.map((r: any) => (
                  <Card key={r.periode_id} className="border-0 shadow-md shrink-0 snap-start min-w-[120px]">
                    <CardContent className="py-3 px-3 text-center space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{r.periode_nom}</p>
                      <div className="flex items-baseline justify-center gap-0.5">
                        <span className={`text-3xl font-black ${r.rang <= 3 ? 'text-amber-500' : 'text-foreground'}`}>
                          {r.rang}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">/{r.total_eleves}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Moy: <span className="font-bold text-foreground">{r.moyenne}</span></p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Weekly Timetable */}
          {Object.keys(edtParJour).length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="space-y-2.5">
              <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" /> Mon emploi du temps
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {Object.entries(edtParJour)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([jour, cours]) => (
                    <Card
                      key={jour}
                      className="cursor-pointer border-0 shadow-md hover:shadow-lg transition-all active:scale-[0.97] overflow-hidden"
                      onClick={() => setSelectedEdtJour({ jour: JOURS[Number(jour)] || `Jour ${jour}`, cours })}
                    >
                      <CardContent className="p-0">
                        <div className="bg-primary/5 px-3 py-1.5 border-b border-primary/10">
                          <p className="text-xs font-bold text-primary">{JOURS[Number(jour)] || `Jour ${jour}`}</p>
                        </div>
                        <div className="p-2 space-y-1">
                          {cours.slice(0, 3).map((s: any) => (
                            <div key={s.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-muted/40">
                              <div className="text-[9px] font-mono text-muted-foreground w-[55px] shrink-0">
                                {s.heure_debut?.slice(0, 5)}–{s.heure_fin?.slice(0, 5)}
                              </div>
                              <p className="text-[11px] font-medium truncate flex-1">{s.matieres?.nom}</p>
                            </div>
                          ))}
                          {cours.length > 3 && (
                            <p className="text-[9px] text-muted-foreground text-center font-medium">+{cours.length - 3} autres</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </motion.div>
          )}

          {/* Upcoming Assignments */}
          {data?.prochains_devoirs?.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="space-y-2.5">
              <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-orange-500" /> Prochains devoirs
              </h3>
              {data.prochains_devoirs.map((d: any, i: number) => (
                <motion.div key={d.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 + i * 0.05 }}>
                  <Card className="cursor-pointer border-0 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]" onClick={() => navigate('/eleve/devoirs')}>
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{d.titre}</p>
                        <p className="text-xs text-muted-foreground">{d.matieres?.nom}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {formatDistanceToNow(new Date(d.date_limite), { addSuffix: true, locale: fr })}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Calendar Events */}
          {data?.evenements_calendrier?.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="space-y-2.5">
              <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                <Calendar className="h-4 w-4 text-primary" /> Calendrier scolaire
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {data.evenements_calendrier.map((ev: any) => (
                  <Card
                    key={ev.id}
                    className="border-0 shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.97]"
                    style={{ borderLeftColor: ev.couleur || 'hsl(var(--primary))' }}
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <CardContent className="py-2.5 px-3">
                      <p className="font-semibold text-sm truncate">{ev.titre}</p>
                      <Badge variant="outline" className="text-[9px] mt-1">
                        {new Date(ev.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {ev.date_fin && ev.date_fin !== ev.date_debut && (' — ' + new Date(ev.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* EDT Detail Dialog */}
          <Dialog open={!!selectedEdtJour} onOpenChange={() => setSelectedEdtJour(null)}>
            <DialogContent className="max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {selectedEdtJour?.jour}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {selectedEdtJour?.cours
                  .sort((a: any, b: any) => (a.heure_debut || '').localeCompare(b.heure_debut || ''))
                  .map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/30">
                      <div className="text-xs font-mono text-muted-foreground w-[80px] shrink-0">
                        🕐 {s.heure_debut?.slice(0, 5)} — {s.heure_fin?.slice(0, 5)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{s.matieres?.nom}</p>
                        {s.employes && <p className="text-xs text-muted-foreground">👤 {s.employes.prenom} {s.employes.nom}</p>}
                        {s.salle && <p className="text-xs text-muted-foreground">🏫 Salle {s.salle}</p>}
                      </div>
                    </div>
                  ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* Event Detail Dialog */}
          <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
            <DialogContent className="max-w-md rounded-3xl">
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
                {selectedEvent?.description && <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>}
                {selectedEvent?.matieres?.nom && !selectedEvent?.evenement_classes?.length && (
                  <div className="p-3 rounded-xl bg-muted/50">
                    <p className="text-sm font-medium">📖 {selectedEvent.matieres.nom}</p>
                    {selectedEvent.heure_debut && (
                      <p className="text-xs text-muted-foreground mt-1">🕐 {selectedEvent.heure_debut?.slice(0, 5)}{selectedEvent.heure_fin ? ` — ${selectedEvent.heure_fin.slice(0, 5)}` : ''}</p>
                    )}
                  </div>
                )}
                {selectedEvent?.evenement_classes?.length > 0 && (() => {
                  const entries = [...selectedEvent.evenement_classes].sort((a: any, b: any) =>
                    (a.date_epreuve || '').localeCompare(b.date_epreuve || '') || (a.heure_debut || '').localeCompare(b.heure_debut || '')
                  );
                  const hasDates = entries.some((ec: any) => ec.date_epreuve);
                  if (hasDates) {
                    const grouped: Record<string, any[]> = {};
                    entries.forEach((ec: any) => {
                      const key = ec.date_epreuve || 'non_date';
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(ec);
                    });
                    return (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold">📋 Programme des épreuves</p>
                        {Object.entries(grouped).map(([date, items]) => (
                          <div key={date} className="space-y-1.5">
                            {date !== 'non_date' && <p className="text-xs font-bold text-primary">📅 {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
                            {items.map((ec: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border/30">
                                {ec.heure_debut && <div className="text-[11px] font-mono text-muted-foreground w-[85px] shrink-0">🕐 {ec.heure_debut?.slice(0, 5)} — {ec.heure_fin?.slice(0, 5)}</div>}
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{ec.matieres?.nom || 'Matière'}</p>
                                  {ec.classes?.nom && <p className="text-[11px] text-muted-foreground">{ec.classes.nom}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">📋 Programme des épreuves</p>
                      {entries.map((ec: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                          {ec.heure_debut && <div className="text-[11px] font-mono text-muted-foreground w-[85px] shrink-0">🕐 {ec.heure_debut?.slice(0, 5)} — {ec.heure_fin?.slice(0, 5)}</div>}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{ec.matieres?.nom || 'Matière'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </DialogContent>
          </Dialog>

          <StudentAIChat />
        </div>
      )}
    </StudentLayout>
  );
}
