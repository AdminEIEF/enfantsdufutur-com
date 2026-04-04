import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, CalendarDays, BookOpen, FileText, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HEURES_DEFAULT = ['07:30', '08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00', '16:00'];
const COULEURS = [
  'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
  'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20',
  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ token: session.token, action: 'dashboard' }),
    }).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [session]);

  const emp = session?.employe;
  const isEnseignant = emp?.categorie === 'enseignant';
  const classes = data?.classes || [];
  const edt = data?.emploi_du_temps || [];
  const cours = data?.cours_enseignant || [];
  const devoirs = data?.devoirs_enseignant || [];

  const HEURES = useMemo(() => {
    const allTimes = new Set(HEURES_DEFAULT);
    edt.forEach((s: any) => { if (s.heure_debut) allTimes.add(s.heure_debut.slice(0, 5)); });
    return [...allTimes].sort();
  }, [edt]);

  const matiereColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    [...new Set(edt.map((s: any) => s.matiere_id))].forEach((id, i) => { map[id as string] = COULEURS[i % COULEURS.length]; });
    return map;
  }, [edt]);

  if (!session) return null;

  const getSlot = (jourIdx: number, heure: string) => edt.find((s: any) => s.jour_semaine === jourIdx + 1 && s.heure_debut === heure + ':00');
  const todayIdx = new Date().getDay();
  const todayJourIdx = todayIdx === 0 ? 6 : todayIdx - 1;

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : (
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <CalendarDays className="h-4.5 w-4.5 text-blue-500" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Mon planning</h2>
          </motion.div>

          {isEnseignant ? (
            <>
              {/* Classes */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <BookOpen className="h-4 w-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-foreground">Mes classes & matières</h3>
                  </div>
                  <div className="px-4 pb-4">
                    {classes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucune classe assignée</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {classes.map((ec: any) => (
                          <span key={ec.id} className="px-3 py-1.5 rounded-xl bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-500/15">
                            📚 {ec.classes?.nom} — {ec.matieres?.nom || 'Toutes'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Emploi du temps */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                    <CalendarDays className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-foreground">Emploi du temps</h3>
                  </div>
                  <div className="px-4 pb-4">
                    {edt.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Aucun créneau configuré</p>
                    ) : (
                      <div className="overflow-x-auto -mx-4 px-4">
                        <table className="w-full text-xs border-collapse min-w-[600px]">
                          <thead>
                            <tr>
                              <th className="border border-border/30 px-2 py-2 bg-muted/50 text-left w-14 rounded-tl-lg text-muted-foreground">H</th>
                              {JOURS.map((j, idx) => (
                                <th key={j} className={`border border-border/30 px-2 py-2 text-center ${idx === todayJourIdx ? 'bg-emerald-500/10 text-emerald-600 font-bold' : 'bg-muted/50 text-muted-foreground'}`}>
                                  {j.slice(0, 3)}
                                  {idx === todayJourIdx && <span className="ml-0.5 text-[8px]">●</span>}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {HEURES.map(h => (
                              <tr key={h}>
                                <td className="border border-border/30 px-2 py-2 font-mono text-muted-foreground text-[10px]">{h}</td>
                                {JOURS.map((j, jIdx) => {
                                  const slot = getSlot(jIdx, h);
                                  if (!slot) return <td key={j} className={`border border-border/30 ${jIdx === todayJourIdx ? 'bg-emerald-500/5' : ''}`} />;
                                  const colorClass = matiereColorMap[slot.matiere_id] || COULEURS[0];
                                  return (
                                    <td key={j} className="border border-border/30 p-0.5">
                                      <div className={`rounded-xl px-2 py-1.5 border ${colorClass}`}>
                                        <div className="font-semibold text-[10px] leading-tight">{slot.matieres?.nom}</div>
                                        <div className="text-[9px] opacity-70">{slot.classes?.nom}</div>
                                        {slot.salle && <div className="text-[8px] opacity-60">📍 {slot.salle}</div>}
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
                  </div>
                </div>
              </motion.div>

              {/* Cours */}
              {cours.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <FileText className="h-4 w-4 text-violet-500" />
                      <h3 className="text-sm font-semibold text-foreground">Contenus publiés</h3>
                    </div>
                    <div className="divide-y divide-border/30">
                      {cours.map((c: any) => (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.titre}</p>
                            <p className="text-[10px] text-muted-foreground">{c.classes?.nom} — {c.matieres?.nom}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-muted/50 text-[9px] text-muted-foreground">{c.type_contenu}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Devoirs */}
              {devoirs.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                      <ClipboardList className="h-4 w-4 text-amber-500" />
                      <h3 className="text-sm font-semibold text-foreground">Devoirs en cours</h3>
                    </div>
                    <div className="divide-y divide-border/30">
                      {devoirs.map((d: any) => (
                        <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{d.titre}</p>
                            <p className="text-[10px] text-muted-foreground">{d.classes?.nom} — {d.matieres?.nom}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 text-[10px] font-medium">
                            {new Date(d.date_limite).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <div className="rounded-2xl bg-card border border-border/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">Le planning est disponible pour les enseignants.</p>
            </div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
