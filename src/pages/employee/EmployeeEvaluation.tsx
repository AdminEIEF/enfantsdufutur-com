import { useState, useEffect } from 'react';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, BarChart3, Trophy, History } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

const CRITERIA_LABELS: Record<string, string> = {
  pedagogie: 'Pédagogie',
  ponctualite: 'Ponctualité',
  assiduite: 'Assiduité',
  relations: 'Relations',
  competences: 'Compétences',
  initiative: 'Initiative',
};

export default function EmployeeEvaluation() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ token: session.token, action: 'dashboard' }),
    }).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [session]);

  if (!session) return null;

  const evaluations = data?.evaluations || [];
  const latestEval = evaluations[0];

  const radarData = latestEval
    ? Object.keys(CRITERIA_LABELS).map(key => ({ criteria: CRITERIA_LABELS[key], score: Number(latestEval[key]) || 0, fullMark: 10 }))
    : [];

  const avgScore = latestEval
    ? (Object.keys(CRITERIA_LABELS).reduce((sum, k) => sum + (Number(latestEval[k]) || 0), 0) / Object.keys(CRITERIA_LABELS).length).toFixed(1)
    : null;

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : (
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <BarChart3 className="h-4.5 w-4.5 text-amber-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Mon évaluation</h2>
          </motion.div>

          {evaluations.length === 0 ? (
            <div className="rounded-2xl bg-card border border-border/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">Aucune évaluation disponible</p>
            </div>
          ) : (
            <>
              {/* Score hero */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 text-white shadow-xl shadow-amber-500/20"
              >
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Moyenne générale</p>
                    <p className="text-3xl font-bold">{avgScore}<span className="text-lg text-white/60">/10</span></p>
                    <p className="text-white/50 text-[10px] mt-0.5">{latestEval.periode}</p>
                  </div>
                </div>
              </motion.div>

              {/* Radar */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                  <div className="p-4 pb-0">
                    <h3 className="text-sm font-semibold text-foreground">Profil de compétences</h3>
                  </div>
                  <div className="h-[280px] px-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="criteria" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
                        <Radar name="Score" dataKey="score" stroke="hsl(25, 95%, 53%)" fill="hsl(25, 95%, 53%)" fillOpacity={0.25} strokeWidth={2} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                    {radarData.map(item => (
                      <div key={item.criteria} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 text-xs">
                        <span className="text-muted-foreground">{item.criteria}</span>
                        <span className={`font-bold ${item.score >= 7 ? 'text-emerald-600' : item.score >= 5 ? 'text-amber-500' : 'text-destructive'}`}>
                          {item.score}/10
                        </span>
                      </div>
                    ))}
                  </div>
                  {latestEval.commentaire && (
                    <div className="px-4 pb-4">
                      <p className="text-xs text-muted-foreground border-l-2 border-amber-500/30 pl-3 italic">{latestEval.commentaire}</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Historique */}
              {evaluations.length > 1 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">Historique</h3>
                    </div>
                    <div className="divide-y divide-border/30">
                      {evaluations.slice(1).map((ev: any) => {
                        const avg = (Object.keys(CRITERIA_LABELS).reduce((s, k) => s + (Number(ev[k]) || 0), 0) / Object.keys(CRITERIA_LABELS).length).toFixed(1);
                        return (
                          <div key={ev.id} className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm font-medium text-foreground">{ev.periode}</span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${Number(avg) >= 7 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>{avg}/10</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
