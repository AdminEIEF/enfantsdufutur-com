import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { Award, BookOpen, FileCheck, Loader2, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const MATIERE_EMOJIS: Record<string, string> = {
  'Mathématiques': '🔢', 'Français': '📝', 'Anglais': '🇬🇧', 'Sciences': '🔬',
  'Histoire': '📜', 'Géographie': '🌍', 'Physique': '⚛️', 'Chimie': '🧪',
  'SVT': '🌿', 'Philosophie': '💭', 'Arabe': '🕌', 'EPS': '⚽',
  'Informatique': '💻', 'Musique': '🎵', 'Arts': '🎨',
};

export default function StudentResultats() {
  const { session } = useStudentAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'devoirs' | 'bulletins'>('notes');
  const [expandedPeriode, setExpandedPeriode] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetchResultats();
  }, [session]);

  const fetchResultats = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ token: session!.token, action: 'resultats' }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const bareme = session?.eleve?.classes?.niveaux?.cycles?.bareme || 20;

  const notesByPeriode = (data?.notes || []).reduce((acc: Record<string, any[]>, n: any) => {
    const periode = n.periodes?.nom || 'Inconnu';
    if (!acc[periode]) acc[periode] = [];
    acc[periode].push(n);
    return acc;
  }, {});

  const periodes = Object.keys(notesByPeriode).sort((a, b) => {
    const aOrdre = notesByPeriode[a][0]?.periodes?.ordre || 0;
    const bOrdre = notesByPeriode[b][0]?.periodes?.ordre || 0;
    return aOrdre - bOrdre;
  });

  const calcMoyenne = (notes: any[]) => {
    const valid = notes.filter(n => n.note !== null);
    if (valid.length === 0) return null;
    const totalCoef = valid.reduce((s, n) => s + (n.matieres?.coefficient || 1), 0);
    const totalWeighted = valid.reduce((s, n) => s + n.note * (n.matieres?.coefficient || 1), 0);
    return totalCoef > 0 ? (totalWeighted / totalCoef).toFixed(2) : null;
  };

  const getEmoji = (nom: string) => {
    for (const [key, emoji] of Object.entries(MATIERE_EMOJIS)) {
      if (nom?.toLowerCase().includes(key.toLowerCase())) return emoji;
    }
    return '📖';
  };

  const tabs = [
    { key: 'notes' as const, label: 'Notes', emoji: '📊' },
    { key: 'devoirs' as const, label: 'Devoirs', emoji: '📝' },
    { key: 'bulletins' as const, label: 'Bulletins', emoji: '📄' },
  ];

  // Auto-expand first period
  useEffect(() => {
    if (periodes.length > 0 && !expandedPeriode) {
      setExpandedPeriode(periodes[periodes.length - 1]);
    }
  }, [periodes]);

  return (
    <StudentLayout>
      <div className="space-y-4 pb-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Award className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Mes résultats</h2>
            <p className="text-[11px] text-muted-foreground">Notes, devoirs et bulletins</p>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Tab pills */}
            <div className="flex gap-2 bg-muted/50 p-1.5 rounded-2xl">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === tab.key
                      ? 'bg-card shadow-lg text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* ─── NOTES ─── */}
              {activeTab === 'notes' && (
                <motion.div key="notes" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                  {periodes.length === 0 ? (
                    <Card className="border-0 shadow-md rounded-2xl">
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Aucune note disponible</p>
                      </CardContent>
                    </Card>
                  ) : periodes.map(periode => {
                    const notes = notesByPeriode[periode];
                    const moyenne = calcMoyenne(notes);
                    const isExpanded = expandedPeriode === periode;
                    const moyNum = Number(moyenne);
                    const isGood = moyNum >= bareme / 2;
                    return (
                      <Card key={periode} className="border-0 shadow-lg rounded-2xl overflow-hidden">
                        {/* Period header - clickable */}
                        <button
                          onClick={() => setExpandedPeriode(isExpanded ? null : periode)}
                          className="w-full text-left"
                        >
                          <div className={`p-4 flex items-center justify-between ${isGood ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/5' : 'bg-gradient-to-r from-amber-500/10 to-orange-500/5'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-md ${isGood ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                {moyenne || '—'}
                              </div>
                              <div>
                                <p className="font-bold text-sm">{periode}</p>
                                <p className="text-[10px] text-muted-foreground">{notes.length} matière{notes.length > 1 ? 's' : ''} • /{bareme}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {moyenne && (
                                <Badge className={`rounded-full text-[10px] px-2.5 ${isGood ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                                  {moyNum.toFixed(1)}/{bareme}
                                </Badge>
                              )}
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>
                        </button>
                        {/* Notes list */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                              <div className="px-3 pb-3 space-y-1.5">
                                {notes.map((n: any) => {
                                  const noteGood = n.note !== null && n.note >= bareme / 2;
                                  return (
                                    <div key={n.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                                      <span className="text-lg">{getEmoji(n.matieres?.nom)}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate">{n.matieres?.nom}</p>
                                        <p className="text-[9px] text-muted-foreground">Coef. {n.matieres?.coefficient || 1}</p>
                                      </div>
                                      {n.note !== null ? (
                                        <div className={`px-3 py-1.5 rounded-xl font-extrabold text-sm ${noteGood ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-red-100 dark:bg-red-900/30 text-red-500'}`}>
                                          {n.note}<span className="text-[10px] font-medium opacity-60">/{bareme}</span>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground text-sm px-3">—</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    );
                  })}
                </motion.div>
              )}

              {/* ─── DEVOIRS ─── */}
              {activeTab === 'devoirs' && (
                <motion.div key="devoirs" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-2.5">
                  {(data?.soumissionsNotees || []).length === 0 ? (
                    <Card className="border-0 shadow-md rounded-2xl">
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Aucun devoir noté</p>
                      </CardContent>
                    </Card>
                  ) : (data.soumissionsNotees.map((s: any, i: number) => {
                    const noteMax = s.devoirs?.note_max || 20;
                    const isGood = s.note >= noteMax / 2;
                    const pct = Math.round((s.note / noteMax) * 100);
                    return (
                      <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <Card className="border-0 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-all">
                          <CardContent className="p-0">
                            <div className="flex items-center gap-3 p-3.5">
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-md ${isGood ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : 'bg-gradient-to-br from-red-500 to-rose-600 text-white'}`}>
                                {s.note}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{s.devoirs?.titre}</p>
                                <p className="text-[10px] text-muted-foreground">{getEmoji(s.devoirs?.matieres?.nom)} {s.devoirs?.matieres?.nom}</p>
                                {s.commentaire && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">💬 {s.commentaire}</p>}
                              </div>
                              <Badge className={`rounded-full text-[10px] ${isGood ? 'bg-emerald-600' : 'bg-red-500'}`}>
                                {pct}%
                              </Badge>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1 bg-muted">
                              <div className={`h-full transition-all ${isGood ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  }))}
                </motion.div>
              )}

              {/* ─── BULLETINS ─── */}
              {activeTab === 'bulletins' && (
                <motion.div key="bulletins" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                  {(data?.bulletinPublications || []).length === 0 ? (
                    <Card className="border-0 shadow-md rounded-2xl">
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">Aucun bulletin publié</p>
                        <p className="text-[11px] mt-1 opacity-70">Les bulletins seront visibles une fois publiés.</p>
                      </CardContent>
                    </Card>
                  ) : (data.bulletinPublications.map((bp: any, i: number) => (
                    <motion.div key={bp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-center gap-3 p-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                              <FileCheck className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm">{bp.periodes?.nom}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Publié le {new Date(bp.published_at || bp.created_at).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            <Badge className="bg-emerald-600 rounded-full text-[10px] px-3 shadow-sm">✓ Disponible</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
      <StudentAIChat />
    </StudentLayout>
  );
}
