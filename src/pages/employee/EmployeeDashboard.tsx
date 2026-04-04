import { useState, useEffect } from 'react';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Calendar, Clock, FileText, AlertTriangle, DollarSign, BookOpen, TrendingUp, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay },
});

export default function EmployeeDashboard() {
  const { session } = useEmployeeAuth();
  const navigate = useNavigate();
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
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bonjour' : now.getHours() < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Hero */}
          <motion.div {...fadeIn(0)} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 p-5 text-white shadow-xl shadow-emerald-600/20">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/5 blur-xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden ring-2 ring-white/30 shadow-lg shrink-0 backdrop-blur-sm">
                {emp.photo_url ? (
                  <img src={emp.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                    {emp.prenom[0]}{emp.nom[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-xs font-medium">{greeting} 👋</p>
                <h2 className="text-xl font-bold truncate">{emp.prenom} {emp.nom}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-medium backdrop-blur-sm">{emp.poste}</span>
                  <span className="text-white/40 text-[10px]">•</span>
                  <span className="text-white/50 text-[10px] font-mono">{emp.matricule}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div {...fadeIn(0.1)} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Clock, label: 'Pointages', value: data?.pointages?.length || 0, gradient: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-500', path: '/employe/pointage' },
              { icon: AlertTriangle, label: 'Retards', value: data?.pointages?.filter((p: any) => p.retard)?.length || 0, gradient: 'from-amber-500/10 to-orange-500/5', iconColor: 'text-amber-500', path: '/employe/pointage' },
              { icon: Calendar, label: 'Congés', value: data?.conges?.filter((c: any) => c.statut === 'en_attente')?.length || 0, gradient: 'from-emerald-500/10 to-teal-500/5', iconColor: 'text-emerald-500', path: '/employe/conges' },
              { icon: DollarSign, label: 'Bulletins', value: data?.bulletins?.length || 0, gradient: 'from-violet-500/10 to-purple-500/5', iconColor: 'text-violet-500', path: '/employe/paie' },
            ].map((stat, i) => (
              <button key={i} onClick={() => navigate(stat.path)} className="text-left">
                <div className={`rounded-2xl bg-gradient-to-br ${stat.gradient} border border-border/40 p-4 hover:shadow-lg transition-all duration-300 active:scale-[0.97]`}>
                  <div className={`w-9 h-9 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center mb-2.5 shadow-sm`}>
                    <stat.icon className={`h-4.5 w-4.5 ${stat.iconColor}`} />
                  </div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </button>
            ))}
          </motion.div>

          {/* Quick actions */}
          <motion.div {...fadeIn(0.15)} className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Planning', icon: '📅', path: '/employe/planning' },
              { label: 'Courriers', icon: '✉️', path: '/employe/courriers' },
              { label: 'Évaluation', icon: '📊', path: '/employe/evaluation' },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-card border border-border/40 hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 active:scale-[0.96]"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium text-foreground">{item.label}</span>
              </button>
            ))}
          </motion.div>

          {/* Classes enseignant */}
          {emp.categorie === 'enseignant' && data?.classes?.length > 0 && (
            <motion.div {...fadeIn(0.2)}>
              <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Mes classes</h3>
                </div>
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {data.classes.map((ec: any) => (
                      <span key={ec.id} className="px-3 py-1.5 rounded-xl bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-500/15">
                        {ec.classes?.nom} {ec.matieres?.nom ? `— ${ec.matieres.nom}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Derniers pointages */}
          {data?.pointages?.length > 0 && (
            <motion.div {...fadeIn(0.25)}>
              <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">Derniers pointages</h3>
                  </div>
                  <button onClick={() => navigate('/employe/pointage')} className="text-xs text-emerald-600 font-medium flex items-center gap-0.5 hover:gap-1 transition-all">
                    Voir tout <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="px-4 pb-3 space-y-1">
                  {data.pointages.slice(0, 4).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/40 transition-colors">
                      <span className="text-sm font-medium text-foreground capitalize">
                        {format(new Date(p.date_pointage), 'EEE dd MMM', { locale: fr })}
                      </span>
                      <div className="flex items-center gap-2.5">
                        {p.heure_arrivee && (
                          <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-lg">
                            {format(new Date(p.heure_arrivee), 'HH:mm')}
                          </span>
                        )}
                        {p.heure_depart && (
                          <span className="text-xs text-muted-foreground font-mono">
                            → {format(new Date(p.heure_depart), 'HH:mm')}
                          </span>
                        )}
                        {p.retard && (
                          <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[9px] font-semibold">Retard</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Avances */}
          {data?.avances?.filter((a: any) => a.statut !== 'refuse' && a.statut !== 'rembourse')?.length > 0 && (
            <motion.div {...fadeIn(0.3)}>
              <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-violet-500" />
                  </div>
                  <h3 className="font-semibold text-sm text-foreground">Avances en cours</h3>
                </div>
                <div className="px-4 pb-3 space-y-2">
                  {data.avances.filter((a: any) => a.statut !== 'refuse' && a.statut !== 'rembourse').map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                      <span className="text-sm font-semibold text-foreground">{Number(a.montant).toLocaleString()} GNF</span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        a.statut === 'en_attente' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
                      }`}>
                        {a.statut === 'en_attente' ? 'En attente' : 'Approuvé'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Évaluation */}
          {data?.evaluations?.length > 0 && (
            <motion.div {...fadeIn(0.35)}>
              <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </div>
                    <h3 className="font-semibold text-sm text-foreground">Dernière évaluation</h3>
                  </div>
                  <button onClick={() => navigate('/employe/evaluation')} className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
                    Détails <ChevronRight className="h-3.5 w-3.5" />
                  </button>
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
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{ev.periode}</span>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">{avg}/5</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {scores.map(s => (
                          <div key={s.label} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 text-xs">
                            <span className="text-muted-foreground">{s.label}</span>
                            <span className="font-bold text-foreground">{s.value}/5</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
