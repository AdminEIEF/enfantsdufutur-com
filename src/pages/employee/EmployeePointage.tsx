import { useState, useEffect } from 'react';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Clock, TrendingDown, Timer, CalendarCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function EmployeePointage() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

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

  const allPointages = data?.allPointages || [];
  const filteredPointages = allPointages.filter((p: any) => {
    const d = new Date(p.date_pointage);
    return d.getMonth() + 1 === selectedMonth;
  });

  const totalRetards = filteredPointages.filter((p: any) => p.retard).length;
  const totalHeures = filteredPointages.reduce((sum: number, p: any) => sum + (p.heures_travaillees || 0), 0);

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-4.5 w-4.5 text-blue-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Mon pointage</h2>
            </div>
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[130px] rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOIS_NOMS.slice(1).map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-3">
            {[
              { icon: CalendarCheck, label: 'Jours', value: filteredPointages.length, gradient: 'from-emerald-500/10 to-teal-500/5', iconColor: 'text-emerald-500' },
              { icon: TrendingDown, label: 'Retards', value: totalRetards, gradient: 'from-red-500/10 to-orange-500/5', iconColor: 'text-red-500' },
              { icon: Timer, label: 'Heures', value: `${totalHeures.toFixed(1)}h`, gradient: 'from-blue-500/10 to-indigo-500/5', iconColor: 'text-blue-500' },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl bg-gradient-to-br ${s.gradient} border border-border/40 p-4 text-center`}>
                <div className={`w-8 h-8 rounded-xl bg-background/80 flex items-center justify-center mx-auto mb-2`}>
                  <s.icon className={`h-4 w-4 ${s.iconColor}`} />
                </div>
                <div className="text-xl font-bold text-foreground">{s.value}</div>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </motion.div>

          {/* Liste */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {filteredPointages.length === 0 ? (
              <div className="rounded-2xl bg-card border border-border/40 p-8 text-center">
                <p className="text-sm text-muted-foreground">Aucun pointage pour {MOIS_NOMS[selectedMonth]}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                <div className="divide-y divide-border/30">
                  {filteredPointages.map((p: any) => (
                    <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${p.retard ? 'bg-destructive/5' : 'hover:bg-muted/30'} transition-colors`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${p.retard ? 'bg-destructive' : 'bg-emerald-500'}`} />
                        <span className="font-medium text-sm text-foreground">
                          {format(new Date(p.date_pointage), 'EEE dd MMM', { locale: fr })}
                        </span>
                        {p.retard && <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[9px] font-semibold">Retard</span>}
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                        {p.heure_arrivee && (
                          <span className={`font-mono ${p.retard ? 'text-destructive font-semibold' : ''}`}>
                            {format(new Date(p.heure_arrivee), 'HH:mm')}
                          </span>
                        )}
                        {p.heure_depart && <span className="font-mono">→ {format(new Date(p.heure_depart), 'HH:mm')}</span>}
                        {p.heures_travaillees ? <span className="font-medium text-foreground bg-muted/50 px-2 py-0.5 rounded-lg">{p.heures_travaillees}h</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </EmployeeLayout>
  );
}
