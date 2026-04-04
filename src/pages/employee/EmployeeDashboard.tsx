import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Calendar, Clock, FileText, AlertTriangle, DollarSign, BookOpen, TrendingUp, ArrowRight, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export default function EmployeeDashboard() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
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
  const categorieLabel: Record<string, string> = {
    enseignant: '👨‍🏫 Enseignant',
    administration: '🏢 Administration',
    service: '🔧 Service',
    direction: '👔 Direction',
  };

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Hero Card */}
          <motion.div {...fadeIn(0)}>
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white">
              <CardContent className="pt-6 pb-5 flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-white/30 shadow-lg shrink-0">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                      {emp.prenom[0]}{emp.nom[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-xs font-medium">{greeting} 👋</p>
                  <h2 className="text-xl font-bold truncate">{emp.prenom} {emp.nom}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-white/20 text-white border-0 text-[10px]">
                      {emp.poste}
                    </Badge>
                    <span className="text-white/60 text-[10px]">•</span>
                    <span className="text-white/70 text-[10px] font-mono">{emp.matricule}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Grid */}
          <motion.div {...fadeIn(0.1)} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Clock, label: 'Pointages', value: data?.pointages?.length || 0, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { icon: AlertTriangle, label: 'Retards', value: data?.pointages?.filter((p: any) => p.retard)?.length || 0, color: 'text-orange-500', bg: 'bg-orange-500/10' },
              { icon: Calendar, label: 'Congés en attente', value: data?.conges?.filter((c: any) => c.statut === 'en_attente')?.length || 0, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { icon: DollarSign, label: 'Bulletins paie', value: data?.bulletins?.length || 0, color: 'text-violet-500', bg: 'bg-violet-500/10' },
            ].map((stat, i) => (
              <Card key={i} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Enseignant — Classes */}
          {emp.categorie === 'enseignant' && data?.classes?.length > 0 && (
            <motion.div {...fadeIn(0.2)}>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-emerald-600" />
                    <h3 className="font-semibold text-sm text-foreground">Mes classes</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.classes.map((ec: any) => (
                      <Badge key={ec.id} variant="secondary" className="text-xs rounded-lg py-1 px-2.5">
                        {ec.classes?.nom} {ec.matieres?.nom ? `— ${ec.matieres.nom}` : ''}
                      </Badge>
                    ))}
                  </div>

                  {/* Cours publiés */}
                  {data?.cours_enseignant?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        📚 Contenus publiés
                      </p>
                      {data.cours_enseignant.slice(0, 4).map((c: any) => (
                        <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-foreground">{c.titre}</p>
                            <p className="text-muted-foreground">{c.classes?.nom} — {c.matieres?.nom}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] shrink-0">{c.type_contenu}</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Devoirs */}
                  {data?.devoirs_enseignant?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        📝 Devoirs en cours
                      </p>
                      {data.devoirs_enseignant.slice(0, 4).map((d: any) => (
                        <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-foreground">{d.titre}</p>
                            <p className="text-muted-foreground">{d.classes?.nom} — {d.matieres?.nom}</p>
                          </div>
                          <span className="text-muted-foreground text-[10px] shrink-0">
                            {format(new Date(d.date_limite), 'dd/MM')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Derniers pointages */}
          {data?.pointages?.length > 0 && (
            <motion.div {...fadeIn(0.3)}>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <h3 className="font-semibold text-sm text-foreground">Derniers pointages</h3>
                  </div>
                  <div className="space-y-1.5">
                    {data.pointages.slice(0, 5).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <span className="text-sm font-medium text-foreground capitalize">
                          {format(new Date(p.date_pointage), 'EEE dd MMM', { locale: fr })}
                        </span>
                        <div className="flex items-center gap-2">
                          {p.heure_arrivee && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {format(new Date(p.heure_arrivee), 'HH:mm')}
                            </span>
                          )}
                          {p.heure_depart && (
                            <span className="text-xs text-muted-foreground font-mono">
                              → {format(new Date(p.heure_depart), 'HH:mm')}
                            </span>
                          )}
                          {p.retard && <Badge className="bg-destructive/15 text-destructive border-0 text-[9px]">Retard</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Avances en cours */}
          {data?.avances?.filter((a: any) => a.statut !== 'refuse' && a.statut !== 'rembourse')?.length > 0 && (
            <motion.div {...fadeIn(0.4)}>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-violet-500" />
                    <h3 className="font-semibold text-sm text-foreground">Avances en cours</h3>
                  </div>
                  <div className="space-y-2">
                    {data.avances.filter((a: any) => a.statut !== 'refuse' && a.statut !== 'rembourse').map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <span className="text-sm font-medium text-foreground">{Number(a.montant).toLocaleString()} GNF</span>
                        <Badge
                          className={`text-[10px] border-0 ${
                            a.statut === 'en_attente' ? 'bg-amber-500/15 text-amber-700' :
                            a.statut === 'approuve' ? 'bg-emerald-500/15 text-emerald-700' :
                            'bg-muted text-muted-foreground'
                          }`}
                        >
                          {a.statut === 'en_attente' ? 'En attente' : a.statut === 'approuve' ? 'Approuvé' : a.statut}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Évaluations récentes */}
          {data?.evaluations?.length > 0 && (
            <motion.div {...fadeIn(0.5)}>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-semibold text-sm text-foreground">Dernière évaluation</h3>
                  </div>
                  {(() => {
                    const ev = data.evaluations[0];
                    const scores = [
                      { label: 'Ponctualité', value: ev.ponctualite },
                      { label: 'Compétences', value: ev.competences },
                      { label: 'Relations', value: ev.relations },
                      { label: 'Pédagogie', value: ev.pedagogie },
                    ].filter(s => s.value != null);
                    const avg = scores.length ? (scores.reduce((s, x) => s + x.value, 0) / scores.length).toFixed(1) : '—';
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{ev.periode}</span>
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-0 text-xs">{avg}/5</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {scores.map(s => (
                            <div key={s.label} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                              <span className="text-muted-foreground">{s.label}</span>
                              <span className="font-bold text-foreground">{s.value}/5</span>
                            </div>
                          ))}
                        </div>
                        {ev.commentaire && (
                          <p className="text-xs text-muted-foreground italic border-l-2 border-emerald-500/40 pl-2">{ev.commentaire}</p>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
